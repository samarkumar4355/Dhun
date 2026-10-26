// ─── Dhun Real Audio Player Service ──────────────────────────────────
// Uses expo-av Sound API for native audio streaming with HTTP Range request support,
// zero memory buffering, and offline playback.

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Song } from '@/types/music';
import { api, formatBackendTrackToSong } from './api/apiClient';
import { offlineService } from './offlineService';

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

  const soundRef = useRef<Audio.Sound | null>(null);
  const currentSongRef = useRef<Song | null>(null);
  const repeatRef = useRef(repeat);
  repeatRef.current = repeat;

  // Configure Audio Mode on mount
  useEffect(() => {
    let isMounted = true;

    async function setupAudio() {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
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
        // Backend not yet populated; use existing test fixtures
      }

      if (isMounted && !currentSongRef.current) {
        setQueue([]);
        setCurrentSong(null);
      }
    }

    setupAudio();

    return () => {
      isMounted = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        setPlaybackError(`Audio playback error: ${status.error}`);
        setIsPlaying(false);
      }
      return;
    }

    setIsPlaying(status.isPlaying);
    setIsBuffering(status.isBuffering);
    setPlaybackError(null);

    if (status.durationMillis && status.durationMillis > 0) {
      const p = status.positionMillis / status.durationMillis;
      setProgress(p);
      setCurrentTime(Math.floor(status.positionMillis / 1000));
    }

    if (status.didJustFinish) {
      // Record completed play event to backend
      if (currentSongRef.current) {
        api.recordPlay(currentSongRef.current.id, currentSongRef.current.duration, true).catch(() => {});
      }

      if (repeatRef.current === 'one') {
        soundRef.current?.replayAsync().catch(() => {});
      } else {
        // Advance to next song in queue
        next();
      }
    }
  }, []);

  const play = useCallback(
    async (song: Song, customQueue?: Song[]) => {
      try {
        setPlaybackError(null);
        if (customQueue && customQueue.length > 0) {
          setQueue(customQueue);
        }

        // Unload previous sound object cleanly
        if (soundRef.current) {
          await soundRef.current.unloadAsync().catch(() => {});
          soundRef.current = null;
        }

        setCurrentSong(song);
        currentSongRef.current = song;
        setProgress(0);
        setCurrentTime(0);

        // Resolve audio source: check offline local storage first, then stream endpoint
        let audioUri = offlineService.getLocalUri(song.id);
        if (!audioUri) {
          audioUri = api.getStreamUrl(song.id);
        }

        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true, progressUpdateIntervalMillis: 250 },
          onPlaybackStatusUpdate
        );

        soundRef.current = sound;
        setIsPlaying(true);
      } catch (err: any) {
        setPlaybackError(err.message || 'Failed to play track');
        setIsPlaying(false);
      }
    },
    [onPlaybackStatusUpdate]
  );

  const pause = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      }
    } catch {
      setIsPlaying(false);
    }
  }, []);

  const resume = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.playAsync();
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
    if (currentSong) {
      const targetSec = clamped * currentSong.duration;
      setCurrentTime(Math.floor(targetSec));
      if (soundRef.current) {
        await soundRef.current.setPositionAsync(Math.floor(targetSec * 1000)).catch(() => {});
      }
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

    // Sync with real backend
    try {
      if (nextFavState) {
        await api.addFavorite(songId);
      } else {
        await api.removeFavorite(songId);
      }
    } catch {
      // Revert optimistic update if API failed
      if (currentSong && currentSong.id === songId) {
        setCurrentSong({ ...currentSong, isFavorite: isCurrentlyFav });
      }
      setQueue(prev =>
        prev.map(s => (s.id === songId ? { ...s, isFavorite: isCurrentlyFav } : s))
      );
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
