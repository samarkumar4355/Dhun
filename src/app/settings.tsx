// ─── Settings Screen ────────────────────────────────────────────────

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { SettingsRow } from '@/components/SettingsRow';
import { GlassSurface } from '@/components/GlassSurface';
import { ThemeMode } from '@/types/music';
import { stringToColor, getInitials, safeBack } from '@/utils/helpers';
import { useAuth } from '@/services/AuthProvider';
import { getApiBaseUrl } from '@/services/api/apiClient';

const themeLabels: Record<ThemeMode, string> = {
  auto: 'Auto (Time)',
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

export default function SettingsScreen() {
  const { colors, themeMode, setThemeMode } = useTheme();
  const { user, isAuthenticated, logout, getGeneratedPassword } = useAuth();
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

  const handleShowPassword = () => {
    if (!user) return;
    const pwd = getGeneratedPassword(user.email);
    if (pwd) {
      Alert.alert(
        'Generated Password',
        `Your password for ${user.email} is:\n\n${pwd}\n\nUse this to log in on other devices.`,
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert('Notice', 'No generated password found for this account.');
    }
  };

  const handleAuthAction = async () => {
    if (isAuthenticated) {
      if (Platform.OS === 'web') {
        await logout();
        router.replace('/login');
      } else {
        Alert.alert('Log Out', 'Are you sure you want to log out of Dhun?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Log Out',
            style: 'destructive',
            onPress: async () => {
              await logout();
              router.replace('/login');
            },
          },
        ]);
      }
    } else {
      router.push('/login');
    }
  };

  const showProfileDetails = () => {
    if (!user) return;
    Alert.alert(
      'Listener Profile',
      `Display Name: ${user.name}\nEmail: ${user.email}\nAccount ID: ${user.id}\nProvider: ${user.provider || 'email'}`,
      [{ text: 'Close' }]
    );
  };

  const handleConfigureServer = () => {
    const currentUrl = getApiBaseUrl();
    Alert.alert(
      'Dhun Backend Connection',
      `Current Server: ${currentUrl}\n\n• For physical phone testing, ensure the phone is connected to the same Wi-Fi network as your development Mac.\n• If your Mac's IP changes, update EXPO_PUBLIC_API_URL or restart Expo.`,
      [{ text: 'Understood' }]
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
          <Pressable onPress={() => safeBack(router, '/(tabs)/listen')} hitSlop={12} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={[typography.h2, { color: colors.textPrimary, marginLeft: spacing.lg }]}>Settings</Text>
        </View>

        {/* Profile Card */}
        <GlassSurface
          variant="card"
          borderRadius={radius.lg}
          showTopHighlight
          style={styles.profileCard}
          onPress={() => {
            if (!isAuthenticated) router.push('/login');
            else showProfileDetails();
          }}
        >
          <View
            style={[
              styles.profileAvatar,
              { backgroundColor: stringToColor(user?.name || 'Dhun Guest') },
            ]}
          >
            <Text style={styles.profileAvatarText}>
              {user?.name ? getInitials(user.name) : 'DG'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '600' }]}>
              {user?.name || 'Guest Listener'}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              {user?.email || 'Tap to sign in or create an account'}
            </Text>
            {user?.provider ? (
              <Text style={[typography.caption, { color: colors.accent, marginTop: 2, fontSize: 10 }]}>
                {user.provider === 'google' ? 'Connected via Google' : 'Email Account'}
              </Text>
            ) : null}
          </View>
          <Ionicons
            name={isAuthenticated ? 'chevron-forward' : 'log-in-outline'}
            size={18}
            color={colors.textMuted}
          />
        </GlassSurface>

        {/* Account Group */}
        <GlassSurface
          variant="card"
          borderRadius={radius.lg}
          showTopHighlight
          style={styles.settingsGroup}
        >
          {user?.provider === 'email' ? (
            <>
              <SettingsRow
                icon="key-outline"
                label="View Generated Password"
                value="Reveal"
                onPress={handleShowPassword}
              />
              <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
            </>
          ) : null}

          <SettingsRow
            icon={isAuthenticated ? 'log-out-outline' : 'log-in-outline'}
            label={isAuthenticated ? 'Log Out' : 'Sign In / Sign Up'}
            value={isAuthenticated ? 'Active' : ''}
            onPress={handleAuthAction}
          />
        </GlassSurface>

        {/* Settings sections */}
        <GlassSurface
          variant="card"
          borderRadius={radius.lg}
          showTopHighlight
          style={styles.settingsGroup}
        >
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
            value="Offline Storage"
            onPress={() => router.push({ pathname: '/(tabs)/library' })}
          />
          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
          <SettingsRow
            icon="download"
            label="Downloaded Songs"
            value="View Offline"
            onPress={() => router.push({ pathname: '/(tabs)/library' })}
          />
          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
          <SettingsRow
            icon="color-palette"
            label="Appearance"
            value={themeLabels[themeMode]}
            onPress={handleThemeChange}
          />
          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
          <SettingsRow
            icon="globe-outline"
            label="Backend Server"
            value={getApiBaseUrl().replace(/^https?:\/\//, '')}
            onPress={handleConfigureServer}
          />
        </GlassSurface>

        {/* Second group */}
        <GlassSurface
          variant="card"
          borderRadius={radius.lg}
          showTopHighlight
          style={styles.settingsGroup}
        >
          <SettingsRow
            icon="help-circle"
            label="Help & Audio Guide"
            onPress={() =>
              Alert.alert(
                'Dhun Audio Guide',
                'Lossless Playback Tips:\n\n• For bit-perfect 24-bit/192kHz output, use wired headphones or an external USB DAC.\n• Bluetooth codecs (SBC/AAC) are lossy; FLAC tracks will decode bit-perfectly on-device before Bluetooth transmission.\n• Offline tracks are saved directly to encrypted app storage.',
                [{ text: 'Got it' }]
              )
            }
          />
          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
          <SettingsRow
            icon="information-circle"
            label="About Dhun"
            value="v1.0.0"
            onPress={() => router.push('/about' as any)}
          />
        </GlassSurface>

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
