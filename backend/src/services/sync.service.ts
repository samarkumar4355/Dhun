import mongoose from 'mongoose';
import { Track } from '../models/track.model.js';
import { logger } from '../utils/logger.js';

export interface DownloadManifestItem {
  trackId: string;
  title: string;
  artist: string;
  album: string;
  originalFileName: string;
  fileSizeBytes: number;
  mimeType: string;
  fileHash: string; // SHA-256 for verification
  codec: string;
  lossless: boolean;
  sampleRate?: number;
  bitDepth?: number;
  durationSeconds: number;
  downloadUrl: string;
  lyrics: string | null;
  hasLyrics: boolean;
  hasArtwork: boolean;
  versionTimestamp: string;
}

export class SyncService {
  /**
   * Retrieves tracks added or updated since a given ISO timestamp.
   * Enables bandwidth-efficient delta sync for offline mobile apps.
   */
  async getCatalogChanges(sinceIsoString?: string, limit = 100) {
    const query: any = {};
    if (sinceIsoString) {
      const sinceDate = new Date(sinceIsoString);
      if (!Number.isNaN(sinceDate.getTime())) {
        query.updatedAt = { $gt: sinceDate };
      }
    }

    const changedTracks = await Track.find(query)
      .sort({ updatedAt: 1 })
      .limit(limit)
      .populate('primaryArtist', 'name')
      .populate('albumRef', 'title')
      .populate('genreRefs', 'name');

    const totalChanged = await Track.countDocuments(query);

    return {
      tracks: changedTracks,
      count: changedTracks.length,
      totalChanged,
      serverTime: new Date().toISOString(),
    };
  }

  /**
   * Generates a verified offline download manifest for a list of track IDs.
   * Includes file checksums, download streams, technical audio specs, and lyrics.
   */
  async generateDownloadManifest(trackIds: string[], reqBaseUrl: string): Promise<DownloadManifestItem[]> {
    const validObjectIds = trackIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const tracks = await Track.find({ _id: { $in: validObjectIds } });

    const manifest: DownloadManifestItem[] = tracks.map((track) => ({
      trackId: track._id.toString(),
      title: track.title,
      artist: track.artist,
      album: track.album,
      originalFileName: track.originalFileName,
      fileSizeBytes: track.fileSizeBytes,
      mimeType: track.mimeType,
      fileHash: track.fileHash,
      codec: track.codec,
      lossless: track.lossless,
      sampleRate: track.sampleRate,
      bitDepth: track.bitDepth,
      durationSeconds: track.durationSeconds,
      downloadUrl: `${reqBaseUrl}/api/v1/tracks/${track._id}/stream`,
      lyrics: track.lyrics ?? null,
      hasLyrics: Boolean(track.hasLyrics && track.lyrics),
      hasArtwork: Boolean(track.hasArtwork),
      versionTimestamp: track.updatedAt ? track.updatedAt.toISOString() : new Date().toISOString(),
    }));

    logger.info(`Generated download manifest for ${manifest.length} tracks.`);
    return manifest;
  }
}

export const syncService = new SyncService();
