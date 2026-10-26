// ─── Search Screen ──────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { usePlayer } from '@/services/PlayerProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { ArtistCard } from '@/components/ArtistCard';
import { AlbumCard } from '@/components/AlbumCard';
import { SongRow } from '@/components/SongRow';
import { MiniPlayer } from '@/components/MiniPlayer';
import { GlassSurface } from '@/components/GlassSurface';
import { api, formatBackendTrackToSong } from '@/services/api/apiClient';
import { offlineService } from '@/services/offlineService';
import { Song, Artist, Album } from '@/types/music';

const trendingKeywords = ['Josh Woodward', 'Lossless', 'Classical', 'Flac', 'Acoustic', 'Folk'];

export default function SearchScreen() {
  const { colors, glass } = useTheme();
  const { currentSong, play } = usePlayer();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [query, setQuery] = useState(typeof params.q === 'string' ? params.q : '');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [resultsSongs, setResultsSongs] = useState<Song[]>([]);
  const [resultsArtists, setResultsArtists] = useState<Artist[]>([]);
  const [resultsAlbums, setResultsAlbums] = useState<Album[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResultsSongs([]);
      setResultsArtists([]);
      setResultsAlbums([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const res = await api.search(query.trim());
        if (res.success && res.data) {
          const songsMapped = (res.data.tracks || []).map(t =>
            formatBackendTrackToSong(t, false, offlineService.isDownloaded(t.id))
          );
          const artistsMapped: Artist[] = (res.data.artists || []).map(a => ({
            id: a.id || a._id || '',
            name: a.name,
            artwork: a.artworkUrl || null,
            languages: ['English', 'Hindi'],
            genres: (a.genres || []).map(g => (typeof g === 'object' ? (g as any).name : String(g))),
          }));
          const albumsMapped: Album[] = (res.data.albums || []).map(al => ({
            id: al.id || al._id || '',
            title: al.title,
            artistId: typeof al.artists?.[0] === 'object' ? (al.artists[0] as any).id : '',
            artistName: typeof al.artists?.[0] === 'object' ? (al.artists[0] as any).name : 'Artist',
            artwork: al.artworkUrl || null,
            year: al.releaseYear || 2026,
            songCount: al.tracks?.length || 1,
          }));

          setResultsSongs(songsMapped);
          setResultsArtists(artistsMapped);
          setResultsAlbums(albumsMapped);
        }
      } catch (err: any) {
        setSearchError(err.message || 'Unable to connect to search service.');
        setResultsSongs([]);
        setResultsArtists([]);
        setResultsAlbums([]);
      } finally {
        setSearching(false);
      }
    }, 280);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: currentSong ? 100 : 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
          <Text style={[typography.h1, { color: colors.textPrimary }]}>Search</Text>
        </View>

        {/* Frosted Glass Search Bar */}
        <GlassSurface
          variant="card"
          borderRadius={radius.lg}
          showTopHighlight
          style={styles.searchBar}
        >
          {searching ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons name="search" size={18} color={colors.textMuted} />
          )}
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search songs, artists, albums, genres..."
            placeholderTextColor={colors.textMuted}
            style={[typography.body, styles.searchInput, { color: colors.textPrimary }]}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </GlassSurface>

        {searchError && (
          <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.md, backgroundColor: 'rgba(224, 122, 95, 0.1)', borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSubtle }}>
            <Text style={[typography.bodySmall, { color: colors.textPrimary, textAlign: 'center' }]}>
              {searchError}
            </Text>
          </View>
        )}

        {query.trim() === '' ? (
          <>
            {/* Trending / Suggested */}
            <View style={styles.section}>
              <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>
                Suggested Searches
              </Text>
              <View style={styles.chipRow}>
                {trendingKeywords.map(keyword => (
                  <GlassSurface
                    key={keyword}
                    variant="subtle"
                    borderRadius={radius.full}
                    onPress={() => setQuery(keyword)}
                    style={styles.chip}
                  >
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                      {keyword}
                    </Text>
                  </GlassSurface>
                ))}
              </View>
            </View>

            {/* Quick Categories */}
            <View style={styles.section}>
              <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>
                Browse Categories
              </Text>
              {['Lossless Tracks', 'Artists', 'Albums', 'Classical & Folk'].map(category => (
                <Pressable
                  key={category}
                  style={[styles.browseRow, { borderBottomColor: colors.borderSubtle }]}
                  onPress={() => {
                    if (category === 'Artists') router.push('/artists');
                    else if (category === 'Albums') router.push('/(tabs)/library');
                    else setQuery(category.replace(' Tracks', '').toLowerCase());
                  }}
                >
                  <Ionicons
                    name={
                      category === 'Artists' ? 'people' :
                      category === 'Albums' ? 'disc' :
                      category.includes('Lossless') ? 'shield-checkmark' : 'musical-note'
                    }
                    size={20}
                    color={colors.accent}
                    style={{ marginRight: spacing.md }}
                  />
                  <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>
                    {category}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <>
            {/* Artists Matches */}
            {resultsArtists.length > 0 && (
              <View style={styles.section}>
                <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                  Artists
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
                  {resultsArtists.map(artist => (
                    <ArtistCard
                      key={artist.id}
                      name={artist.name}
                      artwork={artist.artwork}
                      size={68}
                      onPress={() => router.push({ pathname: '/artists', params: { search: artist.name } })}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Albums Matches */}
            {resultsAlbums.length > 0 && (
              <View style={styles.section}>
                <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                  Albums
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
                  {resultsAlbums.map(album => (
                    <AlbumCard
                      key={album.id}
                      title={album.title}
                      artistName={album.artistName}
                      artwork={album.artwork}
                      onPress={() => {
                        const matched = resultsSongs.find(s => s.albumId === album.id) || resultsSongs[0];
                        if (matched) play(matched, resultsSongs);
                      }}
                      size={120}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Song Matches */}
            {resultsSongs.length > 0 && (
              <View style={styles.section}>
                <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                  Songs ({resultsSongs.length})
                </Text>
                {resultsSongs.map(song => (
                  <SongRow
                    key={song.id}
                    song={song}
                    onPress={() => play(song, resultsSongs)}
                    isActive={currentSong?.id === song.id}
                  />
                ))}
              </View>
            )}

            {/* Empty Search Notice */}
            {!searching && resultsSongs.length === 0 && resultsArtists.length === 0 && resultsAlbums.length === 0 && (
              <View style={styles.emptySearch}>
                <Ionicons name="search-outline" size={44} color={colors.textMuted} />
                <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md }]}>
                  No matches found for "{query}"
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                  Try searching for artist name, track title, or album.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Mini Player */}
      {currentSong && (
        <View style={styles.miniPlayerContainer}>
          <MiniPlayer />
        </View>
      )}
    </View>
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
  section: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  browseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  emptySearch: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['5xl'],
  },
  miniPlayerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
