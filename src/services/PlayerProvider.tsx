// ─── Dhun Player State ──────────────────────────────────────────────
// Mock player context for the frontend

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Song } from '@/types/music';
import { mockSongs } from '@/data/mockSongs';

interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  progress: number; // 0-1
  currentTime: number; // seconds
  queue: Song[];
  shuffle: boolean;
  repeat: 'off' | 'one' | 'all';
}

interface PlayerContextValue extends PlayerState {
  play: (song: Song) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  seekTo: (progress: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleFavorite: (songId: string) => void;
  setQueue: (songs: Song[]) => void;
}

const PlayerContext = createContext<PlayerContextValue>({
  currentSong: null,
  isPlaying: false,
  progress: 0,
  currentTime: 0,
  queue: [],
  shuffle: false,
  repeat: 'off',
  play: () => {},
  pause: () => {},
  resume: () => {},
  next: () => {},
  previous: () => {},
  seekTo: () => {},
  toggleShuffle: () => {},
  toggleRepeat: () => {},
  toggleFavorite: () => {},
  setQueue: () => {},
});

export function usePlayer(): PlayerContextValue {
  return useContext(PlayerContext);
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentSong, setCurrentSong] = useState<Song | null>(mockSongs[1]); // Kasoor as default
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0.55);
  const [currentTime, setCurrentTime] = useState(134);
  const [queue, setQueue] = useState<Song[]>(mockSongs);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<'off' | 'one' | 'all'>('off');

  const play = useCallback((song: Song) => {
    setCurrentSong(song);
    setIsPlaying(true);
    setProgress(0);
    setCurrentTime(0);
  }, []);

  const pause = useCallback(() => setIsPlaying(false), []);
  const resume = useCallback(() => setIsPlaying(true), []);

  const next = useCallback(() => {
    if (!currentSong) return;
    const idx = queue.findIndex(s => s.id === currentSong.id);
    const nextIdx = (idx + 1) % queue.length;
    setCurrentSong(queue[nextIdx]);
    setProgress(0);
    setCurrentTime(0);
  }, [currentSong, queue]);

  const previous = useCallback(() => {
    if (!currentSong) return;
    const idx = queue.findIndex(s => s.id === currentSong.id);
    const prevIdx = idx > 0 ? idx - 1 : queue.length - 1;
    setCurrentSong(queue[prevIdx]);
    setProgress(0);
    setCurrentTime(0);
  }, [currentSong, queue]);

  const seekTo = useCallback((p: number) => {
    setProgress(p);
    if (currentSong) {
      setCurrentTime(Math.floor(p * currentSong.duration));
    }
  }, [currentSong]);

  const toggleShuffle = useCallback(() => setShuffle(s => !s), []);
  const toggleRepeat = useCallback(() => {
    setRepeat(r => r === 'off' ? 'all' : r === 'all' ? 'one' : 'off');
  }, []);

  const toggleFavorite = useCallback((songId: string) => {
    if (currentSong && currentSong.id === songId) {
      setCurrentSong({ ...currentSong, isFavorite: !currentSong.isFavorite });
    }
  }, [currentSong]);

  const value = useMemo(() => ({
    currentSong,
    isPlaying,
    progress,
    currentTime,
    queue,
    shuffle,
    repeat,
    play,
    pause,
    resume,
    next,
    previous,
    seekTo,
    toggleShuffle,
    toggleRepeat,
    toggleFavorite,
    setQueue,
  }), [currentSong, isPlaying, progress, currentTime, queue, shuffle, repeat,
       play, pause, resume, next, previous, seekTo, toggleShuffle, toggleRepeat, toggleFavorite]);

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}
