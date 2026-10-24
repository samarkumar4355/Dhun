// ─── Sources / Import Studio Screen ─────────────────────────────────

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { usePlayer } from '@/services/PlayerProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { FlowingWaves } from '@/animations/FlowingWaves';
import { MiniPlayer } from '@/components/MiniPlayer';
import { GlassSurface } from '@/components/GlassSurface';

export default function SourcesScreen() {
  const { colors, glass } = useTheme();
  const { currentSong } = usePlayer();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: currentSong ? 100 : 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
          <Text style={[typography.h1, { color: colors.textPrimary }]}>Add Music to Dhun</Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            Bring your collection, your way.
          </Text>
        </View>

        {/* Import options */}
        <View style={styles.section}>
          <ImportOption
            icon="phone-portrait"
            title="Import from device"
            subtitle="Select audio files from your phone or storage."
            onPress={() => router.push('/import-progress')}
            colors={colors}
          />
          <ImportOption
            icon="logo-google"
            title="Import from Google Drive"
            subtitle="Choose music files or ZIP archives."
            onPress={() => router.push('/import-progress')}
            colors={colors}
          />
          <ImportOption
            icon="layers"
            title="Manage imports"
            subtitle="View progress, errors, storage & duplicates."
            onPress={() => router.push('/import-progress')}
            colors={colors}
          />
        </View>

        {/* Supported formats */}
        <View style={styles.formatsContainer}>
          <GlassSurface
            variant="subtle"
            borderRadius={radius.lg}
            style={styles.formatsCard}
          >
            <View style={styles.formatsRow}>
              <Ionicons name="information-circle" size={16} color={colors.accent} />
              <Text style={[typography.bodySmall, { color: colors.textPrimary, marginLeft: spacing.sm, fontWeight: '500' }]}>
                Supported lossless & compressed formats
              </Text>
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs, marginLeft: 24 }]}>
              FLAC, ALAC, WAV, AIFF, MP3, AAC, OGG
            </Text>
          </GlassSurface>
        </View>

        {/* Flowing Waves */}
        <View style={styles.wavesSection}>
          <FlowingWaves height={180} waveCount={5} />
        </View>
      </ScrollView>

      {currentSong && (
        <View style={styles.miniPlayerContainer}>
          <MiniPlayer />
        </View>
      )}
    </View>
  );
}

function ImportOption({
  icon,
  title,
  subtitle,
  onPress,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <GlassSurface
      variant="card"
      borderRadius={radius.lg}
      showTopHighlight
      onPress={onPress}
      style={styles.importOption}
      accessibilityLabel={title}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={24} color={colors.accent} style={styles.importIcon} />
      <View style={{ flex: 1 }}>
        <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '600' }]}>
          {title}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  section: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  importOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 0.5,
  },
  importIcon: {
    marginRight: spacing.lg,
    width: 28,
  },
  formatsContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  formatsCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  formatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wavesSection: {
    marginTop: spacing['3xl'],
  },
  miniPlayerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
