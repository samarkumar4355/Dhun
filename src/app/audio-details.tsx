// ─── Audio Details Screen ───────────────────────────────────────────

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { usePlayer } from '@/services/PlayerProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { QualityBadge } from '@/components/QualityBadge';
import { formatFileSize, formatSampleRate, stringToColor, getInitials } from '@/utils/helpers';

export default function AudioDetailsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentSong } = usePlayer();

  if (!currentSong) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: 60 }]}>
          No track selected
        </Text>
      </View>
    );
  }

  const isLossless = ['FLAC', 'ALAC', 'WAV', 'AIFF'].includes(currentSong.format);

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
          <Text style={[typography.h3, { color: colors.textPrimary, marginLeft: spacing.lg }]}>Audio Details</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Track artwork and info */}
        <View style={styles.trackSection}>
          <View
            style={[
              styles.artwork,
              { backgroundColor: stringToColor(currentSong.title), borderRadius: radius.lg },
            ]}
          >
            <Text style={styles.artworkText}>{getInitials(currentSong.title)}</Text>
          </View>
          <View style={styles.trackInfo}>
            <Text style={[typography.h3, { color: colors.textPrimary }]} numberOfLines={2}>
              {currentSong.title}
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
              {currentSong.artistName}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
              {currentSong.albumName}
            </Text>
          </View>
        </View>

        {/* Source File section */}
        <View style={[styles.detailsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            Source File
          </Text>

          <DetailRow label="Format" value={currentSong.format} colors={colors} />
          <DetailRow label="Bit Depth" value={`${currentSong.bitDepth} bit`} colors={colors} />
          <DetailRow label="Sample Rate" value={formatSampleRate(currentSong.sampleRate)} colors={colors} />
          <DetailRow label="File Size" value={formatFileSize(currentSong.fileSize)} colors={colors} />
          <DetailRow
            label="Source"
            value={
              currentSong.source === 'local' ? 'Device Storage' :
              currentSong.source === 'google-drive' ? 'Google Drive' : 'Imported'
            }
            colors={colors}
          />
          <DetailRow
            label="Offline"
            value={currentSong.isOffline ? 'Available' : 'Requires network'}
            colors={colors}
            isLast
          />
        </View>

        {/* Playback Details */}
        <View style={[styles.detailsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            Playback Details
          </Text>

          <DetailRow
            label="Output Sample Rate"
            value={formatSampleRate(currentSong.sampleRate)}
            colors={colors}
          />
          <DetailRow
            label="Bit Depth (Output)"
            value={`${currentSong.bitDepth} bit`}
            colors={colors}
          />
          <DetailRow
            label="Playback Route"
            value="Wired Headphones"
            colors={colors}
            isLast
          />
        </View>

        {/* Quality note */}
        <View style={[styles.qualityNote, { backgroundColor: colors.accentSubtle, borderColor: colors.accent }]}>
          <Ionicons
            name={isLossless ? 'checkmark-circle' : 'information-circle'}
            size={18}
            color={colors.accent}
            style={{ marginRight: spacing.sm }}
          />
          <Text style={[typography.bodySmall, { color: colors.textPrimary, flex: 1 }]}>
            {isLossless
              ? 'This file is lossless and plays at its original quality.'
              : 'This file uses lossy compression. Some audio detail may be reduced.'}
          </Text>
        </View>

        {/* Quality Badge */}
        <View style={styles.badgeRow}>
          <QualityBadge
            format={currentSong.format}
            bitDepth={currentSong.bitDepth}
            sampleRate={currentSong.sampleRate}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({
  label,
  value,
  colors,
  isLast = false,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
  isLast?: boolean;
}) {
  return (
    <View
      style={[
        styles.detailRow,
        !isLast && { borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle },
      ]}
    >
      <Text style={[typography.body, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '500' }]}>{value}</Text>
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
  backButton: {
    padding: spacing.md,
  },
  trackSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  artwork: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  artworkText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 24,
    fontWeight: '600',
  },
  trackInfo: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  detailsCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 0.5,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  qualityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    marginBottom: spacing.lg,
  },
  badgeRow: {
    paddingHorizontal: spacing.lg,
  },
});
