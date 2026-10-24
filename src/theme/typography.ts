// ─── Dhun Typography System ─────────────────────────────────────────
import { Platform, TextStyle } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const typography = {
  // Display — Splash wordmark
  display: {
    fontFamily,
    fontSize: 48,
    fontWeight: '300' as TextStyle['fontWeight'],
    letterSpacing: 2,
  },

  // H1 — Screen titles
  h1: {
    fontFamily,
    fontSize: 28,
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: 0.2,
  },

  // H2 — Section headers
  h2: {
    fontFamily,
    fontSize: 22,
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: 0.1,
  },

  // H3 — Subsection headers
  h3: {
    fontFamily,
    fontSize: 18,
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: 0,
  },

  // Body large
  bodyLarge: {
    fontFamily,
    fontSize: 16,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 24,
  },

  // Body
  body: {
    fontFamily,
    fontSize: 14,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 20,
  },

  // Body small
  bodySmall: {
    fontFamily,
    fontSize: 12,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 16,
  },

  // Label
  label: {
    fontFamily,
    fontSize: 13,
    fontWeight: '500' as TextStyle['fontWeight'],
    letterSpacing: 0.3,
  },

  // Caption
  caption: {
    fontFamily,
    fontSize: 11,
    fontWeight: '400' as TextStyle['fontWeight'],
    letterSpacing: 0.2,
    lineHeight: 14,
  },

  // Tab label
  tab: {
    fontFamily,
    fontSize: 10,
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: 0.5,
  },

  // Metadata / quality badge
  metadata: {
    fontFamily,
    fontSize: 11,
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: 0.8,
  },
} as const;
