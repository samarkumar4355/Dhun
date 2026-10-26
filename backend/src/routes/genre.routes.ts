import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { Genre } from '../models/genre.model.js';
import { Track } from '../models/track.model.js';
import { formatTrackResponse } from './track.routes.js';
import { sendSuccess, sendError, getParam } from '../utils/response.js';

const router = Router();

/**
 * GET /api/v1/genres
 * List genres.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const genres = await Genre.find().sort({ name: 1 }).populate('parentGenre', 'name');
    return sendSuccess(res, genres);
  } catch (err: any) {
    return sendError(res, err.message, 500, 'GENRES_FETCH_FAILED');
  }
});

/**
 * GET /api/v1/genres/:id
 * Genre details.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    let genre = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      genre = await Genre.findById(id).populate('parentGenre', 'name');
    }
    if (!genre) {
      genre = await Genre.findOne({ nameNormalized: id.toLowerCase().trim() }).populate('parentGenre', 'name');
    }

    if (!genre) {
      return sendError(res, 'Genre not found', 404, 'NOT_FOUND');
    }

    return sendSuccess(res, genre);
  } catch (err: any) {
    return sendError(res, err.message, 500, 'GENRE_FETCH_FAILED');
  }
});

/**
 * GET /api/v1/genres/:id/tracks
 * Tracks belonging to this genre.
 */
router.get('/:id/tracks', async (req: Request, res: Response) => {
  try {
    const id = getParam(req.params.id);
    let genreId: any = id;
    let genreName = '';

    if (mongoose.Types.ObjectId.isValid(id)) {
      const g = await Genre.findById(id);
      if (g) genreName = g.name;
    } else {
      const g = await Genre.findOne({ nameNormalized: id.toLowerCase().trim() });
      if (g) {
        genreId = g._id;
        genreName = g.name;
      }
    }

    const query: any = {
      $or: [{ genreRefs: genreId }],
    };
    if (genreName) {
      query.$or.push({ genre: new RegExp(genreName, 'i') });
    }

    const tracks = await Track.find(query)
      .sort({ createdAt: -1 })
      .populate('primaryArtist', 'name artworkUrl')
      .populate('albumRef', 'title artworkUrl')
      .populate('genreRefs', 'name');

    return sendSuccess(res, tracks.map(formatTrackResponse));
  } catch (err: any) {
    return sendError(res, err.message, 500, 'GENRE_TRACKS_FAILED');
  }
});

export default router;
