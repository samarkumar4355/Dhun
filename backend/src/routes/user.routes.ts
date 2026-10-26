import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { libraryService } from '../services/library.service.js';
import { recommendationService } from '../services/recommendation.service.js';
import { formatTrackResponse } from './track.routes.js';
import { sendSuccess, sendError, getParam } from '../utils/response.js';

const router = Router();

// Protect all /me routes with JWT authentication
router.use(requireAuth);

// ─── Favorites ─────────────────────────────────────────────────────────────

router.get('/favorites', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit as string, 10) || 20));

    const result = await libraryService.getFavorites(req.user!.userId, { page, limit });
    const formatted = {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        track: item.track ? formatTrackResponse(item.track) : null,
      })),
    };

    return sendSuccess(res, formatted.items, {
      page: formatted.page,
      limit: formatted.limit,
      total: formatted.total,
      hasMore: formatted.hasMore,
    });
  } catch (err: any) {
    return sendError(res, err.message, 500, 'FAVORITES_FETCH_FAILED');
  }
});

router.put('/favorites/:trackId', async (req: Request, res: Response) => {
  try {
    const trackId = getParam(req.params.trackId);
    const favorite = await libraryService.addFavorite(req.user!.userId, trackId);
    return sendSuccess(res, { favorited: true, id: favorite._id.toString() });
  } catch (err: any) {
    return sendError(res, err.message, 400, 'FAVORITE_ADD_FAILED');
  }
});

router.delete('/favorites/:trackId', async (req: Request, res: Response) => {
  try {
    const trackId = getParam(req.params.trackId);
    const removed = await libraryService.removeFavorite(req.user!.userId, trackId);
    return sendSuccess(res, { favorited: false, removed });
  } catch (err: any) {
    return sendError(res, err.message, 400, 'FAVORITE_REMOVE_FAILED');
  }
});

// ─── Saved Library ─────────────────────────────────────────────────────────

router.get('/library', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit as string, 10) || 20));

    const result = await libraryService.getLibrary(req.user!.userId, { page, limit });
    const formatted = {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        track: item.track ? formatTrackResponse(item.track) : null,
      })),
    };

    return sendSuccess(res, formatted.items, {
      page: formatted.page,
      limit: formatted.limit,
      total: formatted.total,
      hasMore: formatted.hasMore,
    });
  } catch (err: any) {
    return sendError(res, err.message, 500, 'LIBRARY_FETCH_FAILED');
  }
});

router.post('/library/:trackId', async (req: Request, res: Response) => {
  try {
    const trackId = getParam(req.params.trackId);
    const item = await libraryService.addToLibrary(req.user!.userId, trackId);
    return sendSuccess(res, { saved: true, id: item._id.toString() }, undefined, 201);
  } catch (err: any) {
    return sendError(res, err.message, 400, 'LIBRARY_ADD_FAILED');
  }
});

router.delete('/library/:trackId', async (req: Request, res: Response) => {
  try {
    const trackId = getParam(req.params.trackId);
    const removed = await libraryService.removeFromLibrary(req.user!.userId, trackId);
    return sendSuccess(res, { saved: false, removed });
  } catch (err: any) {
    return sendError(res, err.message, 400, 'LIBRARY_REMOVE_FAILED');
  }
});

// ─── User Playlists ────────────────────────────────────────────────────────

router.get('/playlists', async (req: Request, res: Response) => {
  try {
    const playlists = await libraryService.getUserPlaylists(req.user!.userId);
    return sendSuccess(res, playlists);
  } catch (err: any) {
    return sendError(res, err.message, 500, 'PLAYLISTS_FETCH_FAILED');
  }
});

// ─── Listening History ────────────────────────────────────────────────────

const recordPlaySchema = z.object({
  trackId: z.string().min(1, 'Track ID is required'),
  durationPlayedSeconds: z.number().min(0).optional(),
  playbackPositionSeconds: z.number().min(0).optional(),
  completed: z.boolean().optional(),
});

router.post('/history', validate({ body: recordPlaySchema }), async (req: Request, res: Response) => {
  try {
    const { trackId, durationPlayedSeconds, playbackPositionSeconds, completed } = req.body;
    const history = await libraryService.recordPlay(req.user!.userId, trackId, {
      durationPlayedSeconds,
      playbackPositionSeconds,
      completed,
    });
    return sendSuccess(res, { recorded: true, id: history._id.toString() });
  } catch (err: any) {
    return sendError(res, err.message, 400, 'HISTORY_RECORD_FAILED');
  }
});

router.get('/history', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit as string, 10) || 20));

    const result = await libraryService.getHistory(req.user!.userId, { page, limit });
    const formatted = {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        track: item.track ? formatTrackResponse(item.track) : null,
      })),
    };

    return sendSuccess(res, formatted.items, {
      page: formatted.page,
      limit: formatted.limit,
      total: formatted.total,
      hasMore: formatted.hasMore,
    });
  } catch (err: any) {
    return sendError(res, err.message, 500, 'HISTORY_FETCH_FAILED');
  }
});

router.delete('/history', async (req: Request, res: Response) => {
  try {
    await libraryService.clearHistory(req.user!.userId);
    return sendSuccess(res, { message: 'Listening history cleared' });
  } catch (err: any) {
    return sendError(res, err.message, 500, 'HISTORY_CLEAR_FAILED');
  }
});

// ─── Recommendations ──────────────────────────────────────────────────────

router.get('/recommendations', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit as string, 10) || 20));
    const recommendations = await recommendationService.getRecommendationsForUser(req.user!.userId, limit);
    return sendSuccess(res, recommendations.map(formatTrackResponse));
  } catch (err: any) {
    return sendError(res, err.message, 500, 'RECOMMENDATIONS_FETCH_FAILED');
  }
});

export default router;
