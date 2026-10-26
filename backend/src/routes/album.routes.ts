import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { Album } from '../models/album.model.js';
import { formatTrackResponse } from './track.routes.js';
import { sendSuccess, sendError, getParam } from '../utils/response.js';

const router = Router();

/**
 * GET /api/v1/albums
 * List albums with pagination.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (req.query.q) {
      filter.titleNormalized = new RegExp((req.query.q as string).toLowerCase().trim(), 'i');
    }

    const [albums, total] = await Promise.all([
      Album.find(filter)
        .sort({ releaseYear: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('artists', 'name artworkUrl')
        .populate('genres', 'name'),
      Album.countDocuments(filter),
    ]);

    return sendSuccess(res, albums, {
      page,
      limit,
      total,
      hasMore: skip + albums.length < total,
    });
  } catch (err: any) {
    return sendError(res, err.message, 500, 'ALBUMS_FETCH_FAILED');
  }
});

/**
 * GET /api/v1/albums/:id
 * Album details with populated track list.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid album ID', 400, 'INVALID_ID');
    }

    const album = await Album.findById(id)
      .populate('artists', 'name artworkUrl bio')
      .populate('genres', 'name')
      .populate({
        path: 'tracks',
        populate: [
          { path: 'primaryArtist', select: 'name' },
          { path: 'genreRefs', select: 'name' },
        ],
      });

    if (!album) {
      return sendError(res, 'Album not found', 404, 'NOT_FOUND');
    }

    const obj = album.toObject();
    if (Array.isArray(obj.tracks)) {
      obj.tracks = obj.tracks.map(formatTrackResponse);
    }

    return sendSuccess(res, obj);
  } catch (err: any) {
    return sendError(res, err.message, 500, 'ALBUM_FETCH_FAILED');
  }
});

export default router;
