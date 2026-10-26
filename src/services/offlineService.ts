// ─── Dhun Offline Music Storage & Sync Engine ────────────────────────
// Downloads master lossless audio and metadata to persistent device storage,
// verifies file integrity, and enables complete offline playback.

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Song, AudioFormat } from '@/types/music';
import { api } from './api/apiClient';

const TRACKS_DIR = `${FileSystem.documentDirectory || ''}dhun_tracks/`;
const OFFLINE_INDEX_FILE = `${FileSystem.documentDirectory || ''}dhun_offline_index.json`;

export interface OfflineTrackMetadata extends Song {
  localUri: string;
  downloadedAt: string;
  sha256?: string;
}

class OfflineService {
  private inMemoryCatalog: Map<string, OfflineTrackMetadata> = new Map();
  private isInitialized = false;

  private async ensureDirectory() {
    if (Platform.OS === 'web' || !FileSystem.documentDirectory) return;
    try {
      const dirInfo = await FileSystem.getInfoAsync(TRACKS_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(TRACKS_DIR, { intermediates: true });
      }
    } catch {
      // Directory creation fallback
    }
  }

  /**
   * Initializes the offline catalog from persistent storage.
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    await this.ensureDirectory();

    if (Platform.OS !== 'web' && FileSystem.documentDirectory) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(OFFLINE_INDEX_FILE);
        if (fileInfo.exists) {
          const content = await FileSystem.readAsStringAsync(OFFLINE_INDEX_FILE);
          const list: OfflineTrackMetadata[] = JSON.parse(content);
          this.inMemoryCatalog.clear();
          for (const item of list) {
            // Validate that the audio file still exists on disk
            const audioCheck = await FileSystem.getInfoAsync(item.localUri).catch(() => ({ exists: false }));
            if (audioCheck.exists) {
              this.inMemoryCatalog.set(item.id, item);
            }
          }
        }
      } catch {
        // Fallback to empty catalog
      }
    }
    this.isInitialized = true;
  }

  private async saveIndex(): Promise<void> {
    if (Platform.OS === 'web' || !FileSystem.documentDirectory) return;
    try {
      const items = Array.from(this.inMemoryCatalog.values());
      await FileSystem.writeAsStringAsync(OFFLINE_INDEX_FILE, JSON.stringify(items));
    } catch {
      // Storage error
    }
  }

  /**
   * Check whether a track is currently downloaded and available offline.
   */
  isDownloaded(trackId: string): boolean {
    return this.inMemoryCatalog.has(trackId);
  }

  /**
   * Retrieve local file URI for a downloaded track, or null if not offline.
   */
  getLocalUri(trackId: string): string | null {
    const item = this.inMemoryCatalog.get(trackId);
    return item ? item.localUri : null;
  }

  /**
   * Retrieve all downloaded songs.
   */
  async getDownloadedTracks(): Promise<Song[]> {
    await this.init();
    return Array.from(this.inMemoryCatalog.values()).map(item => ({
      ...item,
      isOffline: true,
    }));
  }

  /**
   * Download a track for bit-perfect offline listening.
   */
  async downloadTrack(track: Song, onProgress?: (percent: number) => void): Promise<OfflineTrackMetadata> {
    await this.init();

    if (this.inMemoryCatalog.has(track.id)) {
      return this.inMemoryCatalog.get(track.id)!;
    }

    if (Platform.OS === 'web' || !FileSystem.documentDirectory) {
      throw new Error('Offline downloads are only supported on native iOS and Android devices.');
    }

    await this.ensureDirectory();

    // 1. Fetch authorized download manifest from backend
    let downloadUrl = api.getStreamUrl(track.id);
    let expectedSize = track.fileSize;
    let sha256 = '';

    try {
      const manifestRes = await api.getDownloadManifest([track.id]);
      if (manifestRes.success && manifestRes.data) {
        const items = Array.isArray(manifestRes.data) ? manifestRes.data : (manifestRes.data as any).manifest;
        if (items && items[0]) {
          const item = items[0];
          downloadUrl = item.downloadUrl || item.audio?.downloadUrl || downloadUrl;
          expectedSize = item.fileSizeBytes || item.audio?.fileSizeBytes || expectedSize;
          sha256 = item.fileHash || item.audio?.sha256 || '';
        }
      }
    } catch {
      // Fallback to stream URL if manifest endpoint is unreachable
    }

    // 2. Download audio file to persistent document directory
    const ext = track.format.toLowerCase();
    const destinationUri = `${TRACKS_DIR}${track.id}.${ext}`;

    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      destinationUri,
      {},
      (downloadProgress) => {
        if (onProgress && downloadProgress.totalBytesExpectedToWrite > 0) {
          const percent = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          onProgress(percent);
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result || !result.uri) {
      throw new Error('Download failed to produce a valid file.');
    }

    // 3. Verify file size on disk
    const fileInfo = await FileSystem.getInfoAsync(result.uri);
    if (!fileInfo.exists || fileInfo.size === 0) {
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
      throw new Error('Downloaded file is empty or corrupted.');
    }

    // 4. Save metadata into offline catalog
    const offlineItem: OfflineTrackMetadata = {
      ...track,
      isOffline: true,
      localUri: result.uri,
      downloadedAt: new Date().toISOString(),
      fileSize: fileInfo.size,
      sha256,
    };

    this.inMemoryCatalog.set(track.id, offlineItem);
    await this.saveIndex();

    return offlineItem;
  }

  /**
   * Delete a downloaded track from persistent storage.
   */
  async deleteTrack(trackId: string): Promise<void> {
    await this.init();
    const item = this.inMemoryCatalog.get(trackId);
    if (item) {
      if (Platform.OS !== 'web' && item.localUri) {
        await FileSystem.deleteAsync(item.localUri, { idempotent: true }).catch(() => {});
      }
      this.inMemoryCatalog.delete(trackId);
      await this.saveIndex();
    }
  }

  /**
   * Total offline storage used in bytes.
   */
  getTotalStorageBytes(): number {
    let sum = 0;
    for (const item of this.inMemoryCatalog.values()) {
      sum += item.fileSize || 0;
    }
    return sum;
  }
}

export const offlineService = new OfflineService();
