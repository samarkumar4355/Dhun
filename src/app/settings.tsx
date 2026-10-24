// ─── Settings Screen ────────────────────────────────────────────────

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { SettingsRow } from '@/components/SettingsRow';
import { ThemeMode } from '@/types/music';
import { stringToColor } from '@/utils/helpers';

const themeLabels: Record<ThemeMode, string> = {
  auto: 'Auto (Time)',
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

export default function SettingsScreen() {
  const { colors, themeMode, setThemeMode } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [audioQuality, setAudioQuality] = useState('Lossless / Hi-Res');

  const handleThemeChange = () => {
    const modes: ThemeMode[] = ['auto', 'system', 'light', 'dark'];
    const currentIdx = modes.indexOf(themeMode);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    setThemeMode(nextMode);
  };

  const handleAudioQuality = () => {
    const qualities = ['Standard', 'High', 'Lossless / Hi-Res'];
    const currentIdx = qualities.indexOf(audioQuality);
    setAudioQuality(qualities[(currentIdx + 1) % qualities.length]);
  };

  const showPrototypeAlert = (feature: string) => {
    Alert.alert(
      'Prototype',
      `${feature} is not yet connected. This is a frontend prototype.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={[typography.h2, { color: colors.textPrimary, marginLeft: spacing.lg }]}>Settings</Text>
        </View>

        {/* Profile */}
        <Pressable
          style={[styles.profileCard, { backgroundColor: colors.surface }]}
          onPress={() => showPrototypeAlert('Profile editing')}
        >
          <View style={[styles.profileAvatar, { backgroundColor: stringToColor('Arjun Mehta') }]}>
            <Text style={styles.profileAvatarText}>AM</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '600' }]}>
              Arjun Mehta
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              arjun@email.com
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        {/* Settings sections */}
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface }]}>
          <SettingsRow
            icon="headset"
            label="Audio Quality"
            value={audioQuality}
            onPress={handleAudioQuality}
          />
          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
          <SettingsRow
            icon="server"
            label="Storage & Cache"
            value="2.4 GB used"
            onPress={() => showPrototypeAlert('Storage management')}
          />
          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
          <SettingsRow
            icon="logo-google"
            label="Google Drive"
            value="Connected"
            onPress={() => showPrototypeAlert('Google Drive connection')}
          />
          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
          <SettingsRow
            icon="download"
            label="Downloads"
            value="342 songs"
            onPress={() => showPrototypeAlert('Download management')}
          />
          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
          <SettingsRow
            icon="color-palette"
            label="Appearance"
            value={themeLabels[themeMode]}
            onPress={handleThemeChange}
          />
        </View>

        {/* Second group */}
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface }]}>
          <SettingsRow
            icon="help-circle"
            label="Help & Support"
            onPress={() => showPrototypeAlert('Help & Support')}
          />
          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
          <SettingsRow
            icon="information-circle"
            label="About Dhun"
            onPress={() =>
              Alert.alert(
                'Dhun',
                'Version 1.0.0\n\nYour Music, Untouched.\n\nA premium music player focused on lossless audio, offline listening, and Indian emotional identity.',
                [{ text: 'OK' }]
              )
            }
          />
        </View>

        {/* Theme info */}
        <View style={styles.themeInfo}>
          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
            Theme: {themeLabels[themeMode]} · Tap "Appearance" to cycle
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsGroup: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  divider: {
    height: 0.5,
    marginLeft: spacing.lg + 24 + spacing.lg,
  },
  themeInfo: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
