// ─── Dhun Moments Screen ────────────────────────────────────────────

import React from 'react';
import { View, Text, ScrollView, Pressable, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { usePlayer } from '@/services/PlayerProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { MoodCard } from '@/components/MoodCard';
import { SongRow } from '@/components/SongRow';
import { SectionHeader } from '@/components/SectionHeader';
import { GlassSurface } from '@/components/GlassSurface';
import { mockMoments } from '@/data/mockMoments';
import { mockSongs } from '@/data/mockSongs';
import { MoodSession } from '@/types/music';
import { safeBack } from '@/utils/helpers';

export default function MomentsScreen() {
  const { colors, glass } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { play, currentSong } = usePlayer();
  const [selectedMood, setSelectedMood] = React.useState<MoodSession | null>(null);

  const featuredMoods = mockMoments.slice(0, 4);
  const moreMoods = mockMoments.slice(4);

  const moodSongs = selectedMood
    ? selectedMood.songIds
        .map(id => mockSongs.find(s => s.id === id))
        .filter(Boolean) as typeof mockSongs
    : [];

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
              Your mood. Your music.
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
              Every melody, a feeling.
            </Text>
          </GlassSurface>
        </View>

        {/* Featured moods — 2x2 grid */}
        <View style={styles.moodGrid}>
          {featuredMoods.map((mood, index) => (
            <View key={mood.id} style={styles.moodGridItem}>
              <MoodCard
                mood={mood}
                large
                onPress={() => setSelectedMood(selectedMood?.id === mood.id ? null : mood)}
              />
            </View>
          ))}
        </View>

        {/* Selected mood playlist */}
        {selectedMood && (
          <View style={styles.selectedSection}>
            <GlassSurface variant="card" showTopHighlight style={styles.selectedGlassCard}>
              <SectionHeader title={selectedMood.title} showSeeAll={false} />
              <Text style={[typography.bodySmall, { color: colors.textSecondary, paddingHorizontal: spacing.lg, marginBottom: spacing.md }]}>
                {selectedMood.description}
              </Text>
              {moodSongs.map(song => (
                <SongRow
                  key={song.id}
                  song={song}
                  onPress={() => play(song)}
                  isActive={currentSong?.id === song.id}
                />
              ))}
            </GlassSurface>
          </View>
        )}

        {/* More Moments */}
        <SectionHeader title="More Moments" showSeeAll={false} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        >
          {moreMoods.map(mood => (
            <MoodCard
              key={mood.id}
              mood={mood}
              onPress={() => setSelectedMood(selectedMood?.id === mood.id ? null : mood)}
            />
          ))}
        </ScrollView>
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
