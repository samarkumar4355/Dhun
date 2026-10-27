// ─── Dhun Glassmorphism Design Tokens ─────────────────────────────────
// Quiet luxury glass surfaces, frosted reflections, and refined borders.

import { StyleSheet, Platform } from 'react-native';

export interface GlassThemeTokens {
  /** Main surface (cards, rows, panels) */
  surface: string;
  surfaceCard: string;
  /** Nested/subtle surface (chips, secondary cards) */
  surfaceSubtle: string;
  /** Elevated surface (miniplayer, tab bar, modals, bottom sheets) */
  surfaceElevated: string;
  /** Crisp low-opacity glass border */
  border: string;
  /** Soft top-edge highlight sheen for authentic frosted glass depth */
  borderHighlight: string;
  /** Refined champagne gold border accent */
  borderAccent: string;
  /** Smoked/milky backdrop blur style for web */
  blurValue: string;
  /** Soft diffused shadows */
  shadow: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
}

export const darkGlassTokens: GlassThemeTokens = {
  // Royal obsidian-violet frosted glass
  surface: 'rgba(23, 17, 32, 0.78)',
  surfaceCard: 'rgba(28, 20, 38, 0.84)',
  surfaceSubtle: 'rgba(38, 26, 52, 0.60)',
  surfaceElevated: 'rgba(15, 11, 22, 0.94)',
  // Luxury metallic gold border
  border: 'rgba(229, 184, 66, 0.25)',
  // Soft champagne gold highlight near the upper edge
  borderHighlight: 'rgba(255, 244, 204, 0.40)',
  borderAccent: 'rgba(255, 215, 0, 0.50)',
  blurValue: 'blur(24px)',
  shadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  },
};

export const lightGlassTokens: GlassThemeTokens = {
  // Milky ivory glass
  surface: 'rgba(255, 255, 255, 0.78)',
  surfaceCard: 'rgba(255, 255, 255, 0.78)',
  surfaceSubtle: 'rgba(247, 243, 237, 0.70)',
  surfaceElevated: 'rgba(255, 255, 255, 0.92)',
  // Delicate warm-grey borders
  border: 'rgba(26, 23, 20, 0.07)',
  // Upper edge highlight
  borderHighlight: 'rgba(255, 255, 255, 0.75)',
  borderAccent: 'rgba(196, 145, 59, 0.30)',
  blurValue: 'blur(20px)',
  shadow: {
    shadowColor: '#1A1714',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
};

/** Sophisticated colour palette for travelling border animations */
export const borderAnimationPalette = {
  champagneGold: '#D7A65A',
  warmIvory: '#F7F2E7',
  pearl: '#FFFDF7',
  softSilver: '#D5D7D3',
  warmGoldHighlight: '#F1CB8C',
} as const;

/** Reusable web blur style helper */
export const webGlassStyle = Platform.select({
  web: {
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  } as any,
  default: {},
});
