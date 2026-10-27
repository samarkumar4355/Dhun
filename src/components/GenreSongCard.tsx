// ─── Luxury Genre Song Sliding Card ─────────────────────────────────

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { GlassSurface } from '@/components/GlassSurface';
import { Song } from '@/types/music';
import { getInitials } from '@/utils/helpers';

interface GenreSongCardProps {
  song: Song;
  onPress: () => void;
  isPlaying?: boolean;
  isActive?: boolean;
  cardWidth?: number;
}

export function GenreSongCard({
  song,
  onPress,
  isPlaying = false,
  isActive = false,
  cardWidth = 158,
}: GenreSongCardProps) {
  const { colors, glass, isDark } = useTheme();
  const [imgError, setImgError] = useState(false);

  const artworkSize = cardWidth - 20;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrapper,
        {
          width: cardWidth,
          opacity: pressed ? 0.90 : 1,
          transform: pressed ? [{ scale: 0.97 }] : [{ scale: 1 }],
        },
      ]}
    >
      <GlassSurface
        variant="card"
        borderRadius={radius.xl}
        showTopHighlight
        showAmbientGlow={isActive}
        style={[
          styles.card,
          isActive && {
            borderColor: colors.accentWarm || '#FFD700',
            borderWidth: 1.5,
          },
        ]}
      >
        {/* Artwork Container */}
        <View
          style={[
            styles.artworkBox,
            {
              width: artworkSize,
              height: artworkSize,
              borderRadius: radius.lg,
              backgroundColor: 'rgba(35, 24, 48, 0.90)',
              borderColor: isActive ? '#FFD700' : 'rgba(229, 184, 66, 0.25)',
              borderWidth: 1,
            },
          ]}
        >
          {song.artwork && !imgError ? (
            <Image
              source={{ uri: song.artwork }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={styles.fallbackBox}>
              <Ionicons name="musical-notes" size={32} color={colors.accentWarm || '#FFD700'} />
              <Text style={[styles.initialsText, { color: colors.textSecondary }]}>
                {getInitials(song.title)}
              </Text>
            </View>
          )}

          {/* Quality badge (Lossless FLAC / MP3) */}
          <View
            style={[
              styles.qualityBadge,
              {
                backgroundColor: 'rgba(12, 9, 18, 0.78)',
                borderColor: 'rgba(229, 184, 66, 0.35)',
              },
            ]}
          >
            <Text style={[styles.qualityText, { color: colors.accentWarm || '#FFD700' }]}>
              {song.format === 'FLAC' ? 'FLAC 24b' : 'Hi-Res'}
            </Text>
          </View>

          {/* Play status overlay */}
          <View
            style={[
              styles.playOverlay,
              {
                backgroundColor: isActive
                  ? colors.accentWarm || '#FFD700'
                  : 'rgba(16, 12, 22, 0.75)',
                borderColor: 'rgba(229, 184, 66, 0.40)',
              },
            ]}
          >
            <Ionicons
              name={isActive && isPlaying ? 'pause' : 'play'}
              size={14}
              color={isActive ? '#09080E' : '#FFF8E7'}
              style={isActive && isPlaying ? {} : { marginLeft: 1.5 }}
            />
          </View>
        </View>

        {/* Song Info */}
        <View style={styles.infoContainer}>
          <Text
            style={[
              typography.label,
              {
                color: isActive ? colors.accentWarm || '#FFD700' : colors.textPrimary,
                fontWeight: '600',
              },
            ]}
            numberOfLines={1}
          >
            {song.title}
          </Text>
          <Text
            style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}
            numberOfLines={1}
          >
            {song.artistName}
          </Text>
        </View>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginRight: 14,
  },
  card: {
    padding: 10,
    alignItems: 'center',
  },
  artworkBox: {
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  qualityBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.8,
  },
  qualityText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  playOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContainer: {
    width: '100%',
    marginTop: 8,
    paddingHorizontal: 2,
  },
});
