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
import { GlassSurface } from '@/components/GlassSurface';
import { AnimatedBorder } from '@/components/AnimatedBorder';
import { formatFileSize, formatSampleRate, stringToColor, getInitials, safeBack } from '@/utils/helpers';

export default function AudioDetailsScreen() {
  const { colors, glass } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentSong } = usePlayer();

  if (!currentSong) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Pressable onPress={() => safeBack(router, '/(tabs)/listen')} style={styles.backButton}>
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
          <Pressable onPress={() => safeBack(router, '/(tabs)/listen')} hitSlop={12} accessibilityLabel="Go back">
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
        <AnimatedBorder
          id="lossless_card"
          active={isLossless}
          borderRadius={radius.lg}
          style={styles.cardBorderWrapper}
          duration={7}
          strokeWidth={1.3}
        >
          <GlassSurface
            variant="card"
            borderRadius={radius.lg}
            showTopHighlight
            style={styles.detailsCard}
          >
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
          </GlassSurface>
        </AnimatedBorder>

        {/* Playback Details */}
        <GlassSurface
          variant="card"
          borderRadius={radius.lg}
          showTopHighlight
          style={[styles.detailsCard, { marginHorizontal: spacing.lg }]}
        >
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
        </GlassSurface>

        {/* Quality note */}
        <GlassSurface
          variant="subtle"
          borderRadius={radius.md}
          showTopHighlight
          style={[styles.qualityNote, { marginHorizontal: spacing.lg }]}
        >
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
        </GlassSurface>

        {/* Lyrics Section */}
        <GlassSurface
          variant="card"
          borderRadius={radius.lg}
          showTopHighlight
          style={[styles.detailsCard, { marginHorizontal: spacing.lg, marginBottom: spacing.lg }]}
        >
          <View style={styles.lyricsCardHeader}>
            <Ionicons name="document-text-outline" size={18} color={colors.accent} style={{ marginRight: spacing.sm }} />
            <Text style={[typography.label, { color: colors.textSecondary }]}>
              Lyrics
            </Text>
          </View>

          {currentSong.lyrics && currentSong.lyrics.trim().length > 0 ? (
            <View style={styles.lyricsBody}>
              <Text
                style={[
                  styles.lyricsText,
                  { color: colors.textPrimary },
                ]}
                selectable
              >
                {currentSong.lyrics}
              </Text>
            </View>
          ) : (
            <View style={styles.lyricsUnavailableBox}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>
                Lyrics unavailable
              </Text>
            </View>
          )}
        </GlassSurface>

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
  cardBorderWrapper: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  detailsCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
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
  lyricsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  lyricsBody: {
    marginTop: spacing.xs,
  },
  lyricsText: {
    fontSize: 14,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  lyricsUnavailableBox: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});
