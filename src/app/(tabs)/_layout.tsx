import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Platform } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { NavIconAccent } from '@/components/NavIconAccent';

export default function TabLayout() {
  const { colors, glass } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: glass.surfaceElevated,
            borderTopColor: glass.border,
            borderTopWidth: 0.75,
            height: Platform.OS === 'ios' ? 85 : 68,
            paddingBottom: Platform.OS === 'ios' ? 28 : 10,
            paddingTop: 8,
            elevation: 0,
            ...(Platform.OS === 'web'
              ? ({
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                } as any)
              : {}),
          },
          tabBarActiveTintColor: colors.navActive,
          tabBarInactiveTintColor: colors.navInactive,
          tabBarLabelStyle: {
            ...typography.tab,
            marginTop: 2,
          },
        }}
      >
        <Tabs.Screen
          name="listen"
          options={{
            title: 'Listen',
            tabBarIcon: ({ color, size, focused }) => (
              <NavIconAccent id="listen" focused={focused} size={size + 8}>
                <Ionicons name="home" size={size} color={color as string} />
              </NavIconAccent>
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: 'Library',
            tabBarIcon: ({ color, size, focused }) => (
              <NavIconAccent id="library" focused={focused} size={size + 8}>
                <Ionicons name="library" size={size} color={color as string} />
              </NavIconAccent>
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
            tabBarIcon: ({ color, size, focused }) => (
              <NavIconAccent id="search" focused={focused} size={size + 8}>
                <Ionicons name="search" size={size} color={color as string} />
              </NavIconAccent>
            ),
          }}
        />
        <Tabs.Screen
          name="sources"
          options={{
            title: 'Sources',
            tabBarIcon: ({ color, size, focused }) => (
              <NavIconAccent id="sources" focused={focused} size={size + 8}>
                <Ionicons name="cloud-download" size={size} color={color as string} />
              </NavIconAccent>
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
