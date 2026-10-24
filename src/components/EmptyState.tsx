// ─── Empty State ────────────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={colors.textMuted} style={{ marginBottom: spacing.lg }} />
      <Text style={[typography.h3, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
        {title}
      </Text>
      {subtitle && (
        <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', maxWidth: 260 }]}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing['2xl'],
  },
});
