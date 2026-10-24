// ─── Album Card ─────────────────────────────────────────────────────

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { stringToColor, getInitials } from '@/utils/helpers';

interface AlbumCardProps {
  title: string;
  artistName: string;
  artwork: string | null;
  onPress?: () => void;
  size?: number;
}

export function AlbumCard({ title, artistName, artwork, onPress, size = 140 }: AlbumCardProps) {
  const { colors, glass } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          width: size,
          opacity: pressed ? 0.88 : 1,
          transform: pressed ? [{ scale: 0.98 }] : [{ scale: 1 }],
        },
      ]}
    >
      <View
        style={[
          styles.artwork,
          {
            width: size,
            height: size,
            backgroundColor: stringToColor(title),
            borderRadius: radius.lg,
            borderColor: glass.borderHighlight,
            borderWidth: 1,
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.sheenLine,
            { backgroundColor: glass.borderHighlight },
          ]}
        />
        <Text style={styles.artworkText}>{getInitials(title)}</Text>
      </View>
      <Text
        style={[typography.label, { color: colors.textPrimary, marginTop: spacing.sm }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Text
        style={[typography.caption, { color: colors.textSecondary }]}
        numberOfLines={1}
      >
        {artistName}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: 14,
  },
  artwork: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  sheenLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 0.75,
    zIndex: 2,
  },
  artworkText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 28,
    fontWeight: '600',
  },
});
