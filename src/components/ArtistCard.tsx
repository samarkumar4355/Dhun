// ─── Artist Card ────────────────────────────────────────────────────

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { stringToColor, getInitials } from '@/utils/helpers';

interface ArtistCardProps {
  name: string;
  artwork: string | null;
  onPress?: () => void;
  size?: number;
}

export function ArtistCard({ name, artwork, onPress, size = 100 }: ArtistCardProps) {
  const { colors } = useTheme();

  return (
    <Pressable onPress={onPress} style={[styles.container, { width: size }]}>
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            backgroundColor: stringToColor(name),
          },
        ]}
      >
        <Text style={[styles.initials, { fontSize: size * 0.3 }]}>
          {getInitials(name)}
        </Text>
      </View>
      <Text
        style={[typography.bodySmall, { color: colors.textPrimary, marginTop: spacing.sm, textAlign: 'center' }]}
        numberOfLines={1}
      >
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginRight: 14,
  },
  avatar: {
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
});
