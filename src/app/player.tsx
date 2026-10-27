import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, PanResponder, Modal, FlatList } from 'react-native';
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
import { api } from '@/services/api/apiClient';

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
    queue,
    play,
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
    downloadSong,
    deleteDownload,
  } = usePlayer();

  const [trackWidth, setTrackWidth] = useState(SCREEN_WIDTH - 48);
  const trackWidthRef = useRef(SCREEN_WIDTH - 48);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekProgress, setSeekProgress] = useState(0);
  const [showQueueModal, setShowQueueModal] = useState(false);

  useEffect(() => {
    trackWidthRef.current = trackWidth;
  }, [trackWidth]);

  // Gesture-driven pan responder for scrubbing audio duration
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setIsSeeking(true);
        if (trackWidthRef.current > 0) {
          const x = evt.nativeEvent.locationX;
          const fraction = Math.max(0, Math.min(1, x / trackWidthRef.current));
          setSeekProgress(fraction);
        }
      },
      onPanResponderMove: (evt) => {
        if (trackWidthRef.current > 0) {
          const x = evt.nativeEvent.locationX;
          const fraction = Math.max(0, Math.min(1, x / trackWidthRef.current));
          setSeekProgress(fraction);
        }
      },
      onPanResponderRelease: (evt) => {
        if (trackWidthRef.current > 0) {
          const x = evt.nativeEvent.locationX;
          const fraction = Math.max(0, Math.min(1, x / trackWidthRef.current));
          seekTo(fraction);
        }
        setIsSeeking(false);
      },
      onPanResponderTerminate: () => {
        setIsSeeking(false);
      },
    })
  ).current;

  // ─── Lyrics flip state ──────────────────────────────────────────
  const [showLyrics, setShowLyrics] = useState(false);
  const [activeLyrics, setActiveLyrics] = useState<string | null>(currentSong?.lyrics ?? null);
  const prevSongIdRef = useRef(currentSong?.id);

  // Sync / fetch lyrics when song changes
  useEffect(() => {
    setActiveLyrics(currentSong?.lyrics ?? null);
    if (currentSong?.id && !currentSong.lyrics) {
      api.getTrackLyrics(currentSong.id)
        .then(res => {
          if (res?.data?.lyrics) {
            setActiveLyrics(res.data.lyrics);
          }
        })
        .catch(() => {});
    }
  }, [currentSong?.id, currentSong?.lyrics]);

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
          onPress={() => setShowQueueModal(true)}
          hitSlop={12}
          accessibilityLabel="Queue"
        >
          <Ionicons name="list" size={24} color={colors.accentWarm || colors.textPrimary} />
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
            lyrics={activeLyrics || currentSong.lyrics}
            hasLyrics={Boolean((activeLyrics || currentSong.lyrics)?.trim()?.length)}
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable
              onPress={() => {
                if (currentSong.isOffline) {
                  deleteDownload(currentSong.id);
                } else {
                  downloadSong(currentSong);
                }
              }}
              hitSlop={12}
              accessibilityLabel={currentSong.isOffline ? 'Remove download' : 'Download for offline playback'}
              style={{ marginRight: spacing.lg }}
            >
              <Ionicons
                name={currentSong.isOffline ? 'checkmark-circle' : 'cloud-download-outline'}
                size={24}
                color={currentSong.isOffline ? colors.accent : colors.textSecondary}
              />
            </Pressable>
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
      </View>

      {/* Progress / Interactive Duration Slider */}
      {(() => {
        const activeProgress = isSeeking ? seekProgress : progress;
        const activeCurrentTime = isSeeking
          ? Math.floor(seekProgress * (currentSong.duration || 1))
          : currentTime;

        return (
          <View style={styles.progressSection}>
            <View
              {...panResponder.panHandlers}
              onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
              style={styles.scrubberTouchable}
            >
              <View style={[styles.progressTrack, { backgroundColor: colors.progressTrack }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: colors.accentWarm || colors.progressFill,
                      width: `${Math.min(100, Math.max(0, activeProgress * 100))}%`,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.progressThumb,
                    {
                      backgroundColor: colors.accentWarm || '#FFD700',
                      left: `${Math.min(100, Math.max(0, activeProgress * 100))}%`,
                      transform: [{ scale: isSeeking ? 1.4 : 1 }],
                      borderColor: '#09080E',
                      borderWidth: 2,
                    },
                  ]}
                />
              </View>
            </View>
            <View style={styles.timeRow}>
              <Text
                style={[
                  typography.caption,
                  { color: isSeeking ? colors.accentWarm || '#FFD700' : colors.textMuted },
                ]}
              >
                {formatDuration(activeCurrentTime)}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {formatDuration(currentSong.duration)}
              </Text>
            </View>
          </View>
        );
      })()}

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

      {/* Up Next / Queue Modal Sheet */}
      <Modal
        visible={showQueueModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowQueueModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowQueueModal(false)}
          />
          <GlassSurface
            variant="elevated"
            borderRadius={radius['2xl']}
            showTopHighlight
            style={[styles.queueSheet, { backgroundColor: 'rgba(18, 13, 24, 0.96)' }]}
          >
            {/* Queue Header */}
            <View style={styles.queueHeader}>
              <View>
                <Text style={[typography.h3, { color: colors.accentWarm || '#FFD700' }]}>
                  Up Next / Queue
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  {queue.length} songs in queue
                </Text>
              </View>
              <Pressable
                onPress={() => setShowQueueModal(false)}
                hitSlop={12}
                style={[styles.queueCloseBtn, { backgroundColor: 'rgba(229, 184, 66, 0.15)' }]}
              >
                <Ionicons name="close" size={20} color={colors.accentWarm || '#FFD700'} />
              </Pressable>
            </View>

            {/* Queue List */}
            <FlatList
              data={queue}
              keyExtractor={(item) => `queue-${item.id}`}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: spacing['2xl'] }}
              renderItem={({ item, index }) => {
                const isItemPlaying = currentSong.id === item.id;
                return (
                  <Pressable
                    onPress={() => {
                      play(item, queue);
                      setShowQueueModal(false);
                    }}
                    style={[
                      styles.queueItem,
                      isItemPlaying && {
                        backgroundColor: 'rgba(229, 184, 66, 0.14)',
                        borderColor: 'rgba(229, 184, 66, 0.40)',
                        borderWidth: 1,
                        borderRadius: radius.md,
                      },
                    ]}
                  >
                    <View style={styles.queueIndexBox}>
                      {isItemPlaying ? (
                        <Ionicons name="volume-high" size={16} color={colors.accentWarm || '#FFD700'} />
                      ) : (
                        <Text style={[typography.caption, { color: colors.textMuted }]}>
                          {index + 1}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          typography.label,
                          { color: isItemPlaying ? colors.accentWarm || '#FFD700' : colors.textPrimary },
                        ]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.artistName}
                      </Text>
                    </View>
                    <Text style={[typography.caption, { color: colors.textMuted, marginLeft: spacing.sm }]}>
                      {formatDuration(item.duration)}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </GlassSurface>
        </View>
      </Modal>
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
  scrubberTouchable: {
    paddingVertical: 12,
    justifyContent: 'center',
  },
  progressTrack: {
    height: 5,
    borderRadius: 2.5,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  progressThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    position: 'absolute',
    top: -5.5,
    marginLeft: -8,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 4, 8, 0.70)',
    justifyContent: 'flex-end',
  },
  queueSheet: {
    maxHeight: '75%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(229, 184, 66, 0.35)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229, 184, 66, 0.15)',
    marginBottom: spacing.md,
  },
  queueCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  queueIndexBox: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
});
