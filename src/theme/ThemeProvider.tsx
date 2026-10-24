// ─── Dhun Theme Provider ────────────────────────────────────────────
// Centralized theme with time-based atmosphere and manual overrides

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { AppState, AppStateStatus, useColorScheme } from 'react-native';
import {
  DhunColors,
  lightColors,
  darkColors,
  getColorsForTimePeriod,
  getCurrentTimePeriod,
} from './colors';
import { ThemeMode, TimePeriod } from '@/types/music';

interface ThemeContextValue {
  colors: DhunColors;
  themeMode: ThemeMode;
  timePeriod: TimePeriod;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  themeMode: 'auto',
  timePeriod: 'night',
  isDark: true,
  setThemeMode: () => {},
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto');
  // Use a stable default for SSR; real value is set after mount to avoid hydration mismatch
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('night');

  // Update time period when app becomes active
  const updateTimePeriod = useCallback(() => {
    setTimePeriod(getCurrentTimePeriod());
  }, []);

  useEffect(() => {
    // Set the real time period after hydration completes
    updateTimePeriod();

    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        updateTimePeriod();
      }
    });

    // Also update every minute
    const interval = setInterval(updateTimePeriod, 60000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [updateTimePeriod]);

  const { colors, isDark } = useMemo(() => {
    let resolvedColors: DhunColors;
    let resolvedIsDark: boolean;

    switch (themeMode) {
      case 'light':
        resolvedColors = lightColors;
        resolvedIsDark = false;
        break;
      case 'dark':
        resolvedColors = darkColors;
        resolvedIsDark = true;
        break;
      case 'system':
        resolvedColors = systemScheme === 'dark' ? darkColors : lightColors;
        resolvedIsDark = systemScheme === 'dark';
        break;
      case 'auto':
      default:
        resolvedColors = getColorsForTimePeriod(timePeriod);
        resolvedIsDark = timePeriod !== 'day';
        break;
    }

    return { colors: resolvedColors, isDark: resolvedIsDark };
  }, [themeMode, timePeriod, systemScheme]);

  const value = useMemo(
    () => ({ colors, themeMode, timePeriod, isDark, setThemeMode }),
    [colors, themeMode, timePeriod, isDark]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
