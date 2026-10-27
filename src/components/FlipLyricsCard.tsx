// ─── Flip Lyrics Card ───────────────────────────────────────────────
// A premium 3D-flipping card that reveals lyrics on the back face.
// Uses React Native Reanimated for UI-thread driven Y-axis rotation.

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, AccessibilityInfo, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { stringToColor, getInitials } from '@/utils/helpers';
import type { DhunColors } from '@/theme/colors';

// ─── Types ──────────────────────────────────────────────────────────

interface FlipLyricsCardProps {
  /** Card width and height (square) */
  size: number;
  /** Song title — used for artwork placeholder and lyrics header */
  title: string;
  /** Artist name — shown in lyrics header */
  artistName: string;
  /** Artwork URI — null falls back to initials placeholder */
  artwork: string | null;
  /** Whether track has lyrics */
  hasLyrics?: boolean;
  /** Lyrics text — undefined/null/empty shows unavailable state */
  lyrics?: string | null;
  /** Unique song id — used to detect track changes */
  songId: string;
  /** Whether the card is currently showing lyrics */
  showLyrics: boolean;
  /** Called when the user taps See Lyrics / Hide Lyrics */
  onToggle: () => void;
}

// ─── Animation Config ───────────────────────────────────────────────

const FLIP_DURATION = 550;
const FLIP_EASING = Easing.bezier(0.4, 0.0, 0.2, 1);

// ─── Component ──────────────────────────────────────────────────────

export function FlipLyricsCard({
  size,
  title,
  artistName,
  artwork,
  lyrics,
  hasLyrics,
  songId,
  showLyrics,
  onToggle,
}: FlipLyricsCardProps) {
  const { colors } = useTheme();
  const rotation = useSharedValue(0);
  const prevSongId = useRef(songId);
  const isLyricsAvailable = Boolean(hasLyrics || (lyrics && lyrics.trim().length > 0));

  // ─── Drive flip animation from showLyrics prop ────────────────────
  useEffect(() => {
    const target = showLyrics ? 180 : 0;
    if (rotation.value === target) return;

    rotation.value = withTiming(target, {
      duration: FLIP_DURATION,
      easing: FLIP_EASING,
    });
  }, [showLyrics]);

  // ─── Reset to artwork face instantly on track change ──────────────
  useEffect(() => {
    if (prevSongId.current !== songId) {
      prevSongId.current = songId;
      rotation.value = 0;
    }
  }, [songId]);

  // ─── Front face animated style (artwork) ──────────────────────────
  const frontStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(rotation.value, [0, 180], [0, 180]);
    const opacity = interpolate(rotation.value, [0, 85, 95, 180], [1, 1, 0, 0]);
    return {
      transform: [
        { perspective: 1200 },
        { rotateY: `${rotateY}deg` },
      ],
      opacity,
      zIndex: rotation.value >= 90 ? 1 : 2,
    };
  });

  // ─── Back face animated style (lyrics) ────────────────────────────
  const backStyle = useAnimatedStyle(() => {
    // Start at 180 and rotate to 0 so text is not mirrored
    const rotateY = interpolate(rotation.value, [0, 180], [180, 0]);
    const opacity = interpolate(rotation.value, [0, 85, 95, 180], [0, 0, 1, 1]);
    return {
      transform: [
        { perspective: 1200 },
        { rotateY: `${rotateY}deg` },
      ],
      opacity,
      zIndex: rotation.value >= 90 ? 2 : 1,
    };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* ─── Front Face: Artwork ──────────────────────────────────── */}
      <Animated.View
        pointerEvents={showLyrics ? 'none' : 'auto'}
        style={[styles.face, { width: size, height: size }, frontStyle]}
      >
        <Pressable
          onPress={onToggle}
          style={[
            styles.artworkCard,
            {
              width: size,
              height: size,
              backgroundColor: 'rgba(32, 22, 46, 0.95)',
              borderRadius: radius['2xl'],
              overflow: 'hidden',
              borderColor: 'rgba(229, 184, 66, 0.35)',
              borderWidth: 1.5,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="See lyrics"
        >
          {artwork ? (
            <Image
              source={{ uri: artwork }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <Text style={[styles.artworkInitials, { fontSize: size * 0.2, color: colors.accentWarm || '#FFD700' }]}>
              {getInitials(title)}
            </Text>
          )}

          {/* See Lyrics overlay button */}
          <Pressable
            onPress={onToggle}
            style={[
              styles.lyricsToggle,
              {
                backgroundColor: 'rgba(12, 9, 17, 0.75)',
                borderColor: 'rgba(229, 184, 66, 0.35)',
                borderWidth: 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="See lyrics"
            accessibilityState={{ expanded: false }}
            hitSlop={8}
          >
            <Ionicons name="document-text-outline" size={14} color="#FFD700" />
            <Text style={[styles.lyricsToggleText, { color: '#FFF8E7' }]}>Lyrics</Text>
          </Pressable>
        </Pressable>
      </Animated.View>

      {/* ─── Back Face: Lyrics ────────────────────────────────────── */}
      <Animated.View
        pointerEvents={showLyrics ? 'auto' : 'none'}
        style={[styles.face, styles.backFace, { width: size, height: size }, backStyle]}
      >
        <LyricsBackFace
          size={size}
          title={title}
          artistName={artistName}
          lyrics={lyrics}
          hasLyrics={isLyricsAvailable}
          colors={colors}
          onHide={onToggle}
        />
      </Animated.View>
    </View>
  );
}

// ─── Lyrics Back Face (extracted for clarity) ───────────────────────

function LyricsBackFace({
  size,
  title,
  artistName,
  lyrics,
  hasLyrics,
  colors,
  onHide,
}: {
  size: number;
  title: string;
  artistName: string;
  lyrics?: string | null;
  hasLyrics: boolean;
  colors: DhunColors;
  onHide: () => void;
}) {
  const showContent = Boolean(hasLyrics || (lyrics && lyrics.trim().length > 0));

  return (
    <View
      style={[
        styles.lyricsCard,
        {
          width: size,
          height: size,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius['2xl'],
        },
      ]}
    >
      {/* Header */}
      <View style={[styles.lyricsHeader, { borderBottomColor: colors.borderSubtle }]}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.label, { color: colors.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
            {artistName}
          </Text>
        </View>
        <Pressable
          onPress={onHide}
          style={[styles.hideButton, { backgroundColor: colors.accentSubtle }]}
          accessibilityRole="button"
          accessibilityLabel="Hide lyrics"
          accessibilityState={{ expanded: true }}
          hitSlop={4}
        >
          <Ionicons name="image-outline" size={14} color={colors.accent} />
          <Text style={[styles.hideButtonText, { color: colors.accent }]}>Artwork</Text>
        </Pressable>
      </View>

      {/* Lyrics body */}
      {showContent ? (
        <ScrollView
          style={styles.lyricsScroll}
          contentContainerStyle={styles.lyricsScrollContent}
          showsVerticalScrollIndicator={true}
          indicatorStyle="white"
          bounces={true}
        >
          <Text
            style={[
              styles.lyricsText,
              { color: colors.textPrimary },
            ]}
            selectable
          >
            {lyrics}
          </Text>
        </ScrollView>
      ) : (
        <View style={styles.noLyrics}>
          <Ionicons name="musical-notes-outline" size={36} color={colors.textMuted} />
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' }]}>
            Lyrics unavailable
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' }]}>
            They'll appear here when added.
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    // Both faces are absolutely positioned within
  },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  backFace: {
    // Positioned identically to front; animation handles visibility
  },
  artworkCard: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  artworkInitials: {
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '600',
  },
  lyricsToggle: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: 5,
  },
  lyricsToggleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  lyricsCard: {
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  lyricsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 0.5,
  },
  hideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: 4,
    marginLeft: spacing.sm,
  },
  hideButtonText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  lyricsScroll: {
    flex: 1,
  },
  lyricsScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing['2xl'],
  },
  lyricsText: {
    fontSize: 15,
    lineHeight: 26,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  noLyrics: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['2xl'],
  },
});
