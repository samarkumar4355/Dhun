// ─── Now Playing Screen ─────────────────────────────────────────────

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { usePlayer } from '@/services/PlayerProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { QualityBadge } from '@/components/QualityBadge';
import { FlipLyricsCard } from '@/components/FlipLyricsCard';
import { GlassSurface } from '@/components/GlassSurface';
import { AnimatedBorder } from '@/components/AnimatedBorder';
import { formatDuration, safeBack } from '@/utils/helpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ARTWORK_SIZE = Math.min(SCREEN_WIDTH - 64, 340);

export default function PlayerScreen() {
  const { colors, glass, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    currentSong,
    isPlaying,
    progress,
    currentTime,
    shuffle,
    repeat,
    pause,
    resume,
    next,
    previous,
    seekTo,
    toggleShuffle,
    toggleRepeat,
    toggleFavorite,
  } = usePlayer();

  // ─── Lyrics flip state ──────────────────────────────────────────
  const [showLyrics, setShowLyrics] = useState(false);
  const prevSongIdRef = useRef(currentSong?.id);

  // Reset to artwork face when the track changes
  useEffect(() => {
    if (currentSong && prevSongIdRef.current !== currentSong.id) {
      prevSongIdRef.current = currentSong.id;
      setShowLyrics(false);
    }
  }, [currentSong?.id]);

  const handleFlipToggle = useCallback(() => {
    setShowLyrics(prev => !prev);
  }, []);

  if (!currentSong) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: 100 }]}>
          No song playing
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => safeBack(router, '/(tabs)/listen')} hitSlop={12} accessibilityLabel="Close player">
          <Ionicons name="chevron-down" size={28} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typography.metadata, { color: colors.textSecondary }]}>NOW PLAYING</Text>
        <Pressable
          onPress={() => {}}
          hitSlop={12}
          accessibilityLabel="Queue"
        >
          <Ionicons name="list" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>

      {/* Artwork / Lyrics Flip Card with ambient glow & travelling border */}
      <View style={styles.artworkContainer}>
        {/* Soft static ambient gold lighting behind hero artwork */}
        <View
          pointerEvents="none"
          style={[
            styles.ambientHalo,
            {
              backgroundColor: isDark
                ? 'rgba(215, 166, 90, 0.14)'
                : 'rgba(196, 145, 59, 0.10)',
            },
          ]}
        />
        <AnimatedBorder
          id="player_artwork"
          active={isPlaying}
          borderRadius={radius['2xl']}
          duration={7.5}
          strokeWidth={1.4}
        >
          <FlipLyricsCard
            size={ARTWORK_SIZE}
            title={currentSong.title}
            artistName={currentSong.artistName}
            artwork={currentSong.artwork}
            lyrics={currentSong.lyrics}
            songId={currentSong.id}
            showLyrics={showLyrics}
            onToggle={handleFlipToggle}
          />
        </AnimatedBorder>
      </View>

      {/* Song Info */}
      <View style={styles.songInfo}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.h2, { color: colors.textPrimary }]} numberOfLines={1}>
              {currentSong.title}
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
              {currentSong.artistName}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
              {currentSong.albumName}
            </Text>
          </View>
          <Pressable
            onPress={() => toggleFavorite(currentSong.id)}
            hitSlop={12}
            accessibilityLabel={currentSong.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Ionicons
              name={currentSong.isFavorite ? 'heart' : 'heart-outline'}
              size={26}
              color={currentSong.isFavorite ? colors.accent : colors.textSecondary}
            />
          </Pressable>
        </View>
      </View>

      {/* Progress */}
      <View style={styles.progressSection}>
        <View style={[styles.progressTrack, { backgroundColor: colors.progressTrack }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.progressFill, width: `${progress * 100}%` },
            ]}
          />
          <View
            style={[
              styles.progressThumb,
              {
                backgroundColor: colors.accent,
                left: `${progress * 100}%`,
              },
            ]}
          />
        </View>
        <View style={styles.timeRow}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {formatDuration(currentTime)}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {formatDuration(currentSong.duration)}
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable onPress={toggleShuffle} hitSlop={12} accessibilityLabel="Shuffle">
          <Ionicons
            name="shuffle"
            size={24}
            color={shuffle ? colors.accent : colors.textSecondary}
          />
        </Pressable>

        <Pressable onPress={previous} hitSlop={12} accessibilityLabel="Previous track">
          <Ionicons name="play-skip-back" size={32} color={colors.textPrimary} />
        </Pressable>

        <Pressable
          onPress={isPlaying ? pause : resume}
          style={[
            styles.playButton,
            { backgroundColor: colors.accent },
            isPlaying && {
              shadowColor: colors.accent,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
              elevation: 6,
            },
          ]}
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={32}
            color={colors.background}
            style={isPlaying ? {} : { marginLeft: 3 }}
          />
        </Pressable>

        <Pressable onPress={next} hitSlop={12} accessibilityLabel="Next track">
          <Ionicons name="play-skip-forward" size={32} color={colors.textPrimary} />
        </Pressable>

        <Pressable onPress={toggleRepeat} hitSlop={12} accessibilityLabel="Repeat">
          <Ionicons
            name={repeat === 'one' ? 'repeat' : 'repeat'}
            size={24}
            color={repeat !== 'off' ? colors.accent : colors.textSecondary}
          />
          {repeat === 'one' && (
            <Text style={[styles.repeatOne, { color: colors.accent }]}>1</Text>
          )}
        </Pressable>
      </View>

      {/* Audio Details Glass Card Link */}
      <GlassSurface
        variant="card"
        showTopHighlight
        onPress={() => router.push('/audio-details')}
        style={styles.audioDetailsBar}
        accessibilityLabel="Audio details"
      >
        <Ionicons name="analytics" size={18} color={colors.accent} />
        <Text style={[typography.bodySmall, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}>
          Audio Details
        </Text>
        <QualityBadge
          format={currentSong.format}
          bitDepth={currentSong.bitDepth}
          sampleRate={currentSong.sampleRate}
        />
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: spacing.sm }} />
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  artworkContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    // Height is fixed to ARTWORK_SIZE to prevent layout jumps during flip
    height: ARTWORK_SIZE + spacing.xl * 2,
    justifyContent: 'center',
    position: 'relative',
  },
  ambientHalo: {
    position: 'absolute',
    width: ARTWORK_SIZE * 0.85,
    height: ARTWORK_SIZE * 0.85,
    borderRadius: (ARTWORK_SIZE * 0.85) / 2,
    alignSelf: 'center',
    zIndex: 0,
  },
  songInfo: {
    paddingVertical: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  progressSection: {
    paddingVertical: spacing.md,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    position: 'absolute',
    top: -5,
    marginLeft: -7,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  repeatOne: {
    position: 'absolute',
    fontSize: 9,
    fontWeight: '700',
    bottom: -2,
    right: -4,
  },
  audioDetailsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    marginTop: spacing.sm,
  },
});
