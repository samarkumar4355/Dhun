// ─── Dhun Music Data Models ─────────────────────────────────────────

export type AudioFormat = 'FLAC' | 'ALAC' | 'WAV' | 'MP3' | 'AAC' | 'OGG' | 'AIFF';
export type AudioSource = 'local' | 'google-drive' | 'imported';
export type ImportStatus = 'pending' | 'importing' | 'completed' | 'failed' | 'cancelled';
export type MoodType = 'rainy-evening' | 'slow-morning' | 'midnight-drive' | 'deep-focus' | 'romance' | 'travel' | 'workout' | 'chill';
export type ThemeMode = 'system' | 'light' | 'dark' | 'auto';
export type TimePeriod = 'morning' | 'day' | 'evening' | 'night';

export interface Song {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  albumId: string;
  albumName: string;
  artwork: string | null;
  duration: number; // seconds
  format: AudioFormat;
  bitDepth: number;
  sampleRate: number; // Hz
  fileSize: number; // bytes
  source: AudioSource;
  isOffline: boolean;
  isFavorite: boolean;
  /** Plain-text lyrics. Undefined or empty means lyrics are unavailable. */
  lyrics?: string;
}

export interface Artist {
  id: string;
  name: string;
  artwork: string | null;
  languages: string[];
  genres: string[];
}

export interface Album {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  artwork: string | null;
  year: number;
  songCount: number;
}

export interface Playlist {
  id: string;
  name: string;
  artwork: string | null;
  songIds: string[];
  createdAt: string;
}

export interface MoodSession {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  artwork: string | null;
  moodType: MoodType;
  songIds: string[];
}

export interface ImportJob {
  id: string;
  sourceName: string;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  skippedFiles: number;
  status: ImportStatus;
  estimatedSize: number; // bytes
  formats: string[];
}

export interface UserPreferences {
  themeMode: ThemeMode;
  audioQuality: 'standard' | 'high' | 'lossless';
  crossfade: boolean;
  gaplessPlayback: boolean;
  downloadOverWifi: boolean;
}
