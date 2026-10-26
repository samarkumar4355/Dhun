import mongoose, { type Types } from 'mongoose';
import { Artist, type IArtist } from '../models/artist.model.js';
import { Album, type IAlbum } from '../models/album.model.js';
import { Genre, type IGenre } from '../models/genre.model.js';
import { Track, type ITrack } from '../models/track.model.js';
import { logger } from '../utils/logger.js';

export class CatalogService {
  /**
   * Normalizes strings for consistent, case-insensitive, punctuation-stripped matching.
   */
  normalizeName(name: string): string {
    if (!name) return '';
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ') // Strip special punctuation
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Parses artist strings for featured collaborators safely without fabricating.
   * e.g. "Josh Woodward feat. Jane Doe" -> primary: "Josh Woodward", featured: ["Jane Doe"]
   */
  parseArtistNames(artistStr: string): { primary: string; featured: string[] } {
    if (!artistStr || artistStr.trim().toLowerCase() === 'unknown artist') {
      return { primary: 'Unknown Artist', featured: [] };
    }

    const trimmed = artistStr.trim();

    // Check for parenthesized collaborator: e.g. "Major Lazer (feat. MO & DJ Snake)"
    const parenMatch = trimmed.match(/^(.*?)\s*\((?:feat\.?|ft\.?|featuring)\s+([^)]+)\)$/i);
    if (parenMatch) {
      const primary = parenMatch[1].trim();
      const featured = parenMatch[2]
        .split(/[,/&]/)
        .map((s) => s.trim())
        .filter(Boolean);
      return { primary: primary || trimmed, featured };
    }

    const featMatch = trimmed.match(/^(.*?)\s+(?:feat\.?|ft\.?|featuring)\s+(.*)$/i);
    if (featMatch) {
      const primary = featMatch[1].trim();
      const featured = featMatch[2]
        .split(/[,/&]/)
        .map((s) => s.trim())
        .filter(Boolean);
      return { primary: primary || trimmed, featured };
    }

    return { primary: trimmed, featured: [] };
  }

  /**
   * Alias for parseArtistNames with descriptive property names.
   */
  parseArtistString(artistStr: string): { primaryArtist: string; featuredArtists: string[] } {
    const res = this.parseArtistNames(artistStr);
    return {
      primaryArtist: res.primary,
      featuredArtists: res.featured,
    };
  }

  /**
   * Finds or creates a canonical Artist entity conservatively.
   */
  async findOrCreateArtist(
    name: string,
    options: { genreIds?: Types.ObjectId[]; provenance?: string; bio?: string } = {}
  ): Promise<IArtist> {
    const canonicalName = name.trim() || 'Unknown Artist';
    const normalized = this.normalizeName(canonicalName);

    let artist = await Artist.findOne({ nameNormalized: normalized });
    if (!artist) {
      artist = await Artist.create({
        name: canonicalName,
        nameNormalized: normalized,
        genres: options.genreIds || [],
        provenance: options.provenance || 'tag-extracted',
        bio: options.bio,
      });
      logger.info(`Created canonical Artist: "${canonicalName}" (ID: ${artist._id})`);
    } else if (options.genreIds && options.genreIds.length > 0) {
      // Append any new genres without duplicates
      const existingGenreSet = new Set(artist.genres.map((id: any) => id.toString()));
      let updated = false;
      for (const gId of options.genreIds) {
        if (!existingGenreSet.has(gId.toString())) {
          artist.genres.push(gId);
          existingGenreSet.add(gId.toString());
          updated = true;
        }
      }
      if (updated) {
        await artist.save();
      }
    }

    return artist;
  }

  /**
   * Finds or creates a canonical Genre entity.
   */
  async findOrCreateGenre(name: string): Promise<IGenre> {
    const canonicalName = name.trim();
    const normalized = this.normalizeName(canonicalName);

    let genre = await Genre.findOne({ nameNormalized: normalized });
    if (!genre) {
      genre = await Genre.create({
        name: canonicalName,
        nameNormalized: normalized,
      });
      logger.info(`Created Genre: "${canonicalName}" (ID: ${genre._id})`);
    }
    return genre;
  }

  /**
   * Finds or creates a canonical Album entity.
   * Clearly distinguishes actual albums from unknown or provisional groupings.
   */
  async findOrCreateAlbum(
    title: string,
    primaryArtistId: Types.ObjectId,
    options: {
      releaseYear?: number;
      genreIds?: Types.ObjectId[];
      provenance?: string;
      artworkUrl?: string;
    } = {}
  ): Promise<IAlbum | null> {
    const rawTitle = title ? title.trim() : '';
    if (!rawTitle || rawTitle.toLowerCase() === 'unknown album') {
      return null;
    }

    const normalized = this.normalizeName(rawTitle);
    let album = await Album.findOne({
      titleNormalized: normalized,
      artists: primaryArtistId,
    });

    if (!album) {
      album = await Album.create({
        title: rawTitle,
        titleNormalized: normalized,
        artists: [primaryArtistId],
        tracks: [],
        releaseYear: options.releaseYear,
        artworkUrl: options.artworkUrl,
        genres: options.genreIds || [],
        albumType: 'album',
        provenance: options.provenance || 'tag-extracted',
      });
      logger.info(`Created Album: "${rawTitle}" (ID: ${album._id})`);
    }

    return album;
  }

  /**
   * Links a Track document to canonical Artist, Album, and Genre records.
   * Computes durationMs and preserves all original data.
   */
  async linkTrackToCatalog(track: ITrack): Promise<{
    primaryArtist: IArtist;
    featuredArtists: IArtist[];
    album: IAlbum | null;
    genres: IGenre[];
  }> {
    // 1. Resolve Genres
    const genreEntities: IGenre[] = [];
    if (track.genre && Array.isArray(track.genre)) {
      for (const gName of track.genre) {
        if (typeof gName === 'string' && gName.trim()) {
          const g = await this.findOrCreateGenre(gName);
          genreEntities.push(g);
        }
      }
    }
    const genreIds = genreEntities.map((g) => g._id as Types.ObjectId);

    // 2. Resolve Primary and Featured Artists
    const { primary, featured } = this.parseArtistNames(track.artist || 'Unknown Artist');
    const primaryArtist = await this.findOrCreateArtist(primary, { genreIds });

    const featuredArtists: IArtist[] = [];
    for (const featName of featured) {
      const featArtist = await this.findOrCreateArtist(featName, { genreIds });
      featuredArtists.push(featArtist);
    }

    // 3. Resolve Album
    const album = await this.findOrCreateAlbum(track.album, primaryArtist._id as Types.ObjectId, {
      releaseYear: track.year,
      genreIds,
    });

    // 4. Update Track references
    track.primaryArtist = primaryArtist._id as Types.ObjectId;
    track.featuredArtists = featuredArtists.map((a) => a._id as Types.ObjectId);
    if (album) {
      track.albumRef = album._id as Types.ObjectId;
      // Also register track inside album if not already present
      const trackIdStr = (track._id as Types.ObjectId).toString();
      if (!album.tracks.some((tId) => tId.toString() === trackIdStr)) {
        album.tracks.push(track._id as Types.ObjectId);
        await album.save();
      }
    }
    track.genreRefs = genreIds;
    track.durationMs = track.durationSeconds ? track.durationSeconds * 1000 : 0;

    await track.save();

    return {
      primaryArtist,
      featuredArtists,
      album,
      genres: genreEntities,
    };
  }

  /**
   * Backfills existing tracks that were imported prior to relational catalog schema.
   * Non-destructive migration that preserves all existing fields.
   */
  async backfillExistingTracks(): Promise<{ total: number; updated: number }> {
    if (mongoose.connection.readyState !== 1) {
      return { total: 0, updated: 0 };
    }

    const unlinkedTracks = await Track.find({
      $or: [
        { primaryArtist: { $exists: false } },
        { primaryArtist: null },
        { durationMs: { $exists: false } },
      ],
    });

    let updated = 0;
    for (const track of unlinkedTracks) {
      try {
        await this.linkTrackToCatalog(track);
        updated++;
      } catch (err: any) {
        logger.warn(`Could not link track ${track.title}: ${err.message}`);
      }
    }

    logger.info(`Backfill complete: ${updated}/${unlinkedTracks.length} tracks connected.`);
    return { total: unlinkedTracks.length, updated };
  }
}

export const catalogService = new CatalogService();
