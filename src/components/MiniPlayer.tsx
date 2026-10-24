// ─── Mini Player ────────────────────────────────────────────────────

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { usePlayer } from '@/services/PlayerProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { formatDuration, stringToColor, getInitials } from '@/utils/helpers';

export function MiniPlayer() {
  const { colors } = useTheme();
  const { currentSong, isPlaying, progress, pause, resume } = usePlayer();
  const router = useRouter();

  if (!currentSong) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.miniPlayerBackground,
          borderTopColor: colors.border,
        },
      ]}
    >
      {/* Invisible navigation overlay — sits behind content so no nested <button> on web */}
      <Pressable
        onPress={() => router.push('/player')}
        style={StyleSheet.absoluteFill}
        accessibilityLabel={`Now playing: ${currentSong.title} by ${currentSong.artistName}`}
        accessibilityRole="link"
      />

      {/* Progress bar — non-interactive, passes touches through */}
      <View style={[styles.progressTrack, { backgroundColor: colors.progressTrack }]} pointerEvents="none">
        <View
          style={[
            styles.progressFill,
            { backgroundColor: colors.progressFill, width: `${progress * 100}%` },
          ]}
        />
      </View>

      <View style={styles.content} pointerEvents="box-none">
        {/* Artwork placeholder — non-interactive */}
        <View
          style={[
            styles.artwork,
            { backgroundColor: stringToColor(currentSong.title), borderRadius: radius.sm },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.artworkText}>{getInitials(currentSong.title)}</Text>
        </View>

        {/* Song info — non-interactive */}
        <View style={styles.info} pointerEvents="none">
          <Text
            style={[typography.label, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {currentSong.title}
          </Text>
          <Text
            style={[typography.caption, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {currentSong.artistName}
          </Text>
        </View>

        {/* Play/Pause — interactive, intercepts touches above nav overlay */}
        <Pressable
          onPress={() => {
            isPlaying ? pause() : resume();
          }}
          hitSlop={12}
          style={styles.playButton}
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          accessibilityRole="button"
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={24}
            color={colors.accent}
          />
        </Pressable>

        {/* Next */}
        <Pressable
          onPress={() => {}}
          hitSlop={12}
          accessibilityLabel="Next track"
          accessibilityRole="button"
        >
          <Ionicons name="play-forward" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 0.5,
    overflow: 'hidden',
  },
  progressTrack: {
    height: 2,
    width: '100%',
  },
  progressFill: {
    height: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  artwork: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  artworkText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
  info: {
    flex: 1,
    marginRight: spacing.sm,
  },
  playButton: {
    marginRight: spacing.lg,
  },
});
