// ─── Artist Card ────────────────────────────────────────────────────

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { stringToColor, getInitials } from '@/utils/helpers';
import { CometOrbit } from '@/components/CometOrbit';

interface ArtistCardProps {
  name: string;
  artwork: string | null;
  onPress?: () => void;
  size?: number;
  /** Show comet orbit animation (default: true for sizes >= 80) */
  showComet?: boolean;
}

export function ArtistCard({ name, artwork, onPress, size = 100, showComet }: ArtistCardProps) {
  const { colors } = useTheme();

  // Only show comet on larger icons to avoid visual clutter
  const shouldShowComet = showComet ?? size >= 80;

  const avatarContent = (
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
  );

  return (
    <Pressable onPress={onPress} style={[styles.container, { width: shouldShowComet ? size + 18 : size }]}>
      {shouldShowComet ? (
        <CometOrbit iconSize={size} gap={4} duration={5.5} cometLength={0.14}>
          {avatarContent}
        </CometOrbit>
      ) : (
        avatarContent
      )}
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

