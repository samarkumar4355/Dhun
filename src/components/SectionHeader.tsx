// ─── Section Header ─────────────────────────────────────────────────

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

interface SectionHeaderProps {
  title: string;
  onSeeAll?: () => void;
  showSeeAll?: boolean;
}

export function SectionHeader({ title, onSeeAll, showSeeAll = true }: SectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[typography.h3, { color: colors.textPrimary }]}>{title}</Text>
      {showSeeAll && onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={[typography.label, { color: colors.accent }]}>See all</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.md,
  },
});
