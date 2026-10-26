// ─── Playlists Screen ───────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { usePlayer } from '@/services/PlayerProvider';
import { useAuth } from '@/services/AuthProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { GlassSurface } from '@/components/GlassSurface';
import { api, formatBackendTrackToSong } from '@/services/api/apiClient';
import { offlineService } from '@/services/offlineService';
import { stringToColor, getInitials, safeBack } from '@/utils/helpers';
import { Playlist, Song } from '@/types/music';

type PlaylistTab = 'My Playlists' | 'Curated' | 'Downloaded';

export default function PlaylistsScreen() {
  const { colors, glass, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { play } = usePlayer();
  const { isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<PlaylistTab>('My Playlists');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const loadPlaylists = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const res = await api.getUserPlaylists();
      if (res.success && res.data) {
        const mapped: Playlist[] = res.data.map(p => ({
          id: p.id || p._id || '',
          name: p.title,
          artwork: p.artworkUrl || null,
          songIds: (p.tracks || []).map(t => (t.track ? t.track.id : '')).filter(Boolean),
          createdAt: p.createdAt,
        }));
        setPlaylists(mapped);
      }
    } catch {
      // Empty
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const handleCreateSubmit = async () => {
    if (!newPlaylistTitle.trim()) return;
    setCreating(true);
    try {
      if (isAuthenticated) {
        const res = await api.createPlaylist({ title: newPlaylistTitle.trim() });
        if (res.success && res.data) {
          const created: Playlist = {
            id: res.data.id || res.data._id || '',
            name: res.data.title,
            artwork: res.data.artworkUrl || null,
            songIds: [],
            createdAt: res.data.createdAt,
          };
          setPlaylists(prev => [created, ...prev]);
        }
      } else {
        // Guest mode creation
        const newLocal: Playlist = {
          id: `playlist-local-${Date.now()}`,
          name: newPlaylistTitle.trim(),
          artwork: null,
          songIds: [],
          createdAt: new Date().toISOString(),
        };
        setPlaylists(prev => [newLocal, ...prev]);
      }
      setNewPlaylistTitle('');
      setShowCreateModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not create playlist');
    } finally {
      setCreating(false);
    }
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
          onPress: async () => {
            try {
              if (isAuthenticated) {
                await api.deletePlaylist(playlistId).catch(() => {});
              }
              setPlaylists(prev => prev.filter(p => p.id !== playlistId));
            } catch {
              // Delete locally
              setPlaylists(prev => prev.filter(p => p.id !== playlistId));
            }
          },
        },
      ]
    );
  };

  const handleOpenPlaylist = async (playlist: Playlist) => {
    try {
      const res = await api.getPlaylistById(playlist.id).catch(() => null);
      if (res?.success && res.data?.tracks && res.data.tracks.length > 0) {
        const songs = res.data.tracks
          .filter(t => t.track)
          .map(t => formatBackendTrackToSong(t.track!, false, offlineService.isDownloaded(t.track!.id)));
        if (songs.length > 0) {
          play(songs[0], songs);
          return;
        }
      }
    } catch {
      // Ignore
    }
    Alert.alert(playlist.name, `${playlist.songIds.length} tracks in this playlist.`);
  };

  const displayPlaylists =
    activeTab === 'My Playlists'
      ? playlists
      : activeTab === 'Curated'
      ? playlists.slice(0, 3)
      : playlists.filter(p => p.songIds.length > 0);

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
            Playlists
          </Text>
          <Pressable onPress={() => setShowCreateModal(true)} hitSlop={12} accessibilityLabel="Create playlist">
            <Ionicons name="add-circle" size={32} color={colors.accent} />
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {(['My Playlists', 'Curated', 'Downloaded'] as PlaylistTab[]).map(tab => (
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

        {/* Playlists List */}
        {loading ? (
          <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : displayPlaylists.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: spacing['2xl'], paddingHorizontal: spacing.xl }}>
            <Ionicons name="musical-notes-outline" size={48} color={colors.textMuted} />
            <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' }]}>
              No playlists found
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}>
              {isAuthenticated ? 'Tap the + icon in the top right to create your first playlist.' : 'Log in to create and manage personal playlists.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {displayPlaylists.map(playlist => (
              <GlassSurface
                key={playlist.id}
                variant="card"
                borderRadius={radius.lg}
                showTopHighlight
                style={styles.card}
                onPress={() => handleOpenPlaylist(playlist)}
              >
                <View
                  style={[
                    styles.artwork,
                    { backgroundColor: stringToColor(playlist.name) },
                  ]}
                >
                  <Text style={styles.artworkText}>{getInitials(playlist.name)}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={[typography.h3, { color: colors.textPrimary }]} numberOfLines={1}>
                    {playlist.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                    {playlist.songIds.length} tracks · Tap to play
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleDelete(playlist.id, playlist.name)}
                  hitSlop={12}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </Pressable>
              </GlassSurface>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Cross-platform New Playlist Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <GlassSurface
            variant="card"
            borderRadius={radius.xl}
            showTopHighlight
            style={[styles.modalCard, { backgroundColor: isDark ? 'rgba(30, 36, 34, 0.95)' : 'rgba(255, 255, 255, 0.95)' }]}
          >
            <Text style={[typography.h2, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              New Playlist
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
              Give your music collection a meaningful name
            </Text>

            <TextInput
              value={newPlaylistTitle}
              onChangeText={setNewPlaylistTitle}
              placeholder="e.g., Midnight Lossless, Raag Darbari..."
              placeholderTextColor={colors.textMuted}
              style={[
                typography.body,
                styles.modalInput,
                { color: colors.textPrimary, borderColor: glass.borderHighlight, backgroundColor: glass.surfaceSubtle },
              ]}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateSubmit}
            />

            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => {
                  setShowCreateModal(false);
                  setNewPlaylistTitle('');
                }}
                style={[styles.modalBtn, { borderColor: glass.border, borderWidth: 1 }]}
              >
                <Text style={[typography.label, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateSubmit}
                disabled={creating || !newPlaylistTitle.trim()}
                style={[
                  styles.modalBtn,
                  { backgroundColor: colors.accent, opacity: !newPlaylistTitle.trim() ? 0.6 : 1 },
                ]}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#1A1714" />
                ) : (
                  <Text style={[typography.label, { color: '#1A1714' }]}>Create</Text>
                )}
              </Pressable>
            </View>
          </GlassSurface>
        </View>
      </Modal>
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
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.lg,
  },
  tab: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
  },
  list: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  artwork: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  artworkText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  info: {
    flex: 1,
  },
  deleteButton: {
    padding: spacing.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    padding: spacing.xl,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    marginBottom: spacing.xl,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  modalBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
});
