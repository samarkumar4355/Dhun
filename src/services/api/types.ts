// ─── Dhun API Client Types & Contracts ───────────────────────────────

import { AudioFormat } from '@/types/music';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
    [key: string]: any;
  };
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
}

export interface BackendTrack {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  year?: number | null;
  genre?: string | string[] | null;
  primaryArtist?: { id: string; name: string; artworkUrl?: string | null } | string | null;
  featuredArtists?: Array<{ id: string; name: string } | string>;
  albumRef?: { id: string; title: string; artworkUrl?: string | null } | string | null;
  genreRefs?: Array<{ id: string; name: string } | string>;
  duration?: number;
  durationSeconds?: number;
  durationMs?: number;
  codec?: string | null;
  lossless?: boolean;
  isLossless?: boolean;
  quality?: {
    isLossless: boolean;
    format?: string | null;
    bitDepth?: number | null;
    sampleRate?: number | null;
    bitrate?: number | null;
    channels?: number | null;
  };
  sampleRate?: number | null;
  bitDepth?: number | null;
  bitrate?: number | null;
  numberOfChannels?: number | null;
  fileHash?: string;
  originalFileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  driveAudioFileId?: string;
  hasArtwork?: boolean;
  hasLyrics?: boolean;
  lyrics?: string | null;
  isExplicit?: boolean;
  language?: string | null;
}

export interface BackendArtist {
  _id?: string;
  id?: string;
  name: string;
  nameNormalized?: string;
  artworkUrl?: string | null;
  bio?: string | null;
  genres?: Array<{ _id: string; name: string } | string>;
  country?: string | null;
}

export interface BackendAlbum {
  _id?: string;
  id?: string;
  title: string;
  titleNormalized?: string;
  artists?: Array<{ _id: string; name: string } | string>;
  tracks?: BackendTrack[];
  artworkUrl?: string | null;
  releaseYear?: number | null;
  albumType?: 'album' | 'ep' | 'single' | 'compilation';
  genres?: Array<{ _id: string; name: string } | string>;
}

export interface BackendGenre {
  _id?: string;
  id?: string;
  name: string;
  nameNormalized?: string;
  parentGenre?: { _id: string; name: string } | string | null;
  description?: string | null;
}

export interface BackendPlaylistTrack {
  position: number;
  addedAt: string;
  track: BackendTrack | null;
}

export interface BackendPlaylist {
  _id?: string;
  id?: string;
  title: string;
  description?: string;
  owner?: string;
  isPublic: boolean;
  artworkUrl?: string | null;
  trackCount: number;
  totalDurationSeconds: number;
  tracks?: BackendPlaylistTrack[];
  createdAt: string;
  updatedAt: string;
}

export interface PlaybackInfo {
  trackId: string;
  title: string;
  artist: string;
  durationSeconds?: number;
  codec?: string;
  lossless?: boolean;
  sampleRate?: number;
  bitDepth?: number;
  bitrate?: number;
  mimeType?: string;
  streamUrl: string;
  source: 'local-storage' | 'google-drive';
  hasLyrics: boolean;
}

export interface SearchResults {
  tracks: BackendTrack[];
  artists: BackendArtist[];
  albums: BackendAlbum[];
  playlists: BackendPlaylist[];
}

export interface DiscoverCollections {
  curatedHighlights: BackendTrack[];
  newReleases: BackendAlbum[];
  losslessCollection: BackendTrack[];
}

export interface DownloadManifestItem {
  trackId: string;
  title: string;
  artist: string;
  album?: string | null;
  durationSeconds?: number;
  durationMs?: number;
  originalFileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  fileHash?: string;
  codec?: string;
  lossless?: boolean;
  sampleRate?: number;
  bitDepth?: number;
  downloadUrl?: string;
  lyrics?: string | null | {
    available: boolean;
    text: string | null;
  };
  hasLyrics?: boolean;
  hasArtwork?: boolean;
  versionTimestamp?: string;
  quality?: {
    isLossless: boolean;
    format?: string;
    bitDepth?: number;
    sampleRate?: number;
  };
  audio?: {
    downloadUrl: string;
    fileSizeBytes: number;
    sha256?: string;
    md5?: string;
    originalFileName?: string;
  };
  artwork?: {
    available: boolean;
    url: string | null;
  };
  version?: string;
}
