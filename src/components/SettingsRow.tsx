// ─── Settings Row ───────────────────────────────────────────────────

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
}

export function SettingsRow({
  icon,
  label,
  value,
  onPress,
  showChevron = true,
}: SettingsRowProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
        },
      ]}
      accessibilityLabel={`${label}${value ? `: ${value}` : ''}`}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={20} color={colors.accent} style={styles.icon} />
      <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>
        {label}
      </Text>
      {value ? (
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginRight: spacing.sm }]}>
          {value}
        </Text>
      ) : null}
      {showChevron && (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    minHeight: 52,
  },
  icon: {
    marginRight: spacing.lg,
    width: 24,
    textAlign: 'center',
  },
});
