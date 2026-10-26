import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.middleware.js';
import { syncService } from '../services/sync.service.js';
import { sendSuccess, sendError } from '../utils/response.js';

const router = Router();

/**
 * GET /api/v1/sync/changes
 * Returns tracks added or updated since a specific ISO timestamp for delta sync.
 */
router.get('/changes', async (req: Request, res: Response) => {
  try {
    const since = req.query.since as string | undefined;
    const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit as string, 10) || 100));

    const result = await syncService.getCatalogChanges(since, limit);
    return sendSuccess(res, result.tracks, {
      count: result.count,
      totalChanged: result.totalChanged,
      serverTime: result.serverTime,
      since: since || null,
    });
  } catch (err: any) {
    return sendError(res, err.message, 500, 'SYNC_CHANGES_FAILED');
  }
});

const downloadManifestSchema = z.object({
  trackIds: z.array(z.string()).min(1, 'At least one trackId is required'),
});

/**
 * POST /api/v1/sync/download-manifest
 * Generates verified offline download manifests for a batch of tracks.
 */
router.post(
  '/download-manifest',
  validate({ body: downloadManifestSchema }),
  async (req: Request, res: Response) => {
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const manifest = await syncService.generateDownloadManifest(req.body.trackIds, baseUrl);
      return sendSuccess(res, manifest, { total: manifest.length });
    } catch (err: any) {
      return sendError(res, err.message, 500, 'MANIFEST_GENERATION_FAILED');
    }
  }
);

export default router;
