// ─── Quality Badge ──────────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

interface QualityBadgeProps {
  format: string;
  bitDepth?: number;
  sampleRate?: number;
}

export function QualityBadge({ format, bitDepth, sampleRate }: QualityBadgeProps) {
  const { colors } = useTheme();
  const isLossless = ['FLAC', 'ALAC', 'WAV', 'AIFF'].includes(format);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: isLossless ? colors.accentSubtle : colors.surfaceSecondary,
          borderColor: isLossless ? colors.accent : colors.border,
        },
      ]}
    >
      <Text
        style={[
          typography.metadata,
          { color: isLossless ? colors.accent : colors.textSecondary },
        ]}
      >
        {format}
        {bitDepth && sampleRate
          ? ` · ${bitDepth}-bit / ${(sampleRate / 1000).toFixed(sampleRate % 1000 === 0 ? 0 : 1)} kHz`
          : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});
