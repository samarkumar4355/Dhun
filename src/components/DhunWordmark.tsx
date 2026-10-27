// ─── DHUN 3D Metallic Gold Wordmark / Logo Component ───────────────────

import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

const GOLD_LOGO = require('../../assets/images/dhun-gold-logo.jpg');

interface DhunWordmarkProps {
  size?: 'small' | 'medium' | 'large';
  showTagline?: boolean;
  tagline?: string;
}

export function DhunWordmark({
  size = 'large',
  showTagline = false,
  tagline = 'Pure Sound. Offline.',
}: DhunWordmarkProps) {
  const { colors, isDark } = useTheme();

  const logoDimension = size === 'large' ? 240 : size === 'medium' ? 160 : 64;
  const borderRadius = size === 'large' ? 28 : size === 'medium' ? 20 : 12;

  return (
    <View style={styles.container}>
      {/* Ambient gold glow behind the 3D logo */}
      <View
        pointerEvents="none"
        style={[
          styles.glowHalo,
          {
            width: logoDimension + 30,
            height: logoDimension + 30,
            borderRadius: (logoDimension + 30) / 2,
            backgroundColor: isDark
              ? 'rgba(255, 215, 0, 0.18)'
              : 'rgba(229, 184, 66, 0.14)',
          },
        ]}
      />

      {/* 3D Metallic Gold Dhun Logo */}
      <View
        style={[
          styles.imageWrapper,
          {
            width: logoDimension,
            height: logoDimension,
            borderRadius,
            borderColor: 'rgba(229, 184, 66, 0.35)',
            borderWidth: size === 'small' ? 1 : 1.5,
          },
        ]}
      >
        <Image
          source={GOLD_LOGO}
          style={{ width: logoDimension, height: logoDimension, borderRadius }}
          resizeMode="cover"
        />
      </View>

      {/* Optional custom Tagline */}
      {showTagline && (
        <Text style={[styles.tagline, { color: colors.accentWarm || '#FFD700' }]}>
          {tagline}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glowHalo: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 0,
  },
  imageWrapper: {
    overflow: 'hidden',
    backgroundColor: '#000000',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
    zIndex: 1,
  },
  tagline: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
