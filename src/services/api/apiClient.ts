// ─── Central Dhun Typed API Client ─────────────────────────────────────

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { tokenStorage } from '../tokenStorage';
import { Song, AudioFormat } from '@/types/music';
import {
  ApiResponse,
  BackendTrack,
  BackendArtist,
  BackendAlbum,
  BackendGenre,
  BackendPlaylist,
  PlaybackInfo,
  SearchResults,
  DiscoverCollections,
  DownloadManifestItem,
} from './types';

/**
 * Custom API Error class with normalized HTTP status and code.
 */
export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: any;

  constructor(message: string, statusCode = 500, code = 'ERROR', details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

import * as Device from 'expo-device';

let customBaseUrl: string | null = null;

export function setApiBaseUrl(url: string | null) {
  customBaseUrl = url ? url.trim().replace(/\/+$/, '') : null;
}

/**
 * Resolves the API Base URL based on environment and network context:
 * 1. User-customized Base URL if configured.
 * 2. Explicit EXPO_PUBLIC_API_URL environment variable.
 * 3. Physical device connected via Expo Go / Metro (dynamically resolves host machine LAN IP from hostUri on port 5001).
 * 4. Physical Android phone standalone fallback (reachable local LAN IP on port 5001).
 * 5. Android Emulator loopback (10.0.2.2:5001).
 * 6. iOS Simulator / Web (localhost:5001).
 */
export function getApiBaseUrl(): string {
  if (customBaseUrl) {
    return customBaseUrl;
  }

  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }

  // Physical device connected via Expo Go / Development Build
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return `http://${hostIp}:5001`;
    }
  }

  // Android platform detection
  if (Platform.OS === 'android') {
    if (Device.isDevice) {
      // Physical Android phone on the same Wi-Fi network as the dev machine
      return 'http://192.168.1.230:5001';
    }
    // Android Studio Emulator loopback
    return 'http://10.0.2.2:5001';
  }

  // iOS Simulator & Web local development
  return 'http://localhost:5001';
}

/**
 * Transforms a backend Track document into the frontend Song model.
 */
export function formatBackendTrackToSong(
  track: BackendTrack,
  isFavorite = false,
  isOffline = false
): Song {
  const duration =
    track.durationSeconds ??
    track.duration ??
    (track.durationMs ? Math.round(track.durationMs / 1000) : 180);

  let format: AudioFormat = 'FLAC';
  const rawFormat = (track.codec || track.quality?.format || 'FLAC').toUpperCase();
  if (rawFormat.includes('MPEG') || rawFormat.includes('MP3')) format = 'MP3';
  else if (rawFormat.includes('ALAC')) format = 'ALAC';
  else if (rawFormat.includes('WAV')) format = 'WAV';
  else if (rawFormat.includes('AAC')) format = 'AAC';
  else if (rawFormat.includes('OGG')) format = 'OGG';
  else if (rawFormat.includes('AIFF')) format = 'AIFF';
  else format = 'FLAC';

  const primaryArtistId =
    typeof track.primaryArtist === 'object' && track.primaryArtist
      ? track.primaryArtist.id
      : typeof track.primaryArtist === 'string'
      ? track.primaryArtist
      : '';

  const albumId =
    typeof track.albumRef === 'object' && track.albumRef
      ? track.albumRef.id
      : typeof track.albumRef === 'string'
      ? track.albumRef
      : '';

  return {
    id: track.id,
    title: track.title,
    artistId: primaryArtistId || track.artist,
    artistName: track.artist || 'Unknown Artist',
    albumId: albumId || track.album || '',
    albumName: track.album || 'Single',
    artwork: track.hasArtwork ? `${getApiBaseUrl()}/api/v1/tracks/${track.id}/artwork` : null,
    duration,
    format,
    bitDepth: track.bitDepth ?? (format === 'FLAC' ? 24 : 16),
    sampleRate: track.sampleRate ?? 44100,
    fileSize: track.fileSizeBytes ?? 0,
    source: 'imported',
    isOffline,
    isFavorite,
    lyrics: track.lyrics ?? null,
  };
}

class ApiClient {
  private refreshPromise: Promise<string | null> | null = null;
  private onAuthFailureCallback?: () => void;

  /**
   * Register a callback triggered when an access token cannot be refreshed (session expired).
   */
  setOnAuthFailure(cb: () => void) {
    this.onAuthFailureCallback = cb;
  }

  /**
   * Internal HTTP request handler with timeout, auth injection, and single-flight refresh mutex.
   */
  async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      body?: any;
      headers?: Record<string, string>;
      requiresAuth?: boolean;
      timeoutMs?: number;
    } = {}
  ): Promise<ApiResponse<T>> {
    const { method = 'GET', body, requiresAuth = false, timeoutMs = 12000 } = options;
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (requiresAuth) {
      const token = await tokenStorage.getAccessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Handle 401 Unauthorized by attempting token refresh once
      if (response.status === 401 && requiresAuth) {
        const newAccessToken = await this.refreshTokenOnce();
        if (newAccessToken) {
          // Retry original request with newly refreshed token
          headers.Authorization = `Bearer ${newAccessToken}`;
          const retryResponse = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
          });
          const retryData = await retryResponse.json();
          if (!retryResponse.ok || retryData.success === false) {
            throw new ApiError(
              retryData.error?.message || 'Request failed after token refresh',
              retryResponse.status,
              retryData.error?.code
            );
          }
          if (retryData.success === undefined) {
            return {
              success: true,
              data: retryData,
            };
          }
          return retryData;
        } else {
          // Refresh failed: clear session
          await tokenStorage.clearAll();
          this.onAuthFailureCallback?.();
          throw new ApiError('Session expired. Please log in again.', 401, 'AUTH_EXPIRED');
        }
      }

      const json = await response.json();

      if (!response.ok) {
        throw new ApiError(
          json.error?.message || (typeof json.error === 'string' ? json.error : null) || `HTTP ${response.status}`,
          response.status,
          json.error?.code || 'HTTP_ERROR',
          json.error?.details
        );
      }

      if (json.success === false) {
        throw new ApiError(
          json.error?.message || (typeof json.error === 'string' ? json.error : null) || 'API request failed',
          response.status,
          json.error?.code || 'API_FAILED',
          json.error?.details
        );
      }

      // If backend returned a bare object/array without { success: true, data: ... }
      if (json.success === undefined) {
        return {
          success: true,
          data: json,
        };
      }

      return json;
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new ApiError('Network request timed out. Please check your connection.', 408, 'TIMEOUT');
      }
      if (err instanceof ApiError) {
        throw err;
      }
      throw new ApiError(err.message || 'Unable to connect to Dhun server.', 503, 'NETWORK_ERROR');
    }
  }

  /**
   * Refreshes the JWT access token using a single-flight promise to avoid concurrent refresh races.
   */
  private async refreshTokenOnce(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const refreshToken = await tokenStorage.getRefreshToken();
        if (!refreshToken) return null;

        const baseUrl = getApiBaseUrl();
        const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) return null;
        const json = await response.json();
        const tokens = json.data?.tokens || json.data;
        if (!json.success || !tokens?.accessToken) return null;

        const { accessToken, refreshToken: newRefresh } = tokens;
        if (newRefresh) {
          await tokenStorage.saveTokens(accessToken, newRefresh);
        } else {
          await tokenStorage.saveAccessToken(accessToken);
        }

        return accessToken;
      } catch {
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // ─── Authentication Endpoints ──────────────────────────────────────────────

  async register(data: { email: string; password: string; displayName: string }) {
    return this.request<{ user: any; tokens: { accessToken: string; refreshToken: string } }>(
      '/api/v1/auth/register',
      { method: 'POST', body: data }
    );
  }

  async login(data: { email: string; password: string }) {
    return this.request<{ user: any; tokens: { accessToken: string; refreshToken: string } }>(
      '/api/v1/auth/login',
      { method: 'POST', body: data }
    );
  }

  async loginWithGoogle(data?: { email?: string; displayName?: string; avatarUrl?: string }) {
    return this.request<{ user: any; tokens: { accessToken: string; refreshToken: string } }>(
      '/api/v1/auth/google',
      {
        method: 'POST',
        body: {
          email: data?.email || 'listener@dhun.audio',
          displayName: data?.displayName || 'Google Listener',
          avatarUrl: data?.avatarUrl,
        },
      }
    );
  }

  async logout() {
    const refreshToken = await tokenStorage.getRefreshToken();
    try {
      await this.request('/api/v1/auth/logout', {
        method: 'POST',
        body: { refreshToken },
        requiresAuth: true,
      });
    } finally {
      await tokenStorage.clearAll();
    }
  }

  async getMe() {
    return this.request<any>('/api/v1/auth/me', { requiresAuth: true });
  }

  // ─── Catalog & Discovery ───────────────────────────────────────────────────

  async getTracks(params: {
    page?: number;
    limit?: number;
    search?: string;
    isLossless?: boolean;
    artist?: string;
    album?: string;
    genre?: string;
  } = {}) {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.search) query.append('search', params.search);
    if (params.isLossless !== undefined) query.append('isLossless', String(params.isLossless));
    if (params.artist) query.append('artist', params.artist);
    if (params.album) query.append('album', params.album);
    if (params.genre) query.append('genre', params.genre);

    const qs = query.toString();
    return this.request<BackendTrack[]>(`/api/v1/tracks${qs ? `?${qs}` : ''}`);
  }

  async getTrackById(id: string) {
    return this.request<BackendTrack>(`/api/v1/tracks/${id}`);
  }

  async getPlaybackInfo(id: string) {
    return this.request<PlaybackInfo>(`/api/v1/tracks/${id}/playback`);
  }

  async getTrackLyrics(id: string) {
    return this.request<{ lyrics: string | null; hasLyrics: boolean }>(`/api/v1/tracks/${id}/lyrics`);
  }

  async getRelatedTracks(id: string) {
    return this.request<BackendTrack[]>(`/api/v1/tracks/${id}/related`);
  }

  async getArtists(params: { page?: number; limit?: number; q?: string } = {}) {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.q) query.append('q', params.q);
    const qs = query.toString();
    return this.request<BackendArtist[]>(`/api/v1/artists${qs ? `?${qs}` : ''}`);
  }

  async getArtistById(id: string) {
    return this.request<BackendArtist>(`/api/v1/artists/${id}`);
  }

  async getArtistTracks(id: string) {
    return this.request<BackendTrack[]>(`/api/v1/artists/${id}/tracks`);
  }

  async getArtistAlbums(id: string) {
    return this.request<BackendAlbum[]>(`/api/v1/artists/${id}/albums`);
  }

  async getAlbums(params: { page?: number; limit?: number; q?: string } = {}) {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.q) query.append('q', params.q);
    const qs = query.toString();
    return this.request<BackendAlbum[]>(`/api/v1/albums${qs ? `?${qs}` : ''}`);
  }

  async getAlbumById(id: string) {
    return this.request<BackendAlbum & { tracks: BackendTrack[] }>(`/api/v1/albums/${id}`);
  }

  async getGenres() {
    return this.request<BackendGenre[]>('/api/v1/genres');
  }

  async getGenreTracks(id: string) {
    return this.request<BackendTrack[]>(`/api/v1/genres/${id}/tracks`);
  }

  async search(query: string, type = 'all', limit = 20) {
    return this.request<SearchResults>(
      `/api/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`
    );
  }

  async getDiscover() {
    return this.request<DiscoverCollections>('/api/v1/discover');
  }

  // ─── User Favorites & Library ──────────────────────────────────────────────

  async getFavorites(page = 1, limit = 50) {
    return this.request<Array<{ id: string; track: BackendTrack; favoritedAt: string }>>(
      `/api/v1/me/favorites?page=${page}&limit=${limit}`,
      { requiresAuth: true }
    );
  }

  async addFavorite(trackId: string) {
    return this.request<{ favorited: boolean }>(`/api/v1/me/favorites/${trackId}`, {
      method: 'PUT',
      requiresAuth: true,
    });
  }

  async removeFavorite(trackId: string) {
    return this.request<{ favorited: boolean }>(`/api/v1/me/favorites/${trackId}`, {
      method: 'DELETE',
      requiresAuth: true,
    });
  }

  async getLibrary(page = 1, limit = 50) {
    return this.request<Array<{ id: string; track: BackendTrack; savedAt: string }>>(
      `/api/v1/me/library?page=${page}&limit=${limit}`,
      { requiresAuth: true }
    );
  }

  async addToLibrary(trackId: string) {
    return this.request<{ saved: boolean }>(`/api/v1/me/library/${trackId}`, {
      method: 'POST',
      requiresAuth: true,
    });
  }

  async removeFromLibrary(trackId: string) {
    return this.request<{ saved: boolean }>(`/api/v1/me/library/${trackId}`, {
      method: 'DELETE',
      requiresAuth: true,
    });
  }

  // ─── Playlists ─────────────────────────────────────────────────────────────

  async getUserPlaylists() {
    return this.request<BackendPlaylist[]>('/api/v1/me/playlists', { requiresAuth: true });
  }

  async createPlaylist(data: { title: string; description?: string; isPublic?: boolean }) {
    return this.request<BackendPlaylist>('/api/v1/playlists', {
      method: 'POST',
      body: data,
      requiresAuth: true,
    });
  }

  async getPlaylistById(id: string) {
    return this.request<BackendPlaylist>(`/api/v1/playlists/${id}`);
  }

  async deletePlaylist(id: string) {
    return this.request<{ message: string }>(`/api/v1/playlists/${id}`, {
      method: 'DELETE',
      requiresAuth: true,
    });
  }

  async addTrackToPlaylist(playlistId: string, trackId: string) {
    return this.request<BackendPlaylist>(`/api/v1/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: { trackId },
      requiresAuth: true,
    });
  }

  async removeTrackFromPlaylist(playlistId: string, trackId: string) {
    return this.request<BackendPlaylist>(`/api/v1/playlists/${playlistId}/tracks/${trackId}`, {
      method: 'DELETE',
      requiresAuth: true,
    });
  }

  async reorderPlaylist(playlistId: string, trackIds: string[]) {
    return this.request<BackendPlaylist>(`/api/v1/playlists/${playlistId}/order`, {
      method: 'PATCH',
      body: { trackIds },
      requiresAuth: true,
    });
  }

  // ─── Listening History & Recommendations ───────────────────────────────────

  async getListeningHistory(page = 1, limit = 30) {
    return this.request<Array<{ track: BackendTrack; playedAt: string; durationPlayedSeconds: number }>>(
      `/api/v1/me/history?page=${page}&limit=${limit}`,
      { requiresAuth: true }
    );
  }

  async recordPlay(trackId: string, durationPlayedSeconds: number, completed = false) {
    return this.request('/api/v1/me/history', {
      method: 'POST',
      body: { trackId, durationPlayedSeconds, completed },
      requiresAuth: true,
    }).catch(() => {});
  }

  async getRecommendations() {
    return this.request<{ recommendedTracks: BackendTrack[]; basedOn: any }>(
      '/api/v1/me/recommendations',
      { requiresAuth: true }
    );
  }

  // ─── Offline Download Manifest ─────────────────────────────────────────────

  async getDownloadManifest(trackIds: string[]) {
    return this.request<DownloadManifestItem[]>(
      '/api/v1/sync/download-manifest',
      {
        method: 'POST',
        body: { trackIds },
      }
    );
  }

  /**
   * Helper to get full stream URL for audio player
   */
  getStreamUrl(trackId: string): string {
    return `${getApiBaseUrl()}/api/v1/tracks/${trackId}/stream`;
  }
}

export const api = new ApiClient();
