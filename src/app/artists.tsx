// ─── Artists Screen ─────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { usePlayer } from '@/services/PlayerProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { SongRow } from '@/components/SongRow';
import { ArtistBorderRing } from '@/components/ArtistBorderRing';
import { api, formatBackendTrackToSong } from '@/services/api/apiClient';
import { offlineService } from '@/services/offlineService';
import { stringToColor, getInitials, safeBack } from '@/utils/helpers';
import { Artist, Song, Album } from '@/types/music';

export default function ArtistsScreen() {
  const { colors, glass } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { play, currentSong } = usePlayer();

  const [search, setSearch] = useState(typeof params.search === 'string' ? params.search : '');
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [artistTracks, setArtistTracks] = useState<Song[]>([]);
  const [artistAlbums, setArtistAlbums] = useState<Album[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectArtist = useCallback(async (artist: Artist) => {
    setSelectedArtist(artist);
    setLoadingTracks(true);
    try {
      const [tracksRes, albumsRes] = await Promise.all([
        api.getArtistTracks(artist.id).catch(() => null),
        api.getArtistAlbums(artist.id).catch(() => null),
      ]);

      if (tracksRes?.success && tracksRes.data) {
        const songs = tracksRes.data.map(t =>
          formatBackendTrackToSong(t, false, offlineService.isDownloaded(t.id))
        );
        setArtistTracks(songs);
      } else {
        setArtistTracks([]);
      }

      if (albumsRes?.success && albumsRes.data) {
        const albs: Album[] = albumsRes.data.map(a => ({
          id: a.id || a._id || '',
          title: a.title,
          artistId: artist.id,
          artistName: artist.name,
          artwork: a.artworkUrl || null,
          year: a.releaseYear || 2026,
          songCount: a.tracks?.length || 1,
        }));
        setArtistAlbums(albs);
      } else {
        setArtistAlbums([]);
      }
    } catch {
      setArtistTracks([]);
      setArtistAlbums([]);
    } finally {
      setLoadingTracks(false);
    }
  }, []);

  // Fetch real artists from backend
  useEffect(() => {
    async function fetchArtists() {
      try {
        setError(null);
        const res = await api.getArtists();
        if (res.success && res.data) {
          const mapped: Artist[] = res.data.map(ar => ({
            id: ar.id || ar._id || '',
            name: ar.name,
            artwork: ar.artworkUrl || null,
            languages: ['English', 'Hindi'],
            genres: (ar.genres || []).map(g => (typeof g === 'object' ? (g as any).name : String(g))),
          }));
          setArtists(mapped);

          // Auto-select if requested
          const targetId = typeof params.id === 'string' ? params.id : null;
          const targetSearch = typeof params.search === 'string' ? params.search.toLowerCase() : null;
          if (targetId || targetSearch) {
            const found = mapped.find(
              a => (targetId && a.id === targetId) || (targetSearch && a.name.toLowerCase() === targetSearch)
            );
            if (found) handleSelectArtist(found);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Unable to load artists from Dhun server.');
      }
    }
    fetchArtists();
  }, [params.id, params.search, handleSelectArtist]);

  // React to param changes if artists are already loaded
  useEffect(() => {
    if (artists.length === 0) return;
    const targetId = typeof params.id === 'string' ? params.id : null;
    const targetSearch = typeof params.search === 'string' ? params.search.toLowerCase() : null;
    if (targetId || targetSearch) {
      const found = artists.find(
        a => (targetId && a.id === targetId) || (targetSearch && a.name.toLowerCase() === targetSearch)
      );
      if (found && (!selectedArtist || selectedArtist.id !== found.id)) {
        handleSelectArtist(found);
      }
    }
  }, [params.id, params.search, artists, selectedArtist, handleSelectArtist]);

  const filteredArtists = search.trim()
    ? artists.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
    : artists;

  if (selectedArtist) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
            <Pressable
              onPress={() => setSelectedArtist(null)}
              hitSlop={12}
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>

          {/* Artist profile */}
          <View style={styles.artistProfile}>
            <ArtistBorderRing
              id={selectedArtist.id}
              iconSize={120}
              gap={4}
              duration={6.0}
              strokeWidth={2.4}
            >
              <View
                style={[
                  styles.artistLargeAvatar,
                  {
                    backgroundColor: stringToColor(selectedArtist.name),
                    borderColor: glass.borderHighlight,
                    borderWidth: 1.5,
                  },
                ]}
              >
                <Text style={styles.artistLargeInitials}>
                  {getInitials(selectedArtist.name)}
                </Text>
              </View>
            </ArtistBorderRing>
            <Text style={[typography.h1, { color: colors.textPrimary, marginTop: spacing.lg }]}>
              {selectedArtist.name}
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs }]}>
              {selectedArtist.genres.join(' · ') || 'Artist'}
            </Text>
            {selectedArtist.languages?.length > 0 && (
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                {selectedArtist.languages.join(', ')}
              </Text>
            )}
          </View>

          {loadingTracks ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: spacing.xl }} />
          ) : (
            <>
              {/* Albums */}
              {artistAlbums.length > 0 && (
                <>
                  <Text style={[typography.h3, { color: colors.textPrimary, paddingHorizontal: spacing.lg, paddingTop: spacing.xl }]}>
                    Albums
                  </Text>
                  {artistAlbums.map(album => (
                    <Pressable
                      key={album.id}
                      style={styles.albumRow}
                      onPress={() => {
                        const matched = artistTracks.find(s => s.albumId === album.id) || artistTracks[0];
                        if (matched) play(matched, artistTracks);
                      }}
                    >
                      <View
                        style={[
                          styles.albumSmallArt,
                          { backgroundColor: stringToColor(album.title), borderRadius: radius.sm },
                        ]}
                      >
                        <Text style={styles.albumSmallText}>{getInitials(album.title)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.body, { color: colors.textPrimary }]}>{album.title}</Text>
                        <Text style={[typography.caption, { color: colors.textSecondary }]}>
                          {album.year} · {album.songCount} songs
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </>
              )}

              {/* Songs */}
              <Text style={[typography.h3, { color: colors.textPrimary, paddingHorizontal: spacing.lg, paddingTop: spacing.xl }]}>
                Songs ({artistTracks.length})
              </Text>
              {artistTracks.length > 0 ? (
                artistTracks.map(song => (
                  <SongRow
                    key={song.id}
                    song={song}
                    onPress={() => play(song, artistTracks)}
                    isActive={currentSong?.id === song.id}
                  />
                ))
              ) : (
                <Text style={[typography.body, { color: colors.textMuted, paddingHorizontal: spacing.lg, paddingTop: spacing.md }]}>
                  No songs available for this artist yet.
                </Text>
              )}
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => safeBack(router, '/(tabs)/library')} hitSlop={12} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={[typography.h1, { color: colors.textPrimary, flex: 1, marginLeft: spacing.lg }]}>
            Artists
          </Text>
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { borderColor: glass.border, backgroundColor: glass.surface }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search artists..."
            placeholderTextColor={colors.textMuted}
            style={[typography.body, styles.searchInput, { color: colors.textPrimary }]}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Artist Grid */}
        <View style={styles.grid}>
          {filteredArtists.map(artist => (
            <Pressable
              key={artist.id}
              style={styles.gridItem}
              onPress={() => handleSelectArtist(artist)}
            >
              <ArtistBorderRing
                id={artist.id}
                iconSize={80}
                gap={3.5}
                duration={5.5}
                strokeWidth={2}
              >
                <View
                  style={[
                    styles.artistAvatar,
                    {
                      backgroundColor: stringToColor(artist.name),
                      borderColor: glass.borderHighlight,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={styles.artistInitials}>{getInitials(artist.name)}</Text>
                </View>
              </ArtistBorderRing>
              <Text
                style={[typography.bodySmall, { color: colors.textPrimary, marginTop: spacing.sm, textAlign: 'center' }]}
                numberOfLines={1}
              >
                {artist.name}
              </Text>
              <Text
                style={[typography.caption, { color: colors.textSecondary, textAlign: 'center' }]}
                numberOfLines={1}
              >
                {artist.genres.slice(0, 2).join(', ') || 'Artist'}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  searchInput: {
    flex: 1,
    padding: 0,
    margin: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  gridItem: {
    width: '45%',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  artistAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  artistInitials: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  artistProfile: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  artistLargeAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  artistLargeInitials: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '600',
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  albumSmallArt: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumSmallText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
