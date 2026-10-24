// ─── DHUN Wordmark Component ────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import Svg, { Line } from 'react-native-svg';

interface DhunWordmarkProps {
  size?: 'small' | 'medium' | 'large';
  showTagline?: boolean;
  tagline?: string;
}

export function DhunWordmark({ 
  size = 'large', 
  showTagline = false,
  tagline = 'Your Music, Untouched.',
}: DhunWordmarkProps) {
  const { colors } = useTheme();

  const fontSize = size === 'large' ? 48 : size === 'medium' ? 32 : 22;
  const equalizerHeight = size === 'large' ? 40 : size === 'medium' ? 28 : 18;
  const equalizerWidth = size === 'large' ? 36 : size === 'medium' ? 24 : 16;

  return (
    <View style={styles.container}>
      {/* Equalizer / waveform icon */}
      <View style={[styles.equalizerContainer, { height: equalizerHeight, width: equalizerWidth }]}>
        <Svg width={equalizerWidth} height={equalizerHeight} viewBox="0 0 36 40">
          <Line x1="4" y1="12" x2="4" y2="28" stroke={colors.accent} strokeWidth="2.5" strokeLinecap="round" />
          <Line x1="11" y1="6" x2="11" y2="34" stroke={colors.accentWarm} strokeWidth="2.5" strokeLinecap="round" />
          <Line x1="18" y1="2" x2="18" y2="38" stroke={colors.accent} strokeWidth="2.5" strokeLinecap="round" />
          <Line x1="25" y1="8" x2="25" y2="32" stroke={colors.accentWarm} strokeWidth="2.5" strokeLinecap="round" />
          <Line x1="32" y1="14" x2="32" y2="26" stroke={colors.accent} strokeWidth="2.5" strokeLinecap="round" />
        </Svg>
      </View>

      {/* Wordmark */}
      <Text style={[styles.wordmark, { fontSize, color: colors.textPrimary }]}>
        dhun
      </Text>

      {/* Tagline */}
      {showTagline && (
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
          {tagline}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  equalizerContainer: {
    marginBottom: 12,
  },
  wordmark: {
    fontWeight: '300',
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '400',
    marginTop: 8,
    letterSpacing: 0.5,
    fontStyle: 'italic',
  },
});
