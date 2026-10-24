// ─── Dhun Root Layout ───────────────────────────────────────────────

import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { PlayerProvider } from '@/services/PlayerProvider';

function RootNavigator() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen
          name="player"
          options={{
            animation: 'slide_from_bottom',
            presentation: 'modal',
          }}
        />
        <Stack.Screen name="audio-details" />
        <Stack.Screen name="import-progress" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="moments" />
        <Stack.Screen name="playlists" />
        <Stack.Screen name="artists" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <PlayerProvider>
        <RootNavigator />
      </PlayerProvider>
    </ThemeProvider>
  );
}
