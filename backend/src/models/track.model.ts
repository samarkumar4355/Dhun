import mongoose, { Schema, type Document } from 'mongoose';

/**
 * Interface representing a Track in Dhun.
 * Strictly stores metadata and Google Drive file references.
 * Audio bytes are NEVER stored in MongoDB.
 */
export interface ITrack extends Document {
  // Basic Metadata
  title: string;
  artist: string;
  album: string;
  year?: number;
  genre?: string[];
  trackNumber?: number;
  discNumber?: number;

  // Audio Technical Details (Lossless preservation)
  durationSeconds: number;
  codec: string;              // e.g. 'FLAC', 'ALAC', 'MPEG 1 Layer 3', 'PCM'
  lossless: boolean;          // true for FLAC, ALAC, WAV; false for MP3/AAC
  sampleRate?: number;        // e.g. 44100, 96000, 192000
  bitDepth?: number;          // e.g. 16, 24, 32
  bitrate?: number;           // in bps
  numberOfChannels?: number;  // 1 (mono), 2 (stereo)

  // Integrity & Deduplication
  fileHash: string;           // SHA-256 of original audio file bytes
  originalFileName: string;
  fileSizeBytes: number;
  mimeType: string;

  // Google Drive Reference IDs
  driveFolderId: string;        // Subfolder ID for this track
  driveAudioFileId: string;     // Google Drive file ID of the original audio file
  driveArtworkFileId?: string;  // Google Drive file ID for cover art
  driveLyricsFileId?: string;   // Google Drive file ID for lyrics file (.lrc / .txt)
  driveMetadataFileId?: string; // Google Drive file ID for metadata.json

  // Flags for available assets
  hasArtwork: boolean;
  hasLyrics: boolean;

  // Song Lyrics (Preserved string or null if unavailable)
  lyrics: string | null;

  // Missing fields tracking
  missingFields: string[];

  // Relational references
  primaryArtist?: mongoose.Types.ObjectId;
  featuredArtists?: mongoose.Types.ObjectId[];
  albumRef?: mongoose.Types.ObjectId;
  genreRefs?: mongoose.Types.ObjectId[];

  durationMs?: number;
  playCount: number;
  isExplicit: boolean;
  language?: string;
  description?: string;

  importedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TrackSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    artist: { type: String, required: true, trim: true, index: true },
    album: { type: String, required: true, trim: true, index: true },
    year: { type: Number },
    genre: [{ type: String, trim: true }],
    trackNumber: { type: Number },
    discNumber: { type: Number },

    // Relational references
    primaryArtist: { type: Schema.Types.ObjectId, ref: 'Artist', index: true },
    featuredArtists: [{ type: Schema.Types.ObjectId, ref: 'Artist' }],
    albumRef: { type: Schema.Types.ObjectId, ref: 'Album', index: true },
    genreRefs: [{ type: Schema.Types.ObjectId, ref: 'Genre', index: true }],

    durationSeconds: { type: Number, required: true },
    durationMs: { type: Number },
    codec: { type: String, required: true },
    lossless: { type: Boolean, required: true, default: false },
    sampleRate: { type: Number },
    bitDepth: { type: Number },
    bitrate: { type: Number },
    numberOfChannels: { type: Number },

    fileHash: { type: String, required: true, unique: true, index: true },
    originalFileName: { type: String, required: true },
    fileSizeBytes: { type: Number, required: true },
    mimeType: { type: String, required: true },

    driveFolderId: { type: String, required: true },
    driveAudioFileId: { type: String, required: true },
    driveArtworkFileId: { type: String },
    driveLyricsFileId: { type: String },
    driveMetadataFileId: { type: String },

    hasArtwork: { type: Boolean, default: false },
    hasLyrics: { type: Boolean, default: false },
    lyrics: { type: String, default: null },

    playCount: { type: Number, default: 0 },
    isExplicit: { type: Boolean, default: false },
    language: { type: String, trim: true },
    description: { type: String, trim: true },

    missingFields: [{ type: String }],
    importedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

TrackSchema.index({ title: 'text', artist: 'text', album: 'text' });

export const Track = mongoose.models.Track || mongoose.model<ITrack>('Track', TrackSchema);
