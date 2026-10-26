// ─── Dhun Real Audio Player Service ──────────────────────────────────
// Uses modern expo-audio API for native audio streaming with HTTP Range request support,
// zero memory buffering, background audio, and offline playback.

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import {
  createAudioPlayer,
  setAudioModeAsync,
  AudioPlayer,
  AudioStatus,
} from 'expo-audio';
import { Song } from '@/types/music';
import { api, formatBackendTrackToSong } from './api/apiClient';
import { offlineService } from './offlineService';
import { tokenStorage } from './tokenStorage';
import { storage } from '@/utils/storage';

const LOCAL_FAVORITES_KEY = 'dhun_local_favorite_ids';

function getLocalFavorites(): Set<string> {
  try {
    const raw = storage.getItem(LOCAL_FAVORITES_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveLocalFavorite(songId: string, isFav: boolean) {
  try {
    const favs = getLocalFavorites();
    if (isFav) {
      favs.add(songId);
    } else {
      favs.delete(songId);
    }
    storage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(Array.from(favs)));
  } catch {
    // Ignore storage errors
  }
}

interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  progress: number; // 0 to 1
  currentTime: number; // seconds
  queue: Song[];
  shuffle: boolean;
  repeat: 'off' | 'one' | 'all';
  isBuffering: boolean;
  isDownloading: boolean;
  playbackError: string | null;
}

interface PlayerContextValue extends PlayerState {
  play: (song: Song, customQueue?: Song[]) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seekTo: (progress: number) => Promise<void>;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleFavorite: (songId: string) => Promise<void>;
  downloadSong: (song: Song) => Promise<void>;
  deleteDownload: (songId: string) => Promise<void>;
  setQueue: (songs: Song[]) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [queue, setQueue] = useState<Song[]>([]);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<'off' | 'one' | 'all'>('off');
  const [isBuffering, setIsBuffering] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const playerRef = useRef<AudioPlayer | null>(null);
  const statusSubRef = useRef<{ remove: () => void } | null>(null);
  const currentSongRef = useRef<Song | null>(null);
  const repeatRef = useRef(repeat);
  repeatRef.current = repeat;

  const nextRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Configure Audio Mode on mount
  useEffect(() => {
    let isMounted = true;

    async function setupAudio() {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'duckOthers',
        });
      } catch {
        // Fallback for web / simulator
      }

      // Initialize offline engine
      await offlineService.init().catch(() => {});

      // Load initial catalog tracks from real backend
      try {
        const tracksRes = await api.getTracks({ limit: 10 });
        if (isMounted && tracksRes.success && tracksRes.data && tracksRes.data.length > 0) {
          const songs = tracksRes.data.map(t =>
            formatBackendTrackToSong(t, false, offlineService.isDownloaded(t.id))
          );
          setQueue(songs);
          if (!currentSongRef.current) {
            setCurrentSong(songs[0]);
            currentSongRef.current = songs[0];
          }
          return;
        }
      } catch {
        // Backend not yet populated; fallback
      }

      if (isMounted && !currentSongRef.current) {
        setQueue([]);
        setCurrentSong(null);
      }
    }

    setupAudio();

    return () => {
      isMounted = false;
      if (statusSubRef.current) {
        statusSubRef.current.remove();
        statusSubRef.current = null;
      }
      if (playerRef.current) {
        try {
          playerRef.current.pause();
        } catch {}
        playerRef.current = null;
      }
    };
  }, []);

  const play = useCallback(
    async (song: Song, customQueue?: Song[]) => {
      try {
        setPlaybackError(null);
        const favs = getLocalFavorites();
        const effectiveSong = favs.has(song.id) ? { ...song, isFavorite: true } : song;
        if (customQueue && customQueue.length > 0) {
          setQueue(customQueue.map(s => (favs.has(s.id) ? { ...s, isFavorite: true } : s)));
        }

        setCurrentSong(effectiveSong);
        currentSongRef.current = effectiveSong;
        setProgress(0);
        setCurrentTime(0);

        // Resolve audio source: check offline local storage first, then stream endpoint
        let audioUri = offlineService.getLocalUri(song.id);
        if (!audioUri) {
          audioUri = api.getStreamUrl(song.id);
        }

        if (statusSubRef.current) {
          statusSubRef.current.remove();
          statusSubRef.current = null;
        }

        if (!playerRef.current) {
          playerRef.current = createAudioPlayer({ uri: audioUri }, { updateInterval: 250 });
        } else {
          playerRef.current.replace({ uri: audioUri });
        }

        const player = playerRef.current;

        statusSubRef.current = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
          setIsPlaying(status.playing);
          setIsBuffering(status.isBuffering);

          if (status.error) {
            setPlaybackError(status.error);
            setIsPlaying(false);
          } else {
            setPlaybackError(null);
          }

          if (status.duration > 0) {
            setProgress(status.currentTime / status.duration);
            setCurrentTime(Math.floor(status.currentTime));
          }

          if (status.didJustFinish) {
            if (currentSongRef.current) {
              api.recordPlay(currentSongRef.current.id, currentSongRef.current.duration, true).catch(() => {});
            }

            if (repeatRef.current === 'one') {
              player.seekTo(0).then(() => player.play());
            } else {
              nextRef.current();
            }
          }
        });

        player.play();
        setIsPlaying(true);
      } catch (err: any) {
        setPlaybackError(err.message || 'Failed to play track');
        setIsPlaying(false);
      }
    },
    []
  );

  const pause = useCallback(async () => {
    try {
      if (playerRef.current) {
        playerRef.current.pause();
        setIsPlaying(false);
      }
    } catch {
      setIsPlaying(false);
    }
  }, []);

  const resume = useCallback(async () => {
    try {
      if (playerRef.current) {
        playerRef.current.play();
        setIsPlaying(true);
      } else if (currentSong) {
        await play(currentSong);
      }
    } catch {
      setIsPlaying(false);
    }
  }, [currentSong, play]);

  const seekTo = useCallback(async (fraction: number) => {
    const clamped = Math.max(0, Math.min(1, fraction));
    setProgress(clamped);
    if (currentSong && playerRef.current) {
      const duration = playerRef.current.duration || currentSong.duration;
      const targetSec = clamped * duration;
      setCurrentTime(Math.floor(targetSec));
      await playerRef.current.seekTo(targetSec).catch(() => {});
    }
  }, [currentSong]);

  const next = useCallback(async () => {
    if (!currentSong || queue.length === 0) return;
    const idx = queue.findIndex(s => s.id === currentSong.id);
    let nextIdx = (idx + 1) % queue.length;
    if (shuffle && queue.length > 1) {
      let rand = Math.floor(Math.random() * queue.length);
      while (rand === idx) {
        rand = Math.floor(Math.random() * queue.length);
      }
      nextIdx = rand;
    }
    await play(queue[nextIdx]);
  }, [currentSong, queue, shuffle, play]);

  nextRef.current = next;

  const previous = useCallback(async () => {
    if (!currentSong || queue.length === 0) return;
    const idx = queue.findIndex(s => s.id === currentSong.id);
    const prevIdx = idx > 0 ? idx - 1 : queue.length - 1;
    await play(queue[prevIdx]);
  }, [currentSong, queue, play]);

  const toggleShuffle = useCallback(() => setShuffle(s => !s), []);

  const toggleRepeat = useCallback(() => {
    setRepeat(r => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'));
  }, []);

  const toggleFavorite = useCallback(async (songId: string) => {
    const isCurrentlyFav = currentSong?.id === songId ? currentSong.isFavorite : false;
    const nextFavState = !isCurrentlyFav;

    if (currentSong && currentSong.id === songId) {
      setCurrentSong({ ...currentSong, isFavorite: nextFavState });
    }

    setQueue(prev =>
      prev.map(s => (s.id === songId ? { ...s, isFavorite: nextFavState } : s))
    );

    saveLocalFavorite(songId, nextFavState);

    // Sync with real backend if authenticated
    try {
      const token = await tokenStorage.getAccessToken();
      if (token) {
        if (nextFavState) {
          await api.addFavorite(songId);
        } else {
          await api.removeFavorite(songId);
        }
      }
    } catch (err) {
      console.warn('Backend favorite sync notice:', err);
    }
  }, [currentSong]);

  const downloadSong = useCallback(async (song: Song) => {
    try {
      setIsDownloading(true);
      await offlineService.downloadTrack(song);
      if (currentSong?.id === song.id) {
        setCurrentSong({ ...currentSong, isOffline: true });
      }
      setQueue(prev =>
        prev.map(s => (s.id === song.id ? { ...s, isOffline: true } : s))
      );
    } catch (err: any) {
      setPlaybackError(err.message || 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  }, [currentSong]);

  const deleteDownload = useCallback(async (songId: string) => {
    await offlineService.deleteTrack(songId);
    if (currentSong?.id === songId) {
      setCurrentSong({ ...currentSong, isOffline: false });
    }
    setQueue(prev =>
      prev.map(s => (s.id === songId ? { ...s, isOffline: false } : s))
    );
  }, [currentSong]);

  const value = useMemo(
    () => ({
      currentSong,
      isPlaying,
      progress,
      currentTime,
      queue,
      shuffle,
      repeat,
      isBuffering,
      isDownloading,
      playbackError,
      play,
      pause,
      resume,
      next,
      previous,
      seekTo,
      toggleShuffle,
      toggleRepeat,
      toggleFavorite,
      downloadSong,
      deleteDownload,
      setQueue,
    }),
    [
      currentSong,
      isPlaying,
      progress,
      currentTime,
      queue,
      shuffle,
      repeat,
      isBuffering,
      isDownloading,
      playbackError,
      play,
      pause,
      resume,
      next,
      previous,
      seekTo,
      toggleShuffle,
      toggleRepeat,
      toggleFavorite,
      downloadSong,
      deleteDownload,
    ]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
