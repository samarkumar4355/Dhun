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
  const { colors } = useTheme();

  return (
    <Pressable onPress={onPress} style={[styles.container, { width: size }]}>
      <View
        style={[
          styles.artwork,
          {
            width: size,
            height: size,
            backgroundColor: stringToColor(title),
            borderRadius: radius.lg,
          },
        ]}
      >
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
  },
  artworkText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 28,
    fontWeight: '600',
  },
});
