// ─── Artists Screen ─────────────────────────────────────────────────

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { usePlayer } from '@/services/PlayerProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { SongRow } from '@/components/SongRow';
import { mockArtists } from '@/data/mockArtists';
import { mockSongs } from '@/data/mockSongs';
import { mockAlbums } from '@/data/mockAlbums';
import { stringToColor, getInitials } from '@/utils/helpers';
import { Artist } from '@/types/music';

export default function ArtistsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { play, currentSong } = usePlayer();
  const [search, setSearch] = useState('');
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);

  const filteredArtists = search.trim()
    ? mockArtists.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
    : mockArtists;

  const artistSongs = selectedArtist
    ? mockSongs.filter(s => s.artistId === selectedArtist.id)
    : [];

  const artistAlbums = selectedArtist
    ? mockAlbums.filter(a => a.artistId === selectedArtist.id)
    : [];

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
            <View
              style={[
                styles.artistLargeAvatar,
                { backgroundColor: stringToColor(selectedArtist.name) },
              ]}
            >
              <Text style={styles.artistLargeInitials}>
                {getInitials(selectedArtist.name)}
              </Text>
            </View>
            <Text style={[typography.h1, { color: colors.textPrimary, marginTop: spacing.lg }]}>
              {selectedArtist.name}
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs }]}>
              {selectedArtist.genres.join(' · ')}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
              {selectedArtist.languages.join(', ')}
            </Text>
          </View>

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
            Songs
          </Text>
          {artistSongs.length > 0 ? (
            artistSongs.map(song => (
              <SongRow
                key={song.id}
                song={song}
                onPress={() => play(song)}
                isActive={currentSong?.id === song.id}
              />
            ))
          ) : (
            <Text style={[typography.body, { color: colors.textMuted, paddingHorizontal: spacing.lg, paddingTop: spacing.md }]}>
              No songs found for this artist.
            </Text>
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
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={[typography.h1, { color: colors.textPrimary, marginLeft: spacing.lg, flex: 1 }]}>
            Artists
          </Text>
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search artists..."
            placeholderTextColor={colors.textMuted}
            style={[typography.body, styles.searchInput, { color: colors.textPrimary }]}
            returnKeyType="search"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Artist list */}
        {filteredArtists.map(artist => (
          <Pressable
            key={artist.id}
            onPress={() => setSelectedArtist(artist)}
            style={({ pressed }) => [
              styles.artistRow,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityLabel={artist.name}
          >
            <View
              style={[
                styles.artistAvatar,
                { backgroundColor: stringToColor(artist.name) },
              ]}
            >
              <Text style={styles.artistInitials}>{getInitials(artist.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '500' }]}>
                {artist.name}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {artist.genres.slice(0, 3).join(', ')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}

        {filteredArtists.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="people" size={48} color={colors.textMuted} />
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.lg }]}>
              No artists found for "{search}"
            </Text>
          </View>
        )}
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
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 60,
  },
  artistAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  artistInitials: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
  },
  artistProfile: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  artistLargeAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  artistLargeInitials: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 40,
    fontWeight: '600',
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  albumSmallArt: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  albumSmallText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['6xl'],
  },
});
