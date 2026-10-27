import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Dimensions, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { usePlayer } from '@/services/PlayerProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { stringToColor, getInitials } from '@/utils/helpers';
import { webGlassStyle, borderAnimationPalette } from '@/theme/glass';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function MiniPlayer() {
  const { colors, glass, isDark } = useTheme();
  const { currentSong, isPlaying, progress, pause, resume, next } = usePlayer();
  const router = useRouter();

  // Travelling active playback light sheen
  const travelX = useSharedValue(-100);

  useEffect(() => {
    if (!isPlaying) {
      travelX.value = -120;
      return;
    }
    travelX.value = -120;
    travelX.value = withRepeat(
      withTiming(SCREEN_WIDTH + 120, {
        duration: 4500,
        easing: Easing.inOut(Easing.cubic),
      }),
      -1,
      false
    );
  }, [isPlaying]);

  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: travelX.value }],
  }));

  if (!currentSong) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: glass.surfaceElevated,
          borderTopColor: glass.border,
        },
        Platform.OS === 'web' ? (webGlassStyle as any) : null,
      ]}
    >
      {/* Travelling active playback light sheen along the top edge */}
      {isPlaying && (
        <Animated.View
          style={[styles.travellingSheen, sheenStyle]}
          pointerEvents="none"
        >
          <Svg width={100} height={2} viewBox="0 0 100 2">
            <Defs>
              <LinearGradient id="miniPlayerSheen" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor={borderAnimationPalette.champagneGold} stopOpacity="0" />
                <Stop offset="40%" stopColor={borderAnimationPalette.warmGoldHighlight} stopOpacity="0.8" />
                <Stop offset="60%" stopColor={borderAnimationPalette.pearl} stopOpacity="1" />
                <Stop offset="100%" stopColor={borderAnimationPalette.champagneGold} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="2" fill="url(#miniPlayerSheen)" />
          </Svg>
        </Animated.View>
      )}

      {/* Progress bar — non-interactive */}
      <View style={[styles.progressTrack, { backgroundColor: colors.progressTrack }]} pointerEvents="none">
        <View
          style={[
            styles.progressFill,
            { backgroundColor: colors.progressFill, width: `${progress * 100}%` },
          ]}
        />
      </View>

      <View style={styles.content}>
        {/* Track details Pressable to open full screen player */}
        <Pressable
          style={styles.trackDetailsPressable}
          onPress={() => router.push('/player')}
          accessibilityLabel={`Open player: ${currentSong.title} by ${currentSong.artistName}`}
          accessibilityRole="button"
        >
          {/* Artwork thumbnail */}
          <View
            style={[
              styles.artwork,
              {
                backgroundColor: 'rgba(32, 22, 46, 0.85)',
                borderRadius: radius.sm,
                borderColor: 'rgba(229, 184, 66, 0.35)',
                borderWidth: 1,
                overflow: 'hidden',
              },
            ]}
          >
            {currentSong.artwork ? (
              <Image
                source={{ uri: currentSong.artwork }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <Text style={[styles.artworkText, { color: colors.accentWarm || '#FFD700' }]}>
                {getInitials(currentSong.title)}
              </Text>
            )}
          </View>

          {/* Song info */}
          <View style={styles.info}>
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
        </Pressable>

        {/* Play/Pause */}
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
          onPress={() => next()}
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
    borderTopWidth: 0.75,
    overflow: 'hidden',
    position: 'relative',
  },
  travellingSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 100,
    height: 2,
    zIndex: 10,
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
  trackDetailsPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
