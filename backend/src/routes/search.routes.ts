import { Router, type Request, type Response } from 'express';
import { Track } from '../models/track.model.js';
import { Artist } from '../models/artist.model.js';
import { Album } from '../models/album.model.js';
import { Genre } from '../models/genre.model.js';
import { Playlist } from '../models/playlist.model.js';
import { formatTrackResponse } from './track.routes.js';
import { sendSuccess, sendError } from '../utils/response.js';

const router = Router();

/**
 * GET /api/v1/search
 * Unified music search across tracks, artists, albums, genres, and playlists.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q) {
      return sendSuccess(res, {
        tracks: [],
        artists: [],
        albums: [],
        genres: [],
        playlists: [],
      });
    }

    const type = (req.query.type as string || 'all').toLowerCase();
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit as string, 10) || 10));
    const losslessOnly = req.query.lossless === 'true';

    const regex = new RegExp(q, 'i');

    const searchTracks = async () => {
      const filter: any = {
        $or: [
          { title: regex },
          { artist: regex },
          { album: regex },
        ],
      };
      if (losslessOnly) {
        filter.lossless = true;
      }
      const results = await Track.find(filter)
        .limit(limit)
        .populate('primaryArtist', 'name artworkUrl')
        .populate('albumRef', 'title artworkUrl')
        .populate('genreRefs', 'name');
      return results.map(formatTrackResponse);
    };

    const searchArtists = async () => {
      return Artist.find({ name: regex }).limit(limit).populate('genres', 'name');
    };

    const searchAlbums = async () => {
      return Album.find({ title: regex })
        .limit(limit)
        .populate('artists', 'name artworkUrl')
        .populate('genres', 'name');
    };

    const searchGenres = async () => {
      return Genre.find({ name: regex }).limit(limit);
    };

    const searchPlaylists = async () => {
      return Playlist.find({ title: regex, isPublic: true })
        .limit(limit)
        .populate('owner', 'displayName');
    };

    const results: any = {};

    if (type === 'all' || type === 'tracks') {
      results.tracks = await searchTracks();
    }
    if (type === 'all' || type === 'artists') {
      results.artists = await searchArtists();
    }
    if (type === 'all' || type === 'albums') {
      results.albums = await searchAlbums();
    }
    if (type === 'all' || type === 'genres') {
      results.genres = await searchGenres();
    }
    if (type === 'all' || type === 'playlists') {
      results.playlists = await searchPlaylists();
    }

    return sendSuccess(res, results, { query: q, type, limit });
  } catch (err: any) {
    return sendError(res, err.message, 500, 'SEARCH_FAILED');
  }
});

export default router;
