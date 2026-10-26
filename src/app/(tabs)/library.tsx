// ─── Library Screen ─────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { usePlayer } from '@/services/PlayerProvider';
import { useAuth } from '@/services/AuthProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { SongRow } from '@/components/SongRow';
import { MiniPlayer } from '@/components/MiniPlayer';
import { GlassSurface } from '@/components/GlassSurface';
import { api, formatBackendTrackToSong } from '@/services/api/apiClient';
import { offlineService } from '@/services/offlineService';
import { Song, Album, Artist, Playlist } from '@/types/music';

type LibraryTab = 'All' | 'Favorites' | 'Playlists' | 'Artists' | 'Albums' | 'Genres';
type FilterType = 'All' | 'Lossless Only' | 'Offline Downloaded';

const tabs: LibraryTab[] = ['All', 'Favorites', 'Playlists', 'Artists', 'Albums', 'Genres'];
const filters: FilterType[] = ['All', 'Lossless Only', 'Offline Downloaded'];

export default function LibraryScreen() {
  const { colors, glass } = useTheme();
  const { currentSong, play } = usePlayer();
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<LibraryTab>('All');
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');

  // Real library state (No fabricated mock fixtures in production)
  const [songs, setSongs] = useState<Song[]>([]);
  const [favoriteSongs, setFavoriteSongs] = useState<Song[]>([]);
  const [offlineSongs, setOfflineSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // If navigated with filter param
  useEffect(() => {
    if (params.filter === 'Downloaded') {
      setActiveFilter('Offline Downloaded');
    }
  }, [params.filter]);

  const loadLibraryData = useCallback(async () => {
    try {
      setError(null);
      // 1. Fetch offline downloaded songs
      const downloaded = await offlineService.getDownloadedTracks();
      setOfflineSongs(downloaded);

      // 2. Fetch tracks from backend
      const tracksRes = await api.getTracks({ limit: 50 }).catch(err => {
        setError(err.message || 'Could not load tracks from Dhun server');
        return null;
      });
      if (tracksRes?.success && tracksRes.data) {
        const mapped = tracksRes.data.map(t =>
          formatBackendTrackToSong(t, false, offlineService.isDownloaded(t.id))
        );
        setSongs(mapped);
      }

      // 3. Fetch albums
      const albumsRes = await api.getAlbums().catch(() => null);
      if (albumsRes?.success && albumsRes.data && albumsRes.data.length > 0) {
        const mappedAlbums: Album[] = albumsRes.data.map(a => ({
          id: a.id || a._id || '',
          title: a.title,
          artistId: typeof a.artists?.[0] === 'object' ? (a.artists[0] as any).id : '',
          artistName: typeof a.artists?.[0] === 'object' ? (a.artists[0] as any).name : 'Various Artists',
          artwork: a.artworkUrl || null,
          year: a.releaseYear || 2026,
          songCount: a.tracks?.length || 1,
        }));
        setAlbums(mappedAlbums);
      }

      // 4. Fetch artists
      const artistsRes = await api.getArtists().catch(() => null);
      if (artistsRes?.success && artistsRes.data && artistsRes.data.length > 0) {
        const mappedArtists: Artist[] = artistsRes.data.map(ar => ({
          id: ar.id || ar._id || '',
          name: ar.name,
          artwork: ar.artworkUrl || null,
          languages: ['Hindi', 'English'],
          genres: (ar.genres || []).map(g => (typeof g === 'object' ? (g as any).name : String(g))),
        }));
        setArtists(mappedArtists);
      }

      // 5. Fetch genres
      const genresRes = await api.getGenres().catch(() => null);
      if (genresRes?.success && genresRes.data && genresRes.data.length > 0) {
        setGenres(genresRes.data.map(g => g.name));
      }

      // 6. If authenticated, fetch favorites & playlists
      if (isAuthenticated) {
        const [favsRes, playlistsRes] = await Promise.all([
          api.getFavorites(1, 50).catch(() => null),
          api.getUserPlaylists().catch(() => null),
        ]);

        if (favsRes?.success && favsRes.data) {
          const favMapped = favsRes.data
            .filter(item => item.track)
            .map(item => formatBackendTrackToSong(item.track, true, offlineService.isDownloaded(item.track.id)));
          setFavoriteSongs(favMapped);
        }

        if (playlistsRes?.success && playlistsRes.data) {
          const plMapped: Playlist[] = playlistsRes.data.map(p => ({
            id: p.id || p._id || '',
            name: p.title,
            artwork: p.artworkUrl || null,
            songIds: (p.tracks || []).map(t => (t.track ? t.track.id : '')).filter(Boolean),
            createdAt: p.createdAt,
          }));
          setPlaylists(plMapped);
        }
      }
    } catch {
      // Fallback to offline or cached fixtures
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadLibraryData();
  }, [loadLibraryData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadLibraryData();
  };

  // Filtered tracks based on quick filter selection
  const displayedSongs = (() => {
    let list = activeTab === 'Favorites' ? favoriteSongs : songs;
    if (activeFilter === 'Offline Downloaded') {
      list = offlineSongs.length > 0 ? offlineSongs : songs.filter(s => s.isOffline);
    } else if (activeFilter === 'Lossless Only') {
      list = list.filter(s => s.format === 'FLAC' || s.bitDepth >= 24);
    }
    return list;
  })();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: currentSong ? 100 : 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
          <Text style={[typography.h1, { color: colors.textPrimary }]}>Your Library</Text>
        </View>

        {/* Library Navigation Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {tabs.map(tab => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.tab,
                {
                  borderBottomColor: activeTab === tab ? colors.accent : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  typography.label,
                  {
                    color: activeTab === tab ? colors.accent : colors.textSecondary,
                  },
                ]}
              >
                {tab}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Tab 1: All (Collections Overview & Songs) */}
        {activeTab === 'All' && (
          <>
            <GlassSurface
              variant="card"
              borderRadius={radius.lg}
              showTopHighlight
              style={styles.collectionCard}
            >
              <LibraryRow
                icon="list"
                label="Playlists"
                count={`${playlists.length} playlists`}
                onPress={() => router.push('/playlists')}
                colors={colors}
              />
              <View style={[styles.rowDivider, { backgroundColor: glass.border }]} />
              <LibraryRow
                icon="heart"
                label="Favorites"
                count={`${favoriteSongs.length || likedCountFor(songs)} songs`}
                onPress={() => setActiveTab('Favorites')}
                colors={colors}
              />
              <View style={[styles.rowDivider, { backgroundColor: glass.border }]} />
              <LibraryRow
                icon="people"
                label="Artists"
                count={`${artists.length} artists`}
                onPress={() => router.push('/artists')}
                colors={colors}
              />
              <View style={[styles.rowDivider, { backgroundColor: glass.border }]} />
              <LibraryRow
                icon="disc"
                label="Albums"
                count={`${albums.length} albums`}
                onPress={() => setActiveTab('Albums')}
                colors={colors}
              />
              <View style={[styles.rowDivider, { backgroundColor: glass.border }]} />
              <LibraryRow
                icon="cloud-offline"
                label="Offline Downloads"
                count={`${offlineSongs.length} tracks stored`}
                onPress={() => setActiveFilter('Offline Downloaded')}
                colors={colors}
              />
            </GlassSurface>

            {/* Quick Filters */}
            <View style={styles.filterSection}>
              <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                Filters
              </Text>
              <View style={styles.filterRow}>
                {filters.map(filter => (
                  <GlassSurface
                    key={filter}
                    variant={activeFilter === filter ? 'card' : 'subtle'}
                    borderRadius={radius.full}
                    onPress={() => setActiveFilter(activeFilter === filter ? 'All' : filter)}
                    style={[
                      styles.filterChip,
                      activeFilter === filter && {
                        borderColor: colors.accent,
                        backgroundColor: glass.borderAccent,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.caption,
                        {
                          color: activeFilter === filter ? colors.accentWarm : colors.textSecondary,
                          fontWeight: activeFilter === filter ? '600' : '400',
                        },
                      ]}
                    >
                      {filter}
                    </Text>
                  </GlassSurface>
                ))}
              </View>
            </View>

            {/* Song List */}
            <View style={styles.songsSection}>
              {displayedSongs.length === 0 ? (
                <EmptyLibraryNotice
                  message={
                    activeFilter === 'Offline Downloaded'
                      ? 'No offline songs downloaded yet. Tap the download icon in Now Playing to listen offline.'
                      : 'No tracks found in library.'
                  }
                  colors={colors}
                />
              ) : (
                displayedSongs.map(song => (
                  <SongRow
                    key={song.id}
                    song={song}
                    onPress={() => play(song, displayedSongs)}
                    isActive={currentSong?.id === song.id}
                  />
                ))
              )}
            </View>
          </>
        )}

        {/* Tab 2: Favorites */}
        {activeTab === 'Favorites' && (
          <View style={styles.songsSection}>
            {favoriteSongs.length === 0 ? (
              <EmptyLibraryNotice
                message={
                  isAuthenticated
                    ? 'No favorite songs yet. Tap the heart icon on any track to add it here.'
                    : 'Log in to sync and access your favorite songs.'
                }
                colors={colors}
              />
            ) : (
              favoriteSongs.map(song => (
                <SongRow
                  key={song.id}
                  song={song}
                  onPress={() => play(song, favoriteSongs)}
                  isActive={currentSong?.id === song.id}
                />
              ))
            )}
          </View>
        )}

        {/* Tab 3: Playlists */}
        {activeTab === 'Playlists' && (
          <View style={styles.songsSection}>
            {playlists.map(pl => (
              <LibraryRow
                key={pl.id}
                icon="list"
                label={pl.name}
                count={`${pl.songIds.length} tracks`}
                onPress={() => router.push('/playlists')}
                colors={colors}
              />
            ))}
          </View>
        )}

        {/* Tab 4: Artists */}
        {activeTab === 'Artists' && (
          <View style={styles.songsSection}>
            {artists.map(artist => (
              <LibraryRow
                key={artist.id}
                icon="person"
                label={artist.name}
                count={artist.genres.join(', ') || 'Artist'}
                onPress={() => router.push('/artists')}
                colors={colors}
              />
            ))}
          </View>
        )}

        {/* Tab 5: Albums */}
        {activeTab === 'Albums' && (
          <View style={styles.songsSection}>
            {albums.map(album => (
              <LibraryRow
                key={album.id}
                icon="disc"
                label={album.title}
                count={`${album.artistName} · ${album.year}`}
                onPress={() => {
                  const matched = songs.find(s => s.albumId === album.id) || songs[0];
                  if (matched) play(matched);
                }}
                colors={colors}
              />
            ))}
          </View>
        )}

        {/* Tab 6: Genres */}
        {activeTab === 'Genres' && (
          <View style={styles.songsSection}>
            {genres.map(genre => (
              <LibraryRow
                key={genre}
                icon="musical-note"
                label={genre}
                count="Tap to explore"
                onPress={() => {
                  router.push({ pathname: '/(tabs)/search', params: { q: genre } });
                }}
                colors={colors}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {currentSong && (
        <View style={styles.miniPlayerContainer}>
          <MiniPlayer />
        </View>
      )}
    </View>
  );
}

function likedCountFor(songs: Song[]): number {
  return songs.filter(s => s.isFavorite).length;
}

function EmptyLibraryNotice({ message, colors }: { message: string; colors: any }) {
  return (
    <View style={styles.emptyNotice}>
      <Ionicons name="musical-notes-outline" size={36} color={colors.textMuted} style={{ marginBottom: spacing.sm }} />
      <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl }]}>
        {message}
      </Text>
    </View>
  );
}

function LibraryRow({
  icon,
  label,
  count,
  onPress,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count: string;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.libraryRow,
        { opacity: pressed ? 0.7 : 1 },
      ]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={22} color={colors.accent} style={{ marginRight: spacing.lg }} />
      <View style={{ flex: 1 }}>
        <Text style={[typography.body, { color: colors.textPrimary }]}>{label}</Text>
        {count ? (
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{count}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  tabRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.sm,
  },
  tab: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
  },
  collectionCard: {
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  rowDivider: {
    height: 0.5,
    marginLeft: spacing.lg + 22 + spacing.lg,
  },
  libraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    minHeight: 56,
  },
  filterSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  songsSection: {
    paddingTop: spacing.sm,
  },
  emptyNotice: {
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniPlayerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
