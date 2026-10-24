// ─── Dhun Color Palette ─────────────────────────────────────────────
// Time-based atmospheric theme system

import { TimePeriod } from '@/types/music';

export interface DhunColors {
  background: string;
  surface: string;
  surfaceSecondary: string;
  accent: string;
  accentWarm: string;
  accentSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderSubtle: string;
  cardBackground: string;
  miniPlayerBackground: string;
  navBackground: string;
  navActive: string;
  navInactive: string;
  success: string;
  error: string;
  warning: string;
  overlay: string;
  progressTrack: string;
  progressFill: string;
  skeleton: string;
  tabBarBorder: string;
}

// ─── Night Theme (20:00–04:59) — Deep, cinematic ────────────────────
export const nightColors: DhunColors = {
  background: '#101312',
  surface: '#1B201E',
  surfaceSecondary: '#252A27',
  accent: '#D7A65A',
  accentWarm: '#F1CB8C',
  accentSubtle: '#3D3526',
  textPrimary: '#F5F1E8',
  textSecondary: '#A8AAA3',
  textMuted: '#6B6E68',
  border: '#343A35',
  borderSubtle: '#252A27',
  cardBackground: '#1B201E',
  miniPlayerBackground: '#1B201E',
  navBackground: '#141816',
  navActive: '#D7A65A',
  navInactive: '#6B6E68',
  success: '#5CB870',
  error: '#E0614A',
  warning: '#E8A838',
  overlay: 'rgba(0, 0, 0, 0.7)',
  progressTrack: '#343A35',
  progressFill: '#D7A65A',
  skeleton: '#252A27',
  tabBarBorder: '#252A27',
};

// ─── Morning Theme (05:00–10:59) — Warm, fresh ─────────────────────
export const morningColors: DhunColors = {
  background: '#1A1714',
  surface: '#252119',
  surfaceSecondary: '#302B22',
  accent: '#D7A65A',
  accentWarm: '#F1CB8C',
  accentSubtle: '#3D3526',
  textPrimary: '#F5F1E8',
  textSecondary: '#B5AFA3',
  textMuted: '#7A756C',
  border: '#3A3428',
  borderSubtle: '#302B22',
  cardBackground: '#252119',
  miniPlayerBackground: '#252119',
  navBackground: '#1A1714',
  navActive: '#D7A65A',
  navInactive: '#7A756C',
  success: '#5CB870',
  error: '#E0614A',
  warning: '#E8A838',
  overlay: 'rgba(0, 0, 0, 0.65)',
  progressTrack: '#3A3428',
  progressFill: '#D7A65A',
  skeleton: '#302B22',
  tabBarBorder: '#302B22',
};

// ─── Day Theme (11:00–16:59) — Bright, warm ivory ───────────────────
export const dayColors: DhunColors = {
  background: '#FAF6F0',
  surface: '#FFFFFF',
  surfaceSecondary: '#F0EBE3',
  accent: '#C4913B',
  accentWarm: '#D7A65A',
  accentSubtle: '#F0E6D3',
  textPrimary: '#1A1714',
  textSecondary: '#6B655C',
  textMuted: '#9E9890',
  border: '#E5E0D6',
  borderSubtle: '#F0EBE3',
  cardBackground: '#FFFFFF',
  miniPlayerBackground: '#FFFFFF',
  navBackground: '#FAF6F0',
  navActive: '#C4913B',
  navInactive: '#9E9890',
  success: '#3D9950',
  error: '#D44332',
  warning: '#D4962C',
  overlay: 'rgba(0, 0, 0, 0.4)',
  progressTrack: '#E5E0D6',
  progressFill: '#C4913B',
  skeleton: '#F0EBE3',
  tabBarBorder: '#E5E0D6',
};

// ─── Evening Theme (17:00–19:59) — Warm amber, cinematic ────────────
export const eveningColors: DhunColors = {
  background: '#151210',
  surface: '#201C18',
  surfaceSecondary: '#2B2520',
  accent: '#D7A65A',
  accentWarm: '#F1CB8C',
  accentSubtle: '#3D3020',
  textPrimary: '#F5F1E8',
  textSecondary: '#B0A898',
  textMuted: '#74706A',
  border: '#3A3328',
  borderSubtle: '#2B2520',
  cardBackground: '#201C18',
  miniPlayerBackground: '#201C18',
  navBackground: '#151210',
  navActive: '#D7A65A',
  navInactive: '#74706A',
  success: '#5CB870',
  error: '#E0614A',
  warning: '#E8A838',
  overlay: 'rgba(0, 0, 0, 0.7)',
  progressTrack: '#3A3328',
  progressFill: '#D7A65A',
  skeleton: '#2B2520',
  tabBarBorder: '#2B2520',
};

// ─── Manual Light Theme ─────────────────────────────────────────────
export const lightColors: DhunColors = dayColors;

// ─── Manual Dark Theme ──────────────────────────────────────────────
export const darkColors: DhunColors = nightColors;

export function getColorsForTimePeriod(period: TimePeriod): DhunColors {
  switch (period) {
    case 'morning': return morningColors;
    case 'day': return dayColors;
    case 'evening': return eveningColors;
    case 'night': return nightColors;
  }
}

export function getCurrentTimePeriod(): TimePeriod {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'evening';
  return 'night';
}
