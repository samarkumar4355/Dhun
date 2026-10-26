import mongoose, { type Types } from 'mongoose';
import { Favorite, type IFavorite } from '../models/favorite.model.js';
import { LibraryItem, type ILibraryItem } from '../models/library.model.js';
import { Playlist, type IPlaylist } from '../models/playlist.model.js';
import { ListeningHistory, type IListeningHistory } from '../models/history.model.js';
import { Track } from '../models/track.model.js';
import { logger } from '../utils/logger.js';

export class LibraryService {
  // ─── Favorites ─────────────────────────────────────────────────────────────

  async addFavorite(userId: string, trackId: string): Promise<IFavorite> {
    const track = await Track.findById(trackId);
    if (!track) {
      throw new Error('Track not found');
    }

    // Upsert to guarantee idempotency and avoid duplicate key errors
    const favorite = await Favorite.findOneAndUpdate(
      { user: new mongoose.Types.ObjectId(userId), track: new mongoose.Types.ObjectId(trackId) },
      { $setOnInsert: { addedAt: new Date() } },
      { upsert: true, new: true }
    );

    return favorite;
  }

  async removeFavorite(userId: string, trackId: string): Promise<boolean> {
    const result = await Favorite.deleteOne({
      user: new mongoose.Types.ObjectId(userId),
      track: new mongoose.Types.ObjectId(trackId),
    });
    return result.deletedCount > 0;
  }

  async getFavorites(userId: string, options: { page?: number; limit?: number } = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Favorite.find({ user: new mongoose.Types.ObjectId(userId) })
        .sort({ addedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'track',
          populate: [
            { path: 'primaryArtist', select: 'name artworkUrl' },
            { path: 'albumRef', select: 'title artworkUrl releaseYear' },
            { path: 'genreRefs', select: 'name' },
          ],
        }),
      Favorite.countDocuments({ user: new mongoose.Types.ObjectId(userId) }),
    ]);

    return {
      items: items.map((f) => ({
        id: f._id.toString(),
        addedAt: f.addedAt,
        track: f.track,
      })),
      page,
      limit,
      total,
      hasMore: skip + items.length < total,
    };
  }

  async isFavorite(userId: string, trackId: string): Promise<boolean> {
    const count = await Favorite.countDocuments({
      user: new mongoose.Types.ObjectId(userId),
      track: new mongoose.Types.ObjectId(trackId),
    });
    return count > 0;
  }

  // ─── User Saved Library ───────────────────────────────────────────────────

  async addToLibrary(userId: string, trackId: string): Promise<ILibraryItem> {
    const track = await Track.findById(trackId);
    if (!track) {
      throw new Error('Track not found');
    }

    const item = await LibraryItem.findOneAndUpdate(
      { user: new mongoose.Types.ObjectId(userId), track: new mongoose.Types.ObjectId(trackId) },
      { $setOnInsert: { addedAt: new Date() } },
      { upsert: true, new: true }
    );

    return item;
  }

  async removeFromLibrary(userId: string, trackId: string): Promise<boolean> {
    const result = await LibraryItem.deleteOne({
      user: new mongoose.Types.ObjectId(userId),
      track: new mongoose.Types.ObjectId(trackId),
    });
    return result.deletedCount > 0;
  }

  async getLibrary(userId: string, options: { page?: number; limit?: number } = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      LibraryItem.find({ user: new mongoose.Types.ObjectId(userId) })
        .sort({ addedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'track',
          populate: [
            { path: 'primaryArtist', select: 'name artworkUrl' },
            { path: 'albumRef', select: 'title artworkUrl releaseYear' },
            { path: 'genreRefs', select: 'name' },
          ],
        }),
      LibraryItem.countDocuments({ user: new mongoose.Types.ObjectId(userId) }),
    ]);

    return {
      items: items.map((l) => ({
        id: l._id.toString(),
        addedAt: l.addedAt,
        track: l.track,
      })),
      page,
      limit,
      total,
      hasMore: skip + items.length < total,
    };
  }

  // ─── Playlists ─────────────────────────────────────────────────────────────

  async createPlaylist(
    userId: string,
    data: { title: string; description?: string; isPublic?: boolean }
  ): Promise<IPlaylist> {
    const playlist = await Playlist.create({
      title: data.title.trim(),
      description: data.description?.trim(),
      owner: new mongoose.Types.ObjectId(userId),
      isPublic: data.isPublic ?? false,
      tracks: [],
      trackCount: 0,
      totalDurationSeconds: 0,
    });

    return playlist;
  }

  async getUserPlaylists(userId: string): Promise<IPlaylist[]> {
    return Playlist.find({ owner: new mongoose.Types.ObjectId(userId) }).sort({ createdAt: -1 });
  }

  async getPlaylistById(playlistId: string, currentUserId?: string): Promise<IPlaylist> {
    const playlist = await Playlist.findById(playlistId)
      .populate('owner', 'displayName')
      .populate({
        path: 'tracks.track',
        populate: [
          { path: 'primaryArtist', select: 'name artworkUrl' },
          { path: 'albumRef', select: 'title artworkUrl' },
          { path: 'genreRefs', select: 'name' },
        ],
      });

    if (!playlist) {
      throw new Error('Playlist not found');
    }

    if (!playlist.isPublic && (!currentUserId || playlist.owner._id.toString() !== currentUserId)) {
      throw new Error('This playlist is private');
    }

    return playlist;
  }

  async updatePlaylist(
    playlistId: string,
    userId: string,
    data: { title?: string; description?: string; isPublic?: boolean; artworkUrl?: string }
  ): Promise<IPlaylist> {
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      throw new Error('Playlist not found');
    }

    if (playlist.owner.toString() !== userId) {
      throw new Error('You do not have permission to edit this playlist');
    }

    if (data.title !== undefined) playlist.title = data.title.trim();
    if (data.description !== undefined) playlist.description = data.description.trim();
    if (data.isPublic !== undefined) playlist.isPublic = data.isPublic;
    if (data.artworkUrl !== undefined) playlist.artworkUrl = data.artworkUrl;

    await playlist.save();
    return playlist;
  }

  async deletePlaylist(playlistId: string, userId: string): Promise<boolean> {
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      throw new Error('Playlist not found');
    }

    if (playlist.owner.toString() !== userId) {
      throw new Error('You do not have permission to delete this playlist');
    }

    await Playlist.deleteOne({ _id: playlistId });
    return true;
  }

  async addTrackToPlaylist(playlistId: string, userId: string, trackId: string): Promise<IPlaylist> {
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      throw new Error('Playlist not found');
    }

    if (playlist.owner.toString() !== userId) {
      throw new Error('You do not have permission to modify this playlist');
    }

    const track = await Track.findById(trackId);
    if (!track) {
      throw new Error('Track not found');
    }

    const nextPosition = playlist.tracks.length;
    playlist.tracks.push({
      track: new mongoose.Types.ObjectId(trackId),
      addedAt: new Date(),
      position: nextPosition,
    });

    playlist.trackCount = playlist.tracks.length;
    playlist.totalDurationSeconds += track.durationSeconds || 0;

    await playlist.save();
    return playlist;
  }

  async removeTrackFromPlaylist(playlistId: string, userId: string, trackId: string): Promise<IPlaylist> {
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      throw new Error('Playlist not found');
    }

    if (playlist.owner.toString() !== userId) {
      throw new Error('You do not have permission to modify this playlist');
    }

    const track = await Track.findById(trackId);
    const durationToRemove = track?.durationSeconds || 0;

    const initialLen = playlist.tracks.length;
    playlist.tracks = playlist.tracks.filter((t: any) => t.track.toString() !== trackId);

    if (playlist.tracks.length < initialLen) {
      playlist.totalDurationSeconds = Math.max(0, playlist.totalDurationSeconds - durationToRemove);
    }

    // Re-index remaining positions
    playlist.tracks.forEach((t: any, idx: number) => {
      t.position = idx;
    });
    playlist.trackCount = playlist.tracks.length;

    await playlist.save();
    return playlist;
  }

  async reorderPlaylist(playlistId: string, userId: string, orderedTrackIds: string[]): Promise<IPlaylist> {
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      throw new Error('Playlist not found');
    }

    if (playlist.owner.toString() !== userId) {
      throw new Error('You do not have permission to modify this playlist');
    }

    const trackMap = new Map<string, any>();
    for (const t of playlist.tracks) {
      trackMap.set(t.track.toString(), t);
    }

    const reordered: any[] = [];
    for (let idx = 0; idx < orderedTrackIds.length; idx++) {
      const id = orderedTrackIds[idx];
      const item = trackMap.get(id);
      if (item) {
        item.position = idx;
        reordered.push(item);
        trackMap.delete(id);
      }
    }

    // Append any tracks that were not in the reordered list
    for (const remaining of trackMap.values()) {
      remaining.position = reordered.length;
      reordered.push(remaining);
    }

    playlist.tracks = reordered;
    playlist.trackCount = reordered.length;
    await playlist.save();
    return playlist;
  }

  // ─── Listening History ────────────────────────────────────────────────────

  async recordPlay(
    userId: string,
    trackId: string,
    data: { durationPlayedSeconds?: number; playbackPositionSeconds?: number; completed?: boolean }
  ): Promise<IListeningHistory> {
    const track = await Track.findById(trackId);
    if (!track) {
      throw new Error('Track not found');
    }

    // Increment track play count if completed or listened > 30s
    if (data.completed || (data.durationPlayedSeconds && data.durationPlayedSeconds >= 30)) {
      track.playCount = (track.playCount || 0) + 1;
      await track.save();
    }

    const history = await ListeningHistory.create({
      user: new mongoose.Types.ObjectId(userId),
      track: new mongoose.Types.ObjectId(trackId),
      playedAt: new Date(),
      durationPlayedSeconds: data.durationPlayedSeconds || 0,
      playbackPositionSeconds: data.playbackPositionSeconds || 0,
      completed: data.completed || false,
    });

    return history;
  }

  async getHistory(userId: string, options: { page?: number; limit?: number } = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      ListeningHistory.find({ user: new mongoose.Types.ObjectId(userId) })
        .sort({ playedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'track',
          populate: [
            { path: 'primaryArtist', select: 'name artworkUrl' },
            { path: 'albumRef', select: 'title artworkUrl' },
            { path: 'genreRefs', select: 'name' },
          ],
        }),
      ListeningHistory.countDocuments({ user: new mongoose.Types.ObjectId(userId) }),
    ]);

    return {
      items: items.map((h) => ({
        id: h._id.toString(),
        playedAt: h.playedAt,
        durationPlayedSeconds: h.durationPlayedSeconds,
        playbackPositionSeconds: h.playbackPositionSeconds,
        completed: h.completed,
        track: h.track,
      })),
      page,
      limit,
      total,
      hasMore: skip + items.length < total,
    };
  }

  async clearHistory(userId: string): Promise<boolean> {
    await ListeningHistory.deleteMany({ user: new mongoose.Types.ObjectId(userId) });
    return true;
  }
}

export const libraryService = new LibraryService();
