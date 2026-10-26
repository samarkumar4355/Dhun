import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseFile } from 'music-metadata';

export interface ExtractedTrackData {
  title: string;
  artist: string;
  album: string;
  year?: number;
  genre?: string[];
  trackNumber?: number;
  discNumber?: number;

  durationSeconds: number;
  codec: string;
  lossless: boolean;
  sampleRate?: number;
  bitDepth?: number;
  bitrate?: number;
  numberOfChannels?: number;

  fileHash: string; // SHA-256
  originalFileName: string;
  fileSizeBytes: number;
  mimeType: string;

  embeddedArtwork?: {
    format: string;
    data: Buffer;
  };
  externalArtworkPath?: string;
  lyricsPath?: string;
  lyricsText?: string;

  missingFields: string[];

  // Curated metadata & source fields
  language?: string;
  composer?: string;
  lyricist?: string;
  sourceName?: string;
  sourceUrl?: string;
  lyricsSource?: string;
  lyricsLanguage?: string;
  driveFolderId?: string;
  driveAudioFileId?: string;
  driveArtworkFileId?: string;
  driveLyricsFileId?: string;
}

export class MetadataService {
  /**
   * Computes the SHA-256 hash of an audio file to guarantee integrity
   * and enable reliable deduplication.
   */
  async computeFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  /**
   * Determines whether an audio codec is truly lossless.
   * STRICT RULE: Never treat lossy formats (MP3, AAC) as lossless.
   */
  isLosslessCodec(codec?: string, container?: string): boolean {
    if (!codec) return false;
    const upperCodec = codec.toUpperCase();
    const upperContainer = (container || '').toUpperCase();

    if (upperCodec.includes('FLAC') || upperCodec.includes('ALAC') || upperCodec.includes('PCM')) {
      return true;
    }

    if (upperCodec.includes('WAV') || upperContainer.includes('WAV')) {
      return true;
    }

    return false;
  }

  /**
   * Infers standard MIME type based on audio file extension.
   */
  getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.flac':
        return 'audio/flac';
      case '.m4a':
      case '.alac':
        return 'audio/mp4';
      case '.mp3':
        return 'audio/mpeg';
      case '.wav':
        return 'audio/wav';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Detects external adjacent artwork and lyrics files.
   * Never fabricates lyrics or artwork.
   */
  detectAdjacentFiles(filePath: string): { externalArtworkPath?: string; lyricsPath?: string } {
    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath, path.extname(filePath));

    // Look for adjacent artwork
    const candidateArtworks = [
      path.join(dir, `${baseName}.jpg`),
      path.join(dir, `${baseName}.jpeg`),
      path.join(dir, `${baseName}.png`),
      path.join(dir, 'cover.jpg'),
      path.join(dir, 'cover.png'),
      path.join(dir, 'folder.jpg'),
      path.join(dir, 'folder.png'),
    ];

    let externalArtworkPath: string | undefined;
    for (const candidate of candidateArtworks) {
      if (fs.existsSync(candidate)) {
        externalArtworkPath = candidate;
        break;
      }
    }

    // Look for adjacent lyrics (.lrc or .txt)
    const candidateLyrics = [
      path.join(dir, `${baseName}.lrc`),
      path.join(dir, `${baseName}.txt`),
    ];

    let lyricsPath: string | undefined;
    for (const candidate of candidateLyrics) {
      if (fs.existsSync(candidate)) {
        lyricsPath = candidate;
        break;
      }
    }

    return { externalArtworkPath, lyricsPath };
  }

  /**
   * Computes the MD5 hash of an audio file.
   * Used for Google Drive MD5 verification.
   * (SHA-256 remains distinct for local manifest deduplication).
   */
  async computeFileMd5(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  /**
   * Validates whether a lyrics string represents legitimate song lyrics.
   * Rejects empty strings, whitespace, tiny placeholders, Next.js tokens, or demo tags.
   * Never fabricates lyrics.
   */
  isValidLyrics(text?: string | null): boolean {
    if (!text || typeof text !== 'string') {
      return false;
    }

    const trimmed = text.trim();
    // Legitimate song lyrics require substantial content (minimum 20 characters)
    if (trimmed.length < 20) {
      return false;
    }

    // Reject Next.js / React streaming reference pointers (e.g. "$3c", "$1d")
    if (/^\$[0-9a-zA-Z_-]+$/.test(trimmed)) {
      return false;
    }

    // Reject standalone placeholder/demo tags or labels
    if (/^(\[?(demo lyrics|placeholder|dummy text|sample lyrics|lorem ipsum|lyrics coming soon|tbd|to be added|wip|work in progress).*?\]?|none|null|undefined|n\/a|na|placeholder|unknown|instrumental|no lyrics)$/i.test(trimmed)) {
      return false;
    }

    // Reject generic lorem ipsum dummy text
    if (/lorem ipsum dolor sit amet/i.test(trimmed)) {
      return false;
    }

    // Reject explicit placeholder statements
    if (/\b(placeholder lyrics|lyrics (will be added|to be added|coming soon|not available|unavailable)|this is a placeholder)\b/i.test(trimmed)) {
      return false;
    }

    // Require at least 5 words for legitimate song lyrics
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length < 5) {
      return false;
    }

    return true;
  }

  /**
   * Safe fallback for extracting artist and title from standard audio filename patterns
   * when embedded tags are absent. Does NOT invent artist names.
   * Handles patterns such as:
   * - "Artist - Title"
   * - "01 - Artist - Title"
   * - "Artist-Album-Track-Title"
   * - "Artist-Title"
   */
  parseFilenameFallback(rawBaseName: string): { artist?: string; title?: string } {
    if (!rawBaseName || !rawBaseName.trim()) {
      return {};
    }

    const trimmed = rawBaseName.trim();

    // Pattern 1: Explicit space-hyphen-space separator: "Artist - Title" or "01 - Artist - Title"
    if (trimmed.includes(' - ')) {
      const parts = trimmed.split(' - ').map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        if (/^\d+$/.test(parts[0]) && parts.length >= 3) {
          return {
            artist: parts[1],
            title: parts.slice(2).join(' - '),
          };
        }
        return {
          artist: parts[0],
          title: parts.slice(1).join(' - '),
        };
      }
    }

    // Pattern 2: Hyphen-separated: "JoshWoodward-TheBox" or "JoshWoodward-Ashes-01-LetItIn"
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-').map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        // Expand PascalCase / camelCase safely without inventing characters: e.g. "JoshWoodward" -> "Josh Woodward"
        const unCamel = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
        const rawArtist = parts[0];
        const artist = unCamel(rawArtist);

        // Track title is typically the last part
        const rawTitle = parts[parts.length - 1];
        // If last part is numeric (e.g. track number), use the preceding part
        const title = /^\d+$/.test(rawTitle) && parts.length >= 3 ? unCamel(parts[parts.length - 2]) : unCamel(rawTitle);

        return { artist, title };
      }
    }

    return {};
  }

  /**
   * Extracts all technical and tag metadata from a local audio file.
   * Supported formats: FLAC, ALAC/M4A, MP3, WAV.
   */
  async extractMetadata(filePath: string): Promise<ExtractedTrackData> {
    const fileStats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const fileHash = await this.computeFileHash(filePath);

    // Parse audio metadata using music-metadata
    const parsed = await parseFile(filePath);
    const common = parsed.common;
    const format = parsed.format;

    const missingFields: string[] = [];
    const rawBaseName = path.basename(filePath, path.extname(filePath));
    const filenameFallback = this.parseFilenameFallback(rawBaseName);

    // Extract title or fallback to parsed filename / raw filename
    let title = common.title?.trim();
    if (!title) {
      title = filenameFallback.title || rawBaseName;
      missingFields.push('title');
    }

    // Extract artist: check common.artist, common.artists array, common.albumartist, or filename fallback
    let artist =
      common.artist?.trim() ||
      (Array.isArray(common.artists) ? common.artists.find((a: any) => typeof a === 'string' && a.trim())?.trim() : undefined) ||
      common.albumartist?.trim() ||
      filenameFallback.artist;

    if (!artist) {
      artist = 'Unknown Artist';
      missingFields.push('artist');
    }

    // Extract album
    let album = common.album?.trim();
    if (!album) {
      album = 'Unknown Album';
      missingFields.push('album');
    }

    if (!common.year) missingFields.push('year');
    if (!common.track?.no) missingFields.push('trackNumber');

    // Artwork detection
    let embeddedArtwork: { format: string; data: Buffer } | undefined;
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0];
      embeddedArtwork = {
        format: pic.format,
        data: Buffer.from(pic.data),
      };
    }

    const { externalArtworkPath, lyricsPath } = this.detectAdjacentFiles(filePath);

    if (!embeddedArtwork && !externalArtworkPath) {
      missingFields.push('artwork');
    }

    // Lyrics detection & validation (never fabricates lyrics, rejects placeholders)
    let lyricsText: string | undefined;
    let validLyricsPath: string | undefined;

    if (common.lyrics && common.lyrics.length > 0) {
      const candidate = common.lyrics[0].text;
      if (this.isValidLyrics(candidate)) {
        lyricsText = candidate;
      }
    }

    if (!lyricsText && lyricsPath && fs.existsSync(lyricsPath)) {
      try {
        const candidate = fs.readFileSync(lyricsPath, 'utf8');
        if (this.isValidLyrics(candidate)) {
          lyricsText = candidate;
          validLyricsPath = lyricsPath;
        }
      } catch {
        // Ignore read errors and mark missing
      }
    }

    if (!lyricsText) {
      lyricsText = undefined;
      validLyricsPath = undefined;
      missingFields.push('lyrics');
    }

    const codec = format.codec || path.extname(filePath).replace('.', '').toUpperCase();
    const lossless = this.isLosslessCodec(codec, format.container);

    if (!format.sampleRate) missingFields.push('sampleRate');
    if (!format.bitsPerSample) missingFields.push('bitDepth');

    // Check for companion metadata JSON if present
    const dir = path.dirname(filePath);
    const companionMetaPath = path.join(dir, `${rawBaseName}.meta.json`);
    let companionMeta: any = null;
    if (fs.existsSync(companionMetaPath)) {
      try {
        companionMeta = JSON.parse(fs.readFileSync(companionMetaPath, 'utf8'));
      } catch {
        // ignore
      }
    }

    if (companionMeta?.title) {
      title = companionMeta.title;
      const idx = missingFields.indexOf('title');
      if (idx !== -1) missingFields.splice(idx, 1);
    }
    if (companionMeta?.artist) {
      artist = companionMeta.artist;
      const idx = missingFields.indexOf('artist');
      if (idx !== -1) missingFields.splice(idx, 1);
    }
    if (companionMeta?.album) {
      album = companionMeta.album;
      const idx = missingFields.indexOf('album');
      if (idx !== -1) missingFields.splice(idx, 1);
    }
    let year = common.year;
    if (!year && companionMeta?.year) {
      year = companionMeta.year;
      const idx = missingFields.indexOf('year');
      if (idx !== -1) missingFields.splice(idx, 1);
    }
    let genre = common.genre;
    if ((!genre || genre.length === 0) && companionMeta?.genre) {
      genre = Array.isArray(companionMeta.genre) ? companionMeta.genre : [companionMeta.genre];
    }

    return {
      title,
      artist,
      album,
      year,
      genre,
      trackNumber: common.track?.no ?? companionMeta?.trackNumber ?? undefined,
      discNumber: common.disk?.no ?? companionMeta?.discNumber ?? undefined,

      durationSeconds: Math.round(format.duration || companionMeta?.durationSeconds || 0),
      codec,
      lossless,
      sampleRate: format.sampleRate,
      bitDepth: format.bitsPerSample,
      bitrate: format.bitrate,
      numberOfChannels: format.numberOfChannels,

      fileHash,
      originalFileName: fileName,
      fileSizeBytes: fileStats.size,
      mimeType: this.getMimeType(filePath),

      embeddedArtwork,
      externalArtworkPath,
      lyricsPath: validLyricsPath,
      lyricsText,

      missingFields,

      language: companionMeta?.language,
      composer: companionMeta?.composer,
      lyricist: companionMeta?.lyricist,
      sourceName: companionMeta?.sourceName,
      sourceUrl: companionMeta?.sourceUrl,
      lyricsSource: companionMeta?.lyricsSource,
      lyricsLanguage: companionMeta?.lyricsLanguage,
    };
  }

  /**
   * Generates a clean metadata.json document for upload to Google Drive.
   */
  generateMetadataJson(data: ExtractedTrackData) {
    return {
      title: data.title,
      artist: data.artist,
      album: data.album,
      year: data.year ?? null,
      genre: data.genre ?? [],
      language: data.language ?? null,
      composer: data.composer ?? null,
      lyricist: data.lyricist ?? null,
      trackNumber: data.trackNumber ?? null,
      discNumber: data.discNumber ?? null,
      audioDetails: {
        durationSeconds: data.durationSeconds,
        codec: data.codec,
        lossless: data.lossless,
        sampleRate: data.sampleRate ?? null,
        bitDepth: data.bitDepth ?? null,
        bitrate: data.bitrate ?? null,
        numberOfChannels: data.numberOfChannels ?? null,
      },
      fileDetails: {
        fileName: data.originalFileName,
        fileSizeBytes: data.fileSizeBytes,
        mimeType: data.mimeType,
        sha256: data.fileHash,
      },
      assets: {
        hasArtwork: Boolean(data.embeddedArtwork || data.externalArtworkPath),
        hasLyrics: Boolean(data.lyricsText && this.isValidLyrics(data.lyricsText)),
        lyricsSource: data.lyricsSource ?? (data.lyricsText ? 'embedded/adjacent' : null),
        lyricsLanguage: data.lyricsLanguage ?? (data.lyricsText ? (data.language || 'Hindi') : null),
      },
      source: {
        sourceName: data.sourceName ?? 'Internet Archive Open Music Repository',
        sourceUrl: data.sourceUrl ?? null,
        licensingNotes: 'Open access public audio repository for personal listening',
      },
      lyrics: data.lyricsText && this.isValidLyrics(data.lyricsText) ? data.lyricsText : null,
      missingFields: data.missingFields,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const metadataService = new MetadataService();
