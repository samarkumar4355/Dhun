import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Track, type ITrack } from '../models/track.model.js';
import { env } from '../config/env.js';
import { googleDriveService } from './googleDrive.service.js';
import { logger } from '../utils/logger.js';
import { sendError } from '../utils/response.js';

export class PlaybackService {
  /**
   * Safely finds a Track by ObjectId, fileHash, driveAudioFileId, or originalFileName
   * without crashing when an invalid ObjectId string is supplied.
   */
  async findTrackSafely(trackId: string): Promise<ITrack | null> {
    if (!trackId) return null;
    if (mongoose.Types.ObjectId.isValid(trackId)) {
      const found = await Track.findById(trackId);
      if (found) return found;
    }
    return await Track.findOne({
      $or: [
        { fileHash: trackId },
        { driveAudioFileId: trackId },
        { originalFileName: trackId },
        { title: new RegExp(`^${trackId}$`, 'i') },
      ],
    });
  }

  /**
   * Resolves the local absolute path for an audio file if present in the staging folder.
   */
  resolveLocalAudioPath(track: ITrack): string | null {
    const candidates = [
      path.join(env.localImportFolder, 'audio', track.originalFileName),
      path.join(env.localImportFolder, track.originalFileName),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  /**
   * Generates playback authorization metadata and streaming details for a track.
   */
  async getPlaybackInfo(trackId: string, reqBaseUrl: string) {
    const track = await this.findTrackSafely(trackId);
    if (!track) {
      throw new Error(`Track '${trackId}' not found`);
    }

    const streamUrl = `${reqBaseUrl}/api/v1/tracks/${track._id}/stream`;

    return {
      trackId: track._id.toString(),
      title: track.title,
      artist: track.artist,
      durationSeconds: track.durationSeconds,
      codec: track.codec,
      lossless: track.lossless,
      sampleRate: track.sampleRate,
      bitDepth: track.bitDepth,
      bitrate: track.bitrate,
      mimeType: track.mimeType,
      streamUrl,
      source: this.resolveLocalAudioPath(track) ? 'local-storage' : 'google-drive',
      hasLyrics: track.hasLyrics,
    };
  }

  /**
   * Parses HTTP Range header according to RFC 7233.
   */
  parseRangeHeader(rangeHeader: string | undefined, totalSize: number): {
    isRange: boolean;
    isValid: boolean;
    start: number;
    end: number;
    chunkSize: number;
  } {
    if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
      return {
        isRange: false,
        isValid: true,
        start: 0,
        end: Math.max(0, totalSize - 1),
        chunkSize: totalSize,
      };
    }

    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    let start: number;
    let end: number;

    if (parts[0] === '') {
      const suffixLength = Number.parseInt(parts[1], 10);
      if (Number.isNaN(suffixLength) || suffixLength <= 0) {
        return { isRange: true, isValid: false, start: 0, end: 0, chunkSize: 0 };
      }
      start = Math.max(0, totalSize - suffixLength);
      end = totalSize - 1;
    } else {
      start = Number.parseInt(parts[0], 10);
      end = parts[1] ? Number.parseInt(parts[1], 10) : totalSize - 1;
    }

    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start < 0 ||
      start >= totalSize ||
      end >= totalSize ||
      start > end
    ) {
      return { isRange: true, isValid: false, start: 0, end: 0, chunkSize: 0 };
    }

    return {
      isRange: true,
      isValid: true,
      start,
      end,
      chunkSize: end - start + 1,
    };
  }

  /**
   * Streams audio with HTTP Range support (206 Partial Content) for seeking, pausing, and scrubbing.
   * Streams chunks directly to the client without buffering entire files in memory.
   */
  async streamTrackAudio(trackId: string, req: Request, res: Response): Promise<void> {
    try {
      const track = await this.findTrackSafely(trackId);
      if (!track) {
        sendError(res, 'Track not found', 404, 'NOT_FOUND');
        return;
      }

      // Add CORS headers so web browser can play and seek audio
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Authorization, Content-Type');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');

      const localPath = this.resolveLocalAudioPath(track);

      if (localPath) {
        // ─── Local File Streaming with HTTP Range Requests ─────────────────────
        const stat = fs.statSync(localPath);
        const totalSize = stat.size;
        const parsed = this.parseRangeHeader(req.headers.range, totalSize);

        if (parsed.isRange) {
          if (!parsed.isValid) {
            res.status(416).setHeader('Content-Range', `bytes */${totalSize}`).end();
            return;
          }

          const fileStream = fs.createReadStream(localPath, { start: parsed.start, end: parsed.end });

          res.writeHead(206, {
            'Content-Range': `bytes ${parsed.start}-${parsed.end}/${totalSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': parsed.chunkSize,
            'Content-Type': track.mimeType || 'audio/flac',
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
          });

          fileStream.pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': totalSize,
            'Content-Type': track.mimeType || 'audio/flac',
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
          });

          fs.createReadStream(localPath).pipe(res);
        }
        return;
      }

      // ─── Google Drive Audio Streaming ────────────────────────────────────────
      if (track.driveAudioFileId) {
        try {
          const drive = await googleDriveService.getClient();
          const range = req.headers.range;

          const requestHeaders: Record<string, string> = {};
          if (range) {
            requestHeaders.Range = range;
          }

          const driveRes = await drive.files.get(
            { fileId: track.driveAudioFileId, alt: 'media' },
            { responseType: 'stream', headers: requestHeaders }
          );

          res.setHeader('Content-Type', track.mimeType || 'audio/flac');
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Cache-Control', 'private, max-age=1800');

          if (driveRes.headers['content-range']) {
            res.status(206);
            res.setHeader('Content-Range', driveRes.headers['content-range'] as string);
          }
          if (driveRes.headers['content-length']) {
            res.setHeader('Content-Length', driveRes.headers['content-length'] as string);
          }

          driveRes.data.on('error', (streamErr: any) => {
            logger.error(`Error in Google Drive audio stream for track ${trackId}:`, streamErr);
            if (!res.headersSent) {
              sendError(res, 'Stream error from Google Drive', 502, 'STREAM_ERROR');
            }
          });

          driveRes.data.pipe(res);
          return;
        } catch (err: any) {
          logger.error(`Failed to stream track ${trackId} from Google Drive`, err);
          if (!res.headersSent) {
            sendError(res, 'Could not stream audio asset from storage', 502, 'STREAM_FAILED');
          }
          return;
        }
      }

      sendError(res, 'Audio file asset not found', 404, 'ASSET_NOT_FOUND');
    } catch (err: any) {
      logger.error(`Unexpected error in streamTrackAudio for track ${trackId}:`, err);
      if (!res.headersSent) {
        sendError(res, err.message || 'Streaming failed', 500, 'STREAM_ERROR');
      }
    }
  }

  /**
   * Streams track artwork image from Google Drive or local storage.
   */
  async streamArtwork(trackId: string, req: Request, res: Response): Promise<void> {
    try {
      const track = await this.findTrackSafely(trackId);
      if (!track) {
        sendError(res, 'Track not found', 404, 'TRACK_NOT_FOUND');
        return;
      }

      if (track.driveArtworkFileId) {
        try {
          const drive = await googleDriveService.getClient();
          const driveRes = await drive.files.get(
            { fileId: track.driveArtworkFileId, alt: 'media' },
            { responseType: 'stream' }
          );

          res.setHeader('Content-Type', driveRes.headers['content-type'] || 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          driveRes.data.on('error', (err: any) => {
            logger.error(`Error in Drive artwork stream for track ${trackId}:`, err);
            if (!res.headersSent) {
              sendError(res, 'Stream error for artwork', 502, 'STREAM_ERROR');
            }
          });
          driveRes.data.pipe(res);
          return;
        } catch (err: any) {
          logger.error(`Failed to stream artwork from Drive for track ${trackId}:`, err);
        }
      }

      sendError(res, 'Artwork not found', 404, 'ARTWORK_NOT_FOUND');
    } catch (err: any) {
      logger.error(`Error in streamArtwork for track ${trackId}:`, err);
      if (!res.headersSent) {
        sendError(res, err.message || 'Artwork retrieval failed', 500, 'ARTWORK_ERROR');
      }
    }
  }
}

export const playbackService = new PlaybackService();
