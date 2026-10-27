// ─── Song Row ───────────────────────────────────────────────────────

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { formatDuration, stringToColor, getInitials } from '@/utils/helpers';
import { Song } from '@/types/music';

interface SongRowProps {
  song: Song;
  onPress?: () => void;
  showArtwork?: boolean;
  isActive?: boolean;
}

export function SongRow({ song, onPress, showArtwork = true, isActive = false }: SongRowProps) {
  const { colors, glass } = useTheme();
  const [imgError, setImgError] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        isActive
          ? {
              backgroundColor: glass.surfaceSubtle,
              borderColor: glass.borderAccent,
              borderWidth: 1,
              borderRadius: radius.md,
              marginHorizontal: spacing.sm,
            }
          : {
              backgroundColor: pressed ? glass.surfaceSubtle : 'transparent',
              borderColor: 'transparent',
              borderWidth: 1,
            },
        {
          opacity: pressed ? 0.88 : 1,
          transform: pressed ? [{ scale: 0.995 }] : [{ scale: 1 }],
        },
      ]}
      accessibilityLabel={`${song.title} by ${song.artistName}`}
      accessibilityRole="button"
    >
      {showArtwork && (
        <View
          style={[
            styles.artwork,
            {
              backgroundColor: 'rgba(34, 24, 48, 0.85)',
              borderRadius: radius.sm,
              borderColor: isActive ? colors.accent : glass.border,
              borderWidth: isActive ? 1.5 : 0.8,
              overflow: 'hidden',
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
            <Text style={[styles.artworkText, { color: colors.accentWarm || '#FFD700' }]}>
              {getInitials(song.title)}
            </Text>
          )}
        </View>
      )}

      <View style={styles.info}>
        <Text
          style={[
            typography.body,
            { color: isActive ? colors.accent : colors.textPrimary, fontWeight: isActive ? '600' : '400' },
          ]}
          numberOfLines={1}
        >
          {song.title}
        </Text>
        <Text
          style={[typography.caption, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {song.artistName} · {song.albumName}
        </Text>
      </View>

      <View style={styles.meta}>
        {song.isFavorite && (
          <Ionicons name="heart" size={14} color={colors.accent} style={{ marginRight: 8 }} />
        )}
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {formatDuration(song.duration)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 60,
  },
  artwork: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  artworkText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    fontWeight: '600',
  },
  info: {
    flex: 1,
    marginRight: spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
