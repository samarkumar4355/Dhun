// ─── Mock Playlists ─────────────────────────────────────────────────
import { Playlist } from '@/types/music';

export const mockPlaylists: Playlist[] = [
  {
    id: 'playlist-1',
    name: 'Morning Vibes',
    artwork: null,
    songIds: ['song-3', 'song-8', 'song-2', 'song-6'],
    createdAt: '2024-01-15',
  },
  {
    id: 'playlist-2',
    name: 'Road Trip',
    artwork: null,
    songIds: ['song-1', 'song-5', 'song-9', 'song-4'],
    createdAt: '2024-02-10',
  },
  {
    id: 'playlist-3',
    name: 'Late Night',
    artwork: null,
    songIds: ['song-4', 'song-8', 'song-2'],
    createdAt: '2024-03-01',
  },
  {
    id: 'playlist-4',
    name: 'Focus',
    artwork: null,
    songIds: ['song-3', 'song-6', 'song-4', 'song-12'],
    createdAt: '2024-03-20',
  },
  {
    id: 'playlist-5',
    name: 'Best of Arijit Singh',
    artwork: null,
    songIds: ['song-1', 'song-11'],
    createdAt: '2024-04-05',
  },
  {
    id: 'playlist-6',
    name: '90s Hits',
    artwork: null,
    songIds: ['song-6', 'song-3'],
    createdAt: '2024-05-12',
  },
  {
    id: 'playlist-7',
    name: 'Bollywood Classics',
    artwork: null,
    songIds: ['song-3', 'song-11', 'song-12', 'song-1'],
    createdAt: '2024-06-01',
  },
];
