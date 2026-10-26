import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { Track } from '../models/track.model.js';
import { Artist } from '../models/artist.model.js';
import { Album } from '../models/album.model.js';
import { catalogService } from '../services/catalog.service.js';
import { musicImporter } from '../workers/importer.js';
import { logger } from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/response.js';

const router = Router();

// Protect all admin endpoints
router.use(requireAuth, requireAdmin);

/**
 * GET /api/v1/admin/import/status
 * View import status, total catalog records, missing fields, and warnings.
 */
router.get('/import/status', async (req: Request, res: Response) => {
  try {
    const manifest = musicImporter.loadManifest();
    const [totalTracks, missingLyrics, missingArtwork, totalArtists, totalAlbums] = await Promise.all([
      Track.countDocuments(),
      Track.countDocuments({ hasLyrics: false }),
      Track.countDocuments({ hasArtwork: false }),
      Artist.countDocuments(),
      Album.countDocuments(),
    ]);

    return sendSuccess(res, {
      manifestEntries: manifest.size,
      totalTracks,
      missingLyrics,
      missingArtwork,
      totalArtists,
      totalAlbums,
    });
  } catch (err: any) {
    return sendError(res, err.message, 500, 'ADMIN_STATUS_FAILED');
  }
});

/**
 * POST /api/v1/admin/catalog/reconcile
 * Backfills unlinked tracks into canonical Artist, Album, and Genre records.
 */
router.post('/catalog/reconcile', async (req: Request, res: Response) => {
  try {
    const result = await catalogService.backfillExistingTracks();
    return sendSuccess(res, {
      message: 'Catalog reconciliation complete',
      totalUnlinkedFound: result.total,
      updated: result.updated,
    });
  } catch (err: any) {
    return sendError(res, err.message, 500, 'RECONCILIATION_FAILED');
  }
});

const updateTrackSchema = z.object({
  title: z.string().optional(),
  artist: z.string().optional(),
  album: z.string().optional(),
  genre: z.array(z.string()).optional(),
  year: z.number().optional(),
  lyrics: z.string().nullable().optional(),
});

/**
 * PATCH /api/v1/admin/tracks/:id
 * Allows administrators to correct inaccurate metadata safely.
 */
router.patch('/tracks/:id', validate({ body: updateTrackSchema }), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const track = await Track.findById(id);
    if (!track) {
      return sendError(res, 'Track not found', 404, 'NOT_FOUND');
    }

    if (req.body.title) track.title = req.body.title.trim();
    if (req.body.artist) track.artist = req.body.artist.trim();
    if (req.body.album) track.album = req.body.album.trim();
    if (req.body.genre) track.genre = req.body.genre;
    if (req.body.year) track.year = req.body.year;
    if (req.body.lyrics !== undefined) {
      track.lyrics = req.body.lyrics;
      track.hasLyrics = Boolean(req.body.lyrics && req.body.lyrics.trim().length > 0);
    }

    await track.save();
    // Re-link to canonical catalog
    await catalogService.linkTrackToCatalog(track);

    logger.info(`Admin updated track metadata: ${track.title} by ${req.user?.email}`);
    return sendSuccess(res, track);
  } catch (err: any) {
    return sendError(res, err.message, 500, 'UPDATE_FAILED');
  }
});

const mergeArtistsSchema = z.object({
  sourceArtistId: z.string().min(1, 'sourceArtistId is required'),
  targetArtistId: z.string().min(1, 'targetArtistId is required'),
});

/**
 * POST /api/v1/admin/artists/merge
 * Safely merges a source duplicate artist into a target canonical artist.
 */
router.post('/artists/merge', validate({ body: mergeArtistsSchema }), async (req: Request, res: Response) => {
  try {
    const { sourceArtistId, targetArtistId } = req.body;
    if (sourceArtistId === targetArtistId) {
      return sendError(res, 'Source and target artist cannot be identical', 400, 'BAD_REQUEST');
    }

    const [sourceArtist, targetArtist] = await Promise.all([
      Artist.findById(sourceArtistId),
      Artist.findById(targetArtistId),
    ]);

    if (!sourceArtist || !targetArtist) {
      return sendError(res, 'Source or target artist not found', 404, 'NOT_FOUND');
    }

    // 1. Re-point primary artists on tracks
    const primaryUpdated = await Track.updateMany(
      { primaryArtist: sourceArtist._id },
      { $set: { primaryArtist: targetArtist._id, artist: targetArtist.name } }
    );

    // 2. Re-point featured artists on tracks
    await Track.updateMany(
      { featuredArtists: sourceArtist._id },
      { $set: { 'featuredArtists.$': targetArtist._id } }
    );

    // 3. Re-point albums
    const albumsUpdated = await Album.updateMany(
      { artists: sourceArtist._id },
      { $set: { 'artists.$': targetArtist._id } }
    );

    // 4. Remove duplicate source artist
    await Artist.deleteOne({ _id: sourceArtist._id });

    logger.info(
      `Merged artist "${sourceArtist.name}" (${sourceArtist._id}) into "${targetArtist.name}" (${targetArtist._id}) by ${req.user?.email}`
    );

    return sendSuccess(res, {
      message: `Artist "${sourceArtist.name}" merged into "${targetArtist.name}" successfully`,
      tracksUpdated: primaryUpdated.modifiedCount,
      albumsUpdated: albumsUpdated.modifiedCount,
    });
  } catch (err: any) {
    return sendError(res, err.message, 500, 'MERGE_FAILED');
  }
});

export default router;
