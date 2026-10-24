// ─── Playlists Screen ───────────────────────────────────────────────

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { usePlayer } from '@/services/PlayerProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { mockPlaylists } from '@/data/mockPlaylists';
import { stringToColor, getInitials } from '@/utils/helpers';
import { Playlist } from '@/types/music';

type PlaylistTab = 'My Playlists' | 'Shared' | 'Auto';

export default function PlaylistsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<PlaylistTab>('My Playlists');
  const [playlists, setPlaylists] = useState(mockPlaylists);

  const handleCreate = () => {
    Alert.prompt?.(
      'New Playlist',
      'Enter a name for your playlist',
      (name: string) => {
        if (name.trim()) {
          setPlaylists(prev => [
            {
              id: `playlist-new-${Date.now()}`,
              name: name.trim(),
              artwork: null,
              songIds: [],
              createdAt: new Date().toISOString(),
            },
            ...prev,
          ]);
        }
      }
    ) ??
    Alert.alert('New Playlist', 'Create playlist functionality is a prototype.', [{ text: 'OK' }]);
  };

  const handleDelete = (playlistId: string, name: string) => {
    Alert.alert(
      'Delete Playlist',
      `Are you sure you want to delete "${name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => setPlaylists(prev => prev.filter(p => p.id !== playlistId)),
        },
      ]
    );
  };

  const displayPlaylists = activeTab === 'My Playlists'
    ? playlists
    : activeTab === 'Auto'
    ? playlists.slice(0, 3)
    : [];

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
          <Text style={[typography.h1, { color: colors.textPrimary, flex: 1, marginLeft: spacing.lg }]}>
            Playlists
          </Text>
          <Pressable onPress={handleCreate} hitSlop={12} accessibilityLabel="Create playlist">
            <Ionicons name="add" size={28} color={colors.accent} />
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {(['My Playlists', 'Shared', 'Auto'] as PlaylistTab[]).map(tab => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.tab,
                { borderBottomColor: activeTab === tab ? colors.accent : 'transparent' },
              ]}
            >
              <Text
                style={[
                  typography.label,
                  { color: activeTab === tab ? colors.accent : colors.textSecondary },
                ]}
              >
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Playlist list */}
        {displayPlaylists.length > 0 ? (
          displayPlaylists.map(playlist => (
            <PlaylistRow
              key={playlist.id}
              playlist={playlist}
              colors={colors}
              onPress={() => {}}
              onDelete={() => handleDelete(playlist.id, playlist.name)}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="musical-notes" size={48} color={colors.textMuted} />
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.lg }]}>
              {activeTab === 'Shared' ? 'No shared playlists yet.' : 'No playlists here.'}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs }]}>
              Every memory starts with a song.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function PlaylistRow({
  playlist,
  colors,
  onPress,
  onDelete,
}: {
  playlist: Playlist;
  colors: ReturnType<typeof useTheme>['colors'];
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.playlistRow,
        { opacity: pressed ? 0.7 : 1 },
      ]}
      accessibilityLabel={`${playlist.name}, ${playlist.songIds.length} songs`}
    >
      <View
        style={[
          styles.playlistArtwork,
          { backgroundColor: stringToColor(playlist.name), borderRadius: radius.md },
        ]}
      >
        <Text style={styles.playlistInitials}>{getInitials(playlist.name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '500' }]}>
          {playlist.name}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {playlist.songIds.length} songs
        </Text>
      </View>
      <Pressable onPress={onDelete} hitSlop={8} accessibilityLabel="More options">
        <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
      </Pressable>
    </Pressable>
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
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
    marginBottom: spacing.md,
  },
  tab: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  playlistArtwork: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  playlistInitials: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 18,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['6xl'],
  },
});
