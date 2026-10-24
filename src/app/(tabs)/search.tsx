// ─── Search Screen ──────────────────────────────────────────────────

import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { usePlayer } from '@/services/PlayerProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { ArtistCard } from '@/components/ArtistCard';
import { SongRow } from '@/components/SongRow';
import { MiniPlayer } from '@/components/MiniPlayer';
import { GlassSurface } from '@/components/GlassSurface';
import { mockSongs } from '@/data/mockSongs';
import { mockArtists } from '@/data/mockArtists';
import { mockAlbums } from '@/data/mockAlbums';

const trendingArtists = ['Arijit Singh', 'Taylor Swift', 'lofi', 'The Weeknd', 'A.R. Rahman', 'Armaan Malik'];

export default function SearchScreen() {
  const { colors, glass } = useTheme();
  const { currentSong, play } = usePlayer();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const filteredSongs = query.trim()
    ? mockSongs.filter(
        s =>
          s.title.toLowerCase().includes(query.toLowerCase()) ||
          s.artistName.toLowerCase().includes(query.toLowerCase()) ||
          s.albumName.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const filteredArtists = query.trim()
    ? mockArtists.filter(a => a.name.toLowerCase().includes(query.toLowerCase()))
    : [];

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
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search songs, artists, albums, genres..."
            placeholderTextColor={colors.textMuted}
            style={[typography.body, styles.searchInput, { color: colors.textPrimary }]}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </GlassSurface>

        {query.trim() === '' ? (
          <>
            {/* Trending */}
            <View style={styles.section}>
              <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>
                Trending
              </Text>
              <View style={styles.chipRow}>
                {trendingArtists.map(name => (
                  <GlassSurface
                    key={name}
                    variant="subtle"
                    borderRadius={radius.full}
                    onPress={() => setQuery(name)}
                    style={styles.chip}
                  >
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                      {name}
                    </Text>
                  </GlassSurface>
                ))}
              </View>
            </View>

            {/* Browse by */}
            <View style={styles.section}>
              <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>
                Browse by
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {mockArtists.slice(0, 4).map(artist => (
                  <ArtistCard
                    key={artist.id}
                    name={artist.name}
                    artwork={artist.artwork}
                    onPress={() => setQuery(artist.name)}
                    size={80}
                  />
                ))}
              </ScrollView>
            </View>

            {/* Browse categories */}
            <View style={styles.section}>
              {['Artists', 'Albums', 'Genres', 'Languages'].map(category => (
                <Pressable
                  key={category}
                  style={[styles.browseRow, { borderBottomColor: colors.borderSubtle }]}
                  onPress={() => setQuery(category.toLowerCase())}
                >
                  <Ionicons
                    name={
                      category === 'Artists' ? 'people' :
                      category === 'Albums' ? 'disc' :
                      category === 'Genres' ? 'pricetags' : 'globe'
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

            {/* Recently Searched */}
            <View style={styles.section}>
              <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>
                Recently Searched
              </Text>
              {['Coldplay', 'Diljit Dosanjh', 'Lana Del Rey'].map(name => {
                const artist = mockArtists.find(a => a.name === name);
                return (
                  <Pressable
                    key={name}
                    style={styles.recentRow}
                    onPress={() => setQuery(name)}
                  >
                    <View style={styles.recentInfo}>
                      <ArtistCard name={name} artwork={null} size={40} />
                    </View>
                    <Pressable hitSlop={8} onPress={() => {}}>
                      <Ionicons name="close" size={16} color={colors.textMuted} />
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <>
            {/* Search Results */}
            {filteredArtists.length > 0 && (
              <View style={styles.section}>
                <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                  Artists
                </Text>
                {filteredArtists.map(artist => (
                  <Pressable
                    key={artist.id}
                    style={styles.resultRow}
                  >
                    <ArtistCard name={artist.name} artwork={null} size={44} />
                  </Pressable>
                ))}
              </View>
            )}

            {filteredSongs.length > 0 && (
              <View style={styles.section}>
                <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                  Songs
                </Text>
                {filteredSongs.map(song => (
                  <SongRow
                    key={song.id}
                    song={song}
                    onPress={() => play(song)}
                    isActive={currentSong?.id === song.id}
                  />
                ))}
              </View>
            )}

            {filteredSongs.length === 0 && filteredArtists.length === 0 && (
              <View style={styles.emptySearch}>
                <Ionicons name="search" size={40} color={colors.textMuted} />
                <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md }]}>
                  No results for "{query}"
                </Text>
              </View>
            )}
          </>
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
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  recentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultRow: {
    paddingVertical: spacing.xs,
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
