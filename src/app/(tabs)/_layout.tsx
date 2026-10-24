// ─── Dhun Tab Layout ────────────────────────────────────────────────

import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Platform } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { MiniPlayer } from '@/components/MiniPlayer';
import { usePlayer } from '@/services/PlayerProvider';
import { typography } from '@/theme/typography';

export default function TabLayout() {
  const { colors } = useTheme();
  const { currentSong } = usePlayer();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.navBackground,
            borderTopColor: colors.tabBarBorder,
            borderTopWidth: 0.5,
            height: Platform.OS === 'ios' ? 85 : 65,
            paddingBottom: Platform.OS === 'ios' ? 28 : 8,
            paddingTop: 8,
            elevation: 0,
          },
          tabBarActiveTintColor: colors.navActive,
          tabBarInactiveTintColor: colors.navInactive,
          tabBarLabelStyle: {
            ...typography.tab,
          },
        }}
      >
        <Tabs.Screen
          name="listen"
          options={{
            title: 'Listen',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: 'Library',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="library" size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="search" size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="sources"
          options={{
            title: 'Sources',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cloud-download" size={size} color={color as string} />
            ),
          }}
        />
      </Tabs>

      {/* Mini Player above tab bar - rendered via absolute positioning */}
    </View>
  );
}
