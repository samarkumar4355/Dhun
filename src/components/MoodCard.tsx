// ─── Mood Card ──────────────────────────────────────────────────────

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { MoodSession, MoodType } from '@/types/music';

const moodGradients: Record<MoodType, [string, string]> = {
  'rainy-evening': ['#2C3E50', '#4A6741'],
  'slow-morning': ['#E8D5B7', '#C4913B'],
  'midnight-drive': ['#1A1A2E', '#16213E'],
  'deep-focus': ['#2D3436', '#636E72'],
  'romance': ['#6B2737', '#C0392B'],
  'travel': ['#2C3E50', '#27AE60'],
  'workout': ['#E74C3C', '#C0392B'],
  'chill': ['#2980B9', '#6C5CE7'],
};

const moodIcons: Record<MoodType, keyof typeof Ionicons.glyphMap> = {
  'rainy-evening': 'rainy',
  'slow-morning': 'sunny',
  'midnight-drive': 'car',
  'deep-focus': 'headset',
  'romance': 'heart',
  'travel': 'airplane',
  'workout': 'fitness',
  'chill': 'leaf',
};

interface MoodCardProps {
  mood: MoodSession;
  onPress?: () => void;
  large?: boolean;
}

export function MoodCard({ mood, onPress, large = false }: MoodCardProps) {
  const { colors, glass } = useTheme();
  const gradient = moodGradients[mood.moodType];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        large ? styles.largCard : styles.card,
        {
          backgroundColor: gradient[0],
          borderColor: glass.border,
          borderWidth: 1,
          opacity: pressed ? 0.88 : 1,
          transform: pressed ? [{ scale: 0.98 }] : [{ scale: 1 }],
        },
      ]}
      accessibilityLabel={`${mood.title} mood session`}
      accessibilityRole="button"
    >
      {/* Top highlight sheen line */}
      <View
        pointerEvents="none"
        style={[
          styles.sheenLine,
          { backgroundColor: glass.borderHighlight },
        ]}
      />
      <View style={styles.cardContent}>
        <Ionicons
          name={moodIcons[mood.moodType]}
          size={large ? 28 : 22}
          color="rgba(255,255,255,0.85)"
          style={{ marginBottom: spacing.sm }}
        />
        <Text
          style={[
            large ? typography.h3 : typography.label,
            { color: '#FFFFFF' },
          ]}
          numberOfLines={1}
        >
          {mood.title}
        </Text>
        {large && (
          <Text
            style={[typography.caption, { color: 'rgba(255,255,255,0.7)', marginTop: 4 }]}
            numberOfLines={1}
          >
            {mood.subtitle}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 100,
    height: 100,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginRight: spacing.md,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
  },
  largCard: {
    flex: 1,
    height: 160,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginRight: spacing.md,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    minWidth: 150,
    position: 'relative',
  },
  sheenLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 0.75,
  },
  cardContent: {
    justifyContent: 'flex-end',
  },
});
