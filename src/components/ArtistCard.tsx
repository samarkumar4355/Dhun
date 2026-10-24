// ─── Artist Card ────────────────────────────────────────────────────

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { stringToColor, getInitials } from '@/utils/helpers';
import { ArtistBorderRing } from '@/components/ArtistBorderRing';

interface ArtistCardProps {
  name: string;
  artwork: string | null;
  onPress?: () => void;
  size?: number;
  /** Show revolving border ring animation (default: true for sizes >= 80) */
  showBorderRing?: boolean;
  /** Legacy alias for backward compatibility */
  showComet?: boolean;
}

export function ArtistCard({
  name,
  artwork,
  onPress,
  size = 100,
  showBorderRing,
  showComet,
}: ArtistCardProps) {
  const { colors, glass } = useTheme();

  // Show revolving animated border ring on artist icons
  const shouldShowRing = showBorderRing ?? showComet ?? size >= 80;

  const avatarContent = (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          backgroundColor: stringToColor(name),
          borderColor: glass.borderHighlight,
          borderWidth: 1,
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.3 }]}>
        {getInitials(name)}
      </Text>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          width: shouldShowRing ? size + 16 : size,
          opacity: pressed ? 0.88 : 1,
          transform: pressed ? [{ scale: 0.98 }] : [{ scale: 1 }],
        },
      ]}
    >
      {shouldShowRing ? (
        <ArtistBorderRing
          id={name.toLowerCase().replace(/[^a-z0-9]/g, '_')}
          iconSize={size}
          gap={3.5}
          duration={5.5}
          strokeWidth={2}
        >
          {avatarContent}
        </ArtistBorderRing>
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

