// ─── Library Screen ─────────────────────────────────────────────────

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { usePlayer } from '@/services/PlayerProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { SongRow } from '@/components/SongRow';
import { MiniPlayer } from '@/components/MiniPlayer';
import { mockSongs } from '@/data/mockSongs';
import { mockAlbums } from '@/data/mockAlbums';
import { mockArtists } from '@/data/mockArtists';
import { mockPlaylists } from '@/data/mockPlaylists';

type LibraryTab = 'All' | 'Artists' | 'Albums' | 'Genres' | 'Folders';

const tabs: LibraryTab[] = ['All', 'Artists', 'Albums', 'Genres', 'Folders'];

export default function LibraryScreen() {
  const { colors } = useTheme();
  const { currentSong, play } = usePlayer();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<LibraryTab>('All');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filters = ['Local Files', 'Google Drive', 'Offline'];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: currentSong ? 100 : 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
          <Text style={[typography.h1, { color: colors.textPrimary }]}>Your Library</Text>
        </View>

        {/* Tabs */}
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

        {/* Library sections */}
        {activeTab === 'All' && (
          <>
            {/* Collection rows */}
            <LibraryRow
              icon="list"
              label="Playlists"
              count={`${mockPlaylists.length} playlists`}
              onPress={() => router.push('/playlists')}
              colors={colors}
            />
            <LibraryRow
              icon="people"
              label="Artists"
              count={`${mockArtists.length} artists`}
              onPress={() => router.push('/artists')}
              colors={colors}
            />
            <LibraryRow
              icon="disc"
              label="Albums"
              count={`${mockAlbums.length} albums`}
              onPress={() => router.push('/(tabs)/library')}
              colors={colors}
            />
            <LibraryRow
              icon="musical-notes"
              label="Songs"
              count={`${mockSongs.length} songs`}
              onPress={() => {}}
              colors={colors}
            />
            <LibraryRow
              icon="pricetags"
              label="Genres"
              count="12 genres"
              onPress={() => {}}
              colors={colors}
            />
            <LibraryRow
              icon="folder"
              label="Folders"
              count="8 folders"
              onPress={() => {}}
              colors={colors}
            />

            {/* Quick Filters */}
            <View style={styles.filterSection}>
              <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                Quick Filters
              </Text>
              <View style={styles.filterRow}>
                {filters.map(filter => (
                  <Pressable
                    key={filter}
                    onPress={() => setActiveFilter(activeFilter === filter ? null : filter)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: activeFilter === filter ? colors.accent : 'transparent',
                        borderColor: activeFilter === filter ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.caption,
                        {
                          color: activeFilter === filter ? colors.background : colors.textSecondary,
                        },
                      ]}
                    >
                      {filter}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Recent Songs */}
            <View style={styles.songsSection}>
              {mockSongs.map(song => (
                <SongRow
                  key={song.id}
                  song={song}
                  onPress={() => play(song)}
                  isActive={currentSong?.id === song.id}
                />
              ))}
            </View>
          </>
        )}

        {activeTab === 'Artists' && (
          <View style={styles.songsSection}>
            {mockArtists.map(artist => (
              <LibraryRow
                key={artist.id}
                icon="person"
                label={artist.name}
                count={artist.genres.join(', ')}
                onPress={() => router.push('/artists')}
                colors={colors}
              />
            ))}
          </View>
        )}

        {activeTab === 'Albums' && (
          <View style={styles.songsSection}>
            {mockAlbums.map(album => (
              <LibraryRow
                key={album.id}
                icon="disc"
                label={album.title}
                count={`${album.artistName} · ${album.year}`}
                onPress={() => {}}
                colors={colors}
              />
            ))}
          </View>
        )}

        {activeTab === 'Genres' && (
          <View style={styles.songsSection}>
            {['Bollywood', 'Indie', 'Rock', 'Pop', 'Classical', 'Hip-Hop', 'R&B', 'Electronic', 'Folk', 'Punjabi', 'Acoustic', 'Film Score'].map(genre => (
              <LibraryRow
                key={genre}
                icon="musical-note"
                label={genre}
                count=""
                onPress={() => {}}
                colors={colors}
              />
            ))}
          </View>
        )}

        {activeTab === 'Folders' && (
          <View style={styles.songsSection}>
            {['Music', 'Downloads', 'Imported', 'Google Drive', 'WhatsApp Audio', 'Recordings', 'Podcasts', 'Ringtones'].map(folder => (
              <LibraryRow
                key={folder}
                icon="folder"
                label={folder}
                count=""
                onPress={() => {}}
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
  miniPlayerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
