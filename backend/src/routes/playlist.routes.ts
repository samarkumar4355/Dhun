import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { libraryService } from '../services/library.service.js';
import { formatTrackResponse } from './track.routes.js';
import { sendSuccess, sendError, getParam } from '../utils/response.js';

const router = Router();

const createPlaylistSchema = z.object({
  title: z.string().min(1, 'Playlist title is required').max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
});

/**
 * POST /api/v1/playlists
 * Create a new playlist.
 */
router.post(
  '/',
  requireAuth,
  validate({ body: createPlaylistSchema }),
  async (req: Request, res: Response) => {
    try {
      const playlist = await libraryService.createPlaylist(req.user!.userId, req.body);
      return sendSuccess(res, playlist, undefined, 201);
    } catch (err: any) {
      return sendError(res, err.message, 400, 'CREATE_FAILED');
    }
  }
);

/**
 * GET /api/v1/playlists/:id
 * Retrieve playlist details and tracks. Accessible publicly if public, otherwise requires owner.
 */
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    const currentUserId = req.user?.userId;
    const playlist = await libraryService.getPlaylistById(id, currentUserId);

    const obj = playlist.toObject();
    if (Array.isArray(obj.tracks)) {
      obj.tracks = obj.tracks.map((item: any) => ({
        position: item.position,
        addedAt: item.addedAt,
        track: item.track ? formatTrackResponse(item.track) : null,
      }));
    }

    return sendSuccess(res, obj);
  } catch (err: any) {
    const status = err.message.includes('private') ? 403 : err.message.includes('not found') ? 404 : 500;
    return sendError(res, err.message, status, 'FETCH_FAILED');
  }
});

const updatePlaylistSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
  artworkUrl: z.string().url().optional(),
});

/**
 * PATCH /api/v1/playlists/:id
 * Update playlist title, description, or visibility.
 */
router.patch(
  '/:id',
  requireAuth,
  validate({ body: updatePlaylistSchema }),
  async (req: Request, res: Response) => {
    try {
      const id = getParam(req.params.id);
      const updated = await libraryService.updatePlaylist(id, req.user!.userId, req.body);
      return sendSuccess(res, updated);
    } catch (err: any) {
      const status = err.message.includes('permission') ? 403 : err.message.includes('not found') ? 404 : 400;
      return sendError(res, err.message, status, 'UPDATE_FAILED');
    }
  }
);

/**
 * DELETE /api/v1/playlists/:id
 * Delete a playlist.
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    await libraryService.deletePlaylist(id, req.user!.userId);
    return sendSuccess(res, { message: 'Playlist deleted successfully' });
  } catch (err: any) {
    const status = err.message.includes('permission') ? 403 : err.message.includes('not found') ? 404 : 400;
    return sendError(res, err.message, status, 'DELETE_FAILED');
  }
});

const addTrackSchema = z.object({
  trackId: z.string().min(1, 'Track ID is required'),
});

/**
 * POST /api/v1/playlists/:id/tracks
 * Add a track to playlist.
 */
router.post(
  '/:id/tracks',
  requireAuth,
  validate({ body: addTrackSchema }),
  async (req: Request, res: Response) => {
    try {
      const id = getParam(req.params.id);
      const updated = await libraryService.addTrackToPlaylist(id, req.user!.userId, req.body.trackId);
      return sendSuccess(res, updated, undefined, 201);
    } catch (err: any) {
      const status = err.message.includes('permission') ? 403 : err.message.includes('not found') ? 404 : 400;
      return sendError(res, err.message, status, 'ADD_TRACK_FAILED');
    }
  }
);

/**
 * DELETE /api/v1/playlists/:id/tracks/:trackId
 * Remove a track from playlist.
 */
router.delete('/:id/tracks/:trackId', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    const trackId = getParam(req.params.trackId);
    const updated = await libraryService.removeTrackFromPlaylist(id, req.user!.userId, trackId);
    return sendSuccess(res, updated);
  } catch (err: any) {
    const status = err.message.includes('permission') ? 403 : err.message.includes('not found') ? 404 : 400;
    return sendError(res, err.message, status, 'REMOVE_TRACK_FAILED');
  }
});

const reorderSchema = z.object({
  trackIds: z.array(z.string()).min(1, 'trackIds array is required'),
});

/**
 * PATCH /api/v1/playlists/:id/order
 * Reorder tracks with explicit positions.
 */
router.patch(
  '/:id/order',
  requireAuth,
  validate({ body: reorderSchema }),
  async (req: Request, res: Response) => {
    try {
      const id = getParam(req.params.id);
      const updated = await libraryService.reorderPlaylist(id, req.user!.userId, req.body.trackIds);
      return sendSuccess(res, updated);
    } catch (err: any) {
      const status = err.message.includes('permission') ? 403 : err.message.includes('not found') ? 404 : 400;
      return sendError(res, err.message, status, 'REORDER_FAILED');
    }
  }
);

export default router;
