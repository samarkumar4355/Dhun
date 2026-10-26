import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { Artist } from '../models/artist.model.js';
import { Track } from '../models/track.model.js';
import { Album } from '../models/album.model.js';
import { formatTrackResponse } from './track.routes.js';
import { sendSuccess, sendError, getParam } from '../utils/response.js';

const router = Router();

/**
 * GET /api/v1/artists
 * List artists with pagination and search.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (req.query.q) {
      filter.nameNormalized = new RegExp((req.query.q as string).toLowerCase().trim(), 'i');
    }

    const [artists, total] = await Promise.all([
      Artist.find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .populate('genres', 'name'),
      Artist.countDocuments(filter),
    ]);

    return sendSuccess(res, artists, {
      page,
      limit,
      total,
      hasMore: skip + artists.length < total,
    });
  } catch (err: any) {
    return sendError(res, err.message, 500, 'ARTISTS_FETCH_FAILED');
  }
});

/**
 * GET /api/v1/artists/:id
 * Artist details.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    let artist = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      artist = await Artist.findById(id).populate('genres', 'name');
    }
    if (!artist) {
      artist = await Artist.findOne({
        nameNormalized: (id || '').toLowerCase().trim(),
      }).populate('genres', 'name');
    }

    if (!artist) {
      return sendError(res, 'Artist not found', 404, 'NOT_FOUND');
    }

    return sendSuccess(res, artist);
  } catch (err: any) {
    return sendError(res, err.message, 500, 'ARTIST_FETCH_FAILED');
  }
});

/**
 * GET /api/v1/artists/:id/tracks
 * Tracks by this artist.
 */
router.get('/:id/tracks', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    let artistId: any = id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const found = await Artist.findOne({ nameNormalized: id.toLowerCase().trim() });
      if (!found) return sendError(res, 'Artist not found', 404, 'NOT_FOUND');
      artistId = found._id;
    }

    const tracks = await Track.find({
      $or: [{ primaryArtist: artistId }, { featuredArtists: artistId }],
    })
      .sort({ createdAt: -1 })
      .populate('primaryArtist', 'name artworkUrl')
      .populate('albumRef', 'title artworkUrl')
      .populate('genreRefs', 'name');

    return sendSuccess(res, tracks.map(formatTrackResponse));
  } catch (err: any) {
    return sendError(res, err.message, 500, 'TRACKS_FETCH_FAILED');
  }
});

/**
 * GET /api/v1/artists/:id/albums
 * Albums by this artist.
 */
router.get('/:id/albums', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    let artistId: any = id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const found = await Artist.findOne({ nameNormalized: id.toLowerCase().trim() });
      if (!found) return sendError(res, 'Artist not found', 404, 'NOT_FOUND');
      artistId = found._id;
    }

    const albums = await Album.find({ artists: artistId })
      .sort({ releaseYear: -1, createdAt: -1 })
      .populate('artists', 'name artworkUrl')
      .populate('genres', 'name');

    return sendSuccess(res, albums);
  } catch (err: any) {
    return sendError(res, err.message, 500, 'ALBUMS_FETCH_FAILED');
  }
});

export default router;
