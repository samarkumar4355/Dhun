// ─── Song Row ───────────────────────────────────────────────────────

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
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
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
          opacity: pressed ? 0.8 : 1,
        },
      ]}
      accessibilityLabel={`${song.title} by ${song.artistName}`}
      accessibilityRole="button"
    >
      {showArtwork && (
        <View
          style={[
            styles.artwork,
            { backgroundColor: stringToColor(song.title), borderRadius: radius.sm },
          ]}
        >
          <Text style={styles.artworkText}>{getInitials(song.title)}</Text>
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
