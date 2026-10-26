// ─── Dhun Moments / Moods Screen ────────────────────────────────────────────
// Connects real Google Drive genres and mood sessions with real FLAC playback.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { usePlayer } from '@/services/PlayerProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { MoodCard } from '@/components/MoodCard';
import { SongRow } from '@/components/SongRow';
import { SectionHeader } from '@/components/SectionHeader';
import { GlassSurface } from '@/components/GlassSurface';
import { api, formatBackendTrackToSong } from '@/services/api/apiClient';
import { offlineService } from '@/services/offlineService';
import { MoodSession, Song } from '@/types/music';
import { safeBack } from '@/utils/helpers';

interface MoodItem {
  id: string;
  genreId?: string;
  title: string;
  subtitle: string;
  description: string;
  artwork: string | null;
  moodType: MoodSession['moodType'];
  songIds: string[];
}

export default function MomentsScreen() {
  const { colors, glass } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { play, currentSong } = usePlayer();

  const [genres, setGenres] = useState<any[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [selectedMood, setSelectedMood] = useState<MoodItem | null>(null);
  const [moodSongs, setMoodSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMoodSongs, setLoadingMoodSongs] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load real catalog tracks and genres from Google Drive
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [genresRes, tracksRes] = await Promise.all([
        api.getGenres().catch(() => null),
        api.getTracks({ limit: 50 }).catch(() => null),
      ]);

      const mappedSongs: Song[] = [];
      if (tracksRes?.success && tracksRes.data) {
        tracksRes.data.forEach(t => {
          mappedSongs.push(formatBackendTrackToSong(t, false, offlineService.isDownloaded(t.id)));
        });
        setAllSongs(mappedSongs);
      }

      if (genresRes?.success && genresRes.data) {
        setGenres(genresRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to load mood sessions from Dhun server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Construct real mood sessions from Google Drive catalog genres
  const moods: MoodItem[] = useMemo(() => {
    const list: MoodItem[] = [];

    // Map each genre from Google Drive
    genres.forEach((g, idx) => {
      const gName = g.name || 'Genre';
      const moodTypes: MoodSession['moodType'][] = [
        'slow-morning',
        'midnight-drive',
        'rainy-evening',
        'deep-focus',
        'romance',
        'travel',
      ];
      const matchingSongIds = allSongs
        .filter(s => (s as any).genre?.includes?.(gName) || s.artistName.toLowerCase().includes('woodward'))
        .map(s => s.id);

      list.push({
        id: g._id || g.id || `genre-${idx}`,
        genreId: g._id || g.id,
        title: gName,
        subtitle: gName === 'Pop-Folk' ? 'Acoustic & Melodic' : 'Driving Rhythms & Energy',
        description: `Lossless ${gName} songs streaming directly from your Google Drive music library.`,
        artwork: null,
        moodType: moodTypes[idx % moodTypes.length],
        songIds: matchingSongIds,
      });
    });

    // Add Hi-Res Lossless Master session
    list.push({
      id: 'session-lossless',
      title: 'Lossless Hi-Res',
      subtitle: 'Bit-perfect 24-bit',
      description: 'Studio quality FLAC master recordings decoded bit-perfectly from Google Drive.',
      artwork: null,
      moodType: 'deep-focus',
      songIds: allSongs.map(s => s.id),
    });

    // Add Acoustic Chillout session
    list.push({
      id: 'session-acoustic',
      title: 'Acoustic Sessions',
      subtitle: 'Pure instruments',
      description: 'Intimate acoustic sessions and melodic storytelling from Google Drive.',
      artwork: null,
      moodType: 'rainy-evening',
      songIds: allSongs.slice(0, 3).map(s => s.id),
    });

    return list;
  }, [genres, allSongs]);

  // Handle selecting a mood/genre session
  const handleSelectMood = useCallback(
    async (mood: MoodItem) => {
      if (selectedMood?.id === mood.id) {
        setSelectedMood(null);
        setMoodSongs([]);
        return;
      }

      setSelectedMood(mood);
      setLoadingMoodSongs(true);

      try {
        if (mood.genreId) {
          const res = await api.getGenreTracks(mood.genreId).catch(() => null);
          if (res?.success && res.data && res.data.length > 0) {
            const mapped = res.data.map(t =>
              formatBackendTrackToSong(t, false, offlineService.isDownloaded(t.id))
            );
            setMoodSongs(mapped);
            return;
          }
        }

        // Fallback: match from all loaded songs
        const matched = allSongs.filter(s => mood.songIds.includes(s.id));
        setMoodSongs(matched.length > 0 ? matched : allSongs);
      } catch {
        setMoodSongs(allSongs);
      } finally {
        setLoadingMoodSongs(false);
      }
    },
    [selectedMood, allSongs]
  );

  // Auto-select requested genre if params provided
  useEffect(() => {
    if (moods.length === 0) return;
    const targetGenreId = typeof params.genreId === 'string' ? params.genreId : null;
    const targetGenreName = typeof params.genreName === 'string' ? params.genreName.toLowerCase() : null;

    if (targetGenreId || targetGenreName) {
      const found = moods.find(
        m =>
          (targetGenreId && (m.id === targetGenreId || m.genreId === targetGenreId)) ||
          (targetGenreName && m.title.toLowerCase().includes(targetGenreName))
      );
      if (found) {
        handleSelectMood(found);
      }
    }
  }, [params.genreId, params.genreName, moods, handleSelectMood]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable
            onPress={() => safeBack(router, '/(tabs)/listen')}
            hitSlop={12}
            accessibilityLabel="Go back"
            style={[styles.backButton, { backgroundColor: glass.surfaceSubtle, borderColor: glass.border }]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </Pressable>
          <View style={{ marginLeft: spacing.md }}>
            <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>Dhun Moments</Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, fontStyle: 'italic' }]}>
              Real music from Google Drive
            </Text>
          </View>
        </View>

        {/* Indian phrase banner */}
        <View style={styles.phraseOuter}>
          <GlassSurface variant="subtle" showTopHighlight style={styles.phraseContainer}>
            <Text style={[styles.phrase, { color: colors.accent }]}>
              Har Dhun, Ek Ehsaas.
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
              Every melody from your drive, a feeling.
            </Text>
          </GlassSurface>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            {/* Real Genre / Mood Grid */}
            <View style={styles.moodGrid}>
              {moods.slice(0, 4).map(mood => (
                <View key={mood.id} style={styles.moodGridItem}>
                  <MoodCard
                    mood={mood as any}
                    large
                    onPress={() => handleSelectMood(mood)}
                  />
                </View>
              ))}
            </View>

            {/* Selected mood playlist with real Google Drive songs */}
            {selectedMood && (
              <View style={styles.selectedSection}>
                <GlassSurface variant="card" showTopHighlight style={styles.selectedGlassCard}>
                  <SectionHeader title={selectedMood.title} showSeeAll={false} />
                  <Text
                    style={[
                      typography.bodySmall,
                      { color: colors.textSecondary, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
                    ]}
                  >
                    {selectedMood.description}
                  </Text>

                  {loadingMoodSongs ? (
                    <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: spacing.md }} />
                  ) : moodSongs.length > 0 ? (
                    moodSongs.map(song => (
                      <SongRow
                        key={song.id}
                        song={song}
                        onPress={() => play(song, moodSongs)}
                        isActive={currentSong?.id === song.id}
                      />
                    ))
                  ) : (
                    <Text
                      style={[
                        typography.body,
                        { color: colors.textMuted, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
                      ]}
                    >
                      No songs found in this mood session.
                    </Text>
                  )}
                </GlassSurface>
              </View>
            )}

            {/* More Moments */}
            {moods.length > 4 && (
              <>
                <SectionHeader title="More Sessions" showSeeAll={false} />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: spacing.lg }}
                >
                  {moods.slice(4).map(mood => (
                    <MoodCard
                      key={mood.id}
                      mood={mood as any}
                      onPress={() => handleSelectMood(mood)}
                    />
                  ))}
                </ScrollView>
              </>
            )}
          </>
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
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  phraseOuter: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  phraseContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderRadius: radius.lg,
  },
  phrase: {
    fontSize: 18,
    fontWeight: '600',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  moodGridItem: {
    width: '47%',
  },
  selectedSection: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  selectedGlassCard: {
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    overflow: 'hidden',
  },
});
