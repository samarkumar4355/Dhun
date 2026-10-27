import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { Track } from '../models/track.model.js';
import { playbackService } from '../services/playback.service.js';
import { recommendationService } from '../services/recommendation.service.js';
import { sendSuccess, sendError } from '../utils/response.js';

const router = Router();

/**
 * Helper to format a Track document into a clean API response
 */
export function formatTrackResponse(track: any) {
  const doc = track.toObject ? track.toObject() : track;
  return {
    id: doc._id ? doc._id.toString() : doc.id,
    title: doc.title,
    artist: doc.artist,
    album: doc.album ?? null,
    year: doc.year ?? null,
    genre: doc.genre ?? null,
    trackNumber: doc.trackNumber ?? null,
    discNumber: doc.discNumber ?? null,

    // Relational references
    primaryArtist: doc.primaryArtist
      ? typeof doc.primaryArtist === 'object' && doc.primaryArtist._id
        ? { id: doc.primaryArtist._id.toString(), name: doc.primaryArtist.name, artworkUrl: doc.primaryArtist.artworkUrl }
        : doc.primaryArtist.toString()
      : null,
    featuredArtists: Array.isArray(doc.featuredArtists)
      ? doc.featuredArtists.map((a: any) =>
          typeof a === 'object' && a._id ? { id: a._id.toString(), name: a.name } : a.toString()
        )
      : [],
    albumRef: doc.albumRef
      ? typeof doc.albumRef === 'object' && doc.albumRef._id
        ? { id: doc.albumRef._id.toString(), title: doc.albumRef.title, artworkUrl: doc.albumRef.artworkUrl }
        : doc.albumRef.toString()
      : null,
    genreRefs: Array.isArray(doc.genreRefs)
      ? doc.genreRefs.map((g: any) =>
          typeof g === 'object' && g._id ? { id: g._id.toString(), name: g.name } : g.toString()
        )
      : [],

    duration: doc.duration ?? doc.durationSeconds ?? (doc.durationMs ? doc.durationMs / 1000 : null),
    durationSeconds: doc.durationSeconds ?? doc.duration ?? (doc.durationMs ? doc.durationMs / 1000 : null),
    durationMs: doc.durationMs || (doc.durationSeconds ? Math.round(doc.durationSeconds * 1000) : (doc.duration ? Math.round(doc.duration * 1000) : null)),
    codec: doc.codec ?? doc.format ?? null,
    lossless: Boolean(doc.lossless ?? doc.isLossless),
    isLossless: Boolean(doc.lossless ?? doc.isLossless),
    quality: {
      isLossless: Boolean(doc.lossless ?? doc.isLossless),
      format: doc.codec ?? doc.format ?? null,
      bitDepth: doc.bitDepth ?? null,
      sampleRate: doc.sampleRate ?? null,
      bitrate: doc.bitrate ?? null,
      channels: doc.numberOfChannels ?? doc.channels ?? null,
    },
    sampleRate: doc.sampleRate ?? null,
    bitDepth: doc.bitDepth ?? null,
    bitrate: doc.bitrate ?? null,
    numberOfChannels: doc.numberOfChannels ?? doc.channels ?? null,
    fileHash: doc.fileHash,
    originalFileName: doc.originalFileName,
    fileSizeBytes: doc.fileSizeBytes,
    mimeType: doc.mimeType,
    driveFolderId: doc.driveFolderId,
    driveAudioFileId: doc.driveAudioFileId,
    driveArtworkFileId: doc.driveArtworkFileId ?? null,
    driveLyricsFileId: doc.driveLyricsFileId ?? null,
    driveMetadataFileId: doc.driveMetadataFileId ?? null,
    hasArtwork: Boolean(doc.hasArtwork),
    hasLyrics: Boolean(doc.hasLyrics && doc.lyrics),
    // Full lyrics text preserving line breaks and verse spacing, or null if unavailable
    lyrics: doc.lyrics ?? null,
    playCount: doc.playCount || 0,
    isExplicit: Boolean(doc.isExplicit),
    language: doc.language ?? null,
    missingFields: doc.missingFields ?? [],
    importedAt: doc.importedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * GET /api/v1/tracks (and /tracks)
 * Supports pagination, search, and filtering by lossless, artist, album, and genre.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: 'Database not connected',
        tracks: [],
      });
    }

    const page = Math.max(1, Number.parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (req.query.lossless !== undefined) {
      filter.lossless = req.query.lossless === 'true';
    }
    if (req.query.genre) {
      const gStr = String(req.query.genre).trim();
      const escaped = gStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const orConditions: any[] = [{ genre: new RegExp(escaped, 'i') }];
      if (mongoose.Types.ObjectId.isValid(gStr)) {
        orConditions.push({ genreRefs: new mongoose.Types.ObjectId(gStr) });
      }
      filter.$or = orConditions;
    }
    if (req.query.artist) {
      filter.artist = new RegExp(req.query.artist as string, 'i');
    }
    if (req.query.album) {
      filter.album = new RegExp(req.query.album as string, 'i');
    }

    const [tracks, total] = await Promise.all([
      Track.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('primaryArtist', 'name artworkUrl')
        .populate('albumRef', 'title artworkUrl')
        .populate('genreRefs', 'name'),
      Track.countDocuments(filter),
    ]);

    const formatted = tracks.map(formatTrackResponse);

    // Provide backwards compatible structure while adding standard meta
    res.json({
      success: true,
      count: formatted.length,
      total,
      page,
      limit,
      hasMore: skip + formatted.length < total,
      tracks: formatted,
      data: formatted,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/tracks/:id/playback
 * Returns playback metadata and authorized stream URL.
 */
router.get('/:id/playback', async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const playbackInfo = await playbackService.getPlaybackInfo(id, baseUrl);
    return sendSuccess(res, playbackInfo);
  } catch (err: any) {
    return sendError(res, err.message, 404, 'PLAYBACK_INFO_FAILED');
  }
});

/**
 * GET /api/v1/tracks/:id/stream
 * Streams track audio with HTTP Range support for scrubbing, seeking, and offline buffering.
 */
router.get('/:id/stream', async (req: Request, res: Response) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  await playbackService.streamTrackAudio(id, req, res);
});

/**
 * GET /api/v1/tracks/:id/artwork
 * Streams track album artwork image from storage.
 */
router.get('/:id/artwork', async (req: Request, res: Response) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  await playbackService.streamArtwork(id, req, res);
});

/**
 * GET /api/v1/tracks/:id/lyrics
 * Retrieves the lyrics document for a track.
 */
router.get('/:id/lyrics', async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    let track = null;
    if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
      track = await Track.findById(id);
    }
    if (!track) {
      track = await Track.findOne({
        $or: [{ fileHash: id }, { driveAudioFileId: id }],
      });
    }

    if (!track) {
      return sendError(res, 'Track not found', 404, 'NOT_FOUND');
    }

    const lyricsText = track.lyrics || null;
    return sendSuccess(res, {
      trackId: track._id.toString(),
      title: track.title,
      artist: track.artist,
      hasLyrics: Boolean(track.hasLyrics && lyricsText),
      lyrics: lyricsText,
      lineCount: lyricsText ? lyricsText.split('\n').length : 0,
      verseCount: lyricsText ? lyricsText.split(/\n\s*\n/).length : 0,
    });
  } catch (err: any) {
    return sendError(res, err.message, 500, 'LYRICS_FETCH_FAILED');
  }
});

/**
 * GET /api/v1/tracks/:id/related
 * Returns tracks related by genre, artist, or album.
 */
router.get('/:id/related', async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit as string, 10) || 10));

    const related = await recommendationService.getRelatedTracks(id, limit);
    return sendSuccess(res, related.map(formatTrackResponse));
  } catch (err: any) {
    return sendError(res, err.message, 404, 'RELATED_FETCH_FAILED');
  }
});

/**
 * GET /api/v1/tracks/:id (and /tracks/:id)
 * Returns song details for a specific track by MongoDB _id, fileHash, or driveAudioFileId.
 * Includes preserved lyrics string or null if unavailable.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id) {
      return res.status(400).json({ error: 'Track ID is required' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    let track = null;

    if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
      track = await Track.findById(id)
        .populate('primaryArtist', 'name artworkUrl')
        .populate('albumRef', 'title artworkUrl')
        .populate('genreRefs', 'name');
    }

    if (!track) {
      track = await Track.findOne({
        $or: [
          { fileHash: id },
          { driveAudioFileId: id },
          { originalFileName: id },
        ],
      })
        .populate('primaryArtist', 'name artworkUrl')
        .populate('albumRef', 'title artworkUrl')
        .populate('genreRefs', 'name');
    }

    if (!track) {
      return res.status(404).json({
        error: 'Track not found',
        lyrics: null,
      });
    }

    res.json(formatTrackResponse(track));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
