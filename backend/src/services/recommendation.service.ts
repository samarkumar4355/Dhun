import mongoose from 'mongoose';
import { Track, type ITrack } from '../models/track.model.js';
import { Favorite } from '../models/favorite.model.js';
import { ListeningHistory } from '../models/history.model.js';

export class RecommendationService {
  /**
   * Retrieves related tracks based on shared artist, album, or genres.
   */
  async getRelatedTracks(trackId: string, limit = 10): Promise<ITrack[]> {
    const track = await Track.findById(trackId);
    if (!track) {
      throw new Error('Track not found');
    }

    const query: any = {
      _id: { $ne: track._id },
    };

    const criteria: any[] = [];
    if (track.primaryArtist) {
      criteria.push({ primaryArtist: track.primaryArtist });
    }
    if (track.albumRef) {
      criteria.push({ albumRef: track.albumRef });
    }
    if (track.genreRefs && track.genreRefs.length > 0) {
      criteria.push({ genreRefs: { $in: track.genreRefs } });
    }

    if (criteria.length > 0) {
      query.$or = criteria;
    }

    const related = await Track.find(query)
      .limit(limit)
      .populate('primaryArtist', 'name artworkUrl')
      .populate('albumRef', 'title artworkUrl')
      .populate('genreRefs', 'name');

    // If not enough related tracks, fill with popular or recently added tracks
    if (related.length < limit) {
      const remainingLimit = limit - related.length;
      const existingIds = [track._id, ...related.map((t) => t._id)];
      const fallbacks = await Track.find({ _id: { $nin: existingIds } })
        .sort({ playCount: -1, createdAt: -1 })
        .limit(remainingLimit)
        .populate('primaryArtist', 'name artworkUrl')
        .populate('albumRef', 'title artworkUrl')
        .populate('genreRefs', 'name');

      related.push(...fallbacks);
    }

    return related;
  }

  /**
   * Generates explainable, rule-based recommendations for an authenticated user.
   */
  async getRecommendationsForUser(userId: string, limit = 20) {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 1. Gather user's favorite tracks and recent history
    const [favorites, recentPlays] = await Promise.all([
      Favorite.find({ user: userObjectId }).limit(30).populate('track'),
      ListeningHistory.find({ user: userObjectId }).sort({ playedAt: -1 }).limit(30).populate('track'),
    ]);

    const favoriteTracks = favorites.map((f: any) => f.track).filter(Boolean);
    const historyTracks = recentPlays.map((h: any) => h.track).filter(Boolean);
    const listenedTrackIds = new Set([
      ...favoriteTracks.map((t) => t._id.toString()),
      ...historyTracks.map((t) => t._id.toString()),
    ]);

    // 2. Extract preferred genres and artists
    const genreCounts = new Map<string, number>();
    const artistCounts = new Map<string, number>();

    for (const t of [...favoriteTracks, ...historyTracks]) {
      if (t.primaryArtist) {
        const aId = t.primaryArtist.toString();
        artistCounts.set(aId, (artistCounts.get(aId) || 0) + 1);
      }
      if (t.genreRefs && Array.isArray(t.genreRefs)) {
        for (const g of t.genreRefs) {
          const gId = g.toString();
          genreCounts.set(gId, (genreCounts.get(gId) || 0) + 1);
        }
      }
    }

    const topArtists = Array.from(artistCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => new mongoose.Types.ObjectId(id));

    const topGenres = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => new mongoose.Types.ObjectId(id));

    // 3. Build recommendation query
    const matchCriteria: any[] = [];
    if (topArtists.length > 0) {
      matchCriteria.push({ primaryArtist: { $in: topArtists.slice(0, 3) } });
    }
    if (topGenres.length > 0) {
      matchCriteria.push({ genreRefs: { $in: topGenres.slice(0, 3) } });
    }

    let recommendations: ITrack[] = [];
    if (matchCriteria.length > 0) {
      recommendations = await Track.find({
        $or: matchCriteria,
        _id: { $nin: Array.from(listenedTrackIds).map((id) => new mongoose.Types.ObjectId(id)) },
      })
        .limit(limit)
        .populate('primaryArtist', 'name artworkUrl')
        .populate('albumRef', 'title artworkUrl')
        .populate('genreRefs', 'name');
    }

    // Fallback: If user has no history or few recommendations, return popular & lossless tracks
    if (recommendations.length < limit) {
      const remainingLimit = limit - recommendations.length;
      const excludeIds = [
        ...recommendations.map((t) => t._id),
        ...Array.from(listenedTrackIds).map((id) => new mongoose.Types.ObjectId(id)),
      ];

      const catalogPicks = await Track.find({ _id: { $nin: excludeIds } })
        .sort({ lossless: -1, playCount: -1, createdAt: -1 })
        .limit(remainingLimit)
        .populate('primaryArtist', 'name artworkUrl')
        .populate('albumRef', 'title artworkUrl')
        .populate('genreRefs', 'name');

      recommendations.push(...catalogPicks);
    }

    return recommendations;
  }

  /**
   * Generates curated discovery collections for browsing.
   */
  async getDiscoverCollections() {
    const [losslessGems, recentlyAdded, popularTracks] = await Promise.all([
      Track.find({ lossless: true })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('primaryArtist', 'name artworkUrl')
        .populate('albumRef', 'title artworkUrl')
        .populate('genreRefs', 'name'),
      Track.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('primaryArtist', 'name artworkUrl')
        .populate('albumRef', 'title artworkUrl')
        .populate('genreRefs', 'name'),
      Track.find()
        .sort({ playCount: -1, createdAt: -1 })
        .limit(10)
        .populate('primaryArtist', 'name artworkUrl')
        .populate('albumRef', 'title artworkUrl')
        .populate('genreRefs', 'name'),
    ]);

    return {
      collections: [
        {
          id: 'lossless-gems',
          title: 'Lossless Hi-Res Gems',
          description: 'Preserved bit-perfect FLAC and WAV tracks in master quality',
          tracks: losslessGems,
        },
        {
          id: 'recently-added',
          title: 'Recently Added to Dhun',
          description: 'Fresh music ingested into your personal library',
          tracks: recentlyAdded,
        },
        {
          id: 'most-played',
          title: 'Most Played',
          description: 'Frequently enjoyed songs in your catalog',
          tracks: popularTracks,
        },
      ],
    };
  }
}

export const recommendationService = new RecommendationService();
