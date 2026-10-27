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
  royalViolet?: string;
  royalMaroon?: string;
  goldRich?: string;
  goldShine?: string;
  creamText?: string;
}

// ─── Royal Gold & Obsidian Glass Theme (Rich & Luxurious) ───────────
export const nightColors: DhunColors = {
  background: '#09080E',
  surface: 'rgba(23, 17, 32, 0.82)',
  surfaceSecondary: 'rgba(34, 24, 48, 0.72)',
  accent: '#E5B842',
  accentWarm: '#FFD700',
  accentSubtle: 'rgba(229, 184, 66, 0.16)',
  textPrimary: '#FFF9ED',
  textSecondary: '#D9CFBF',
  textMuted: '#948777',
  border: 'rgba(229, 184, 66, 0.22)',
  borderSubtle: 'rgba(229, 184, 66, 0.12)',
  cardBackground: 'rgba(26, 19, 36, 0.84)',
  miniPlayerBackground: 'rgba(15, 11, 22, 0.94)',
  navBackground: 'rgba(11, 8, 16, 0.96)',
  navActive: '#FFD700',
  navInactive: '#85786A',
  success: '#5CB870',
  error: '#E0614A',
  warning: '#FFD700',
  overlay: 'rgba(5, 4, 8, 0.78)',
  progressTrack: 'rgba(229, 184, 66, 0.18)',
  progressFill: '#FFD700',
  skeleton: 'rgba(38, 28, 54, 0.50)',
  tabBarBorder: 'rgba(229, 184, 66, 0.20)',
  royalViolet: '#2A1342',
  royalMaroon: '#3D0D1B',
  goldRich: '#E5B842',
  goldShine: '#FFDF6C',
  creamText: '#FFF9ED',
};

// ─── Morning Theme (Warm royal amber & gold) ────────────────────────
export const morningColors: DhunColors = {
  background: '#120E15',
  surface: 'rgba(29, 21, 38, 0.82)',
  surfaceSecondary: 'rgba(42, 30, 56, 0.70)',
  accent: '#E5B842',
  accentWarm: '#FFD700',
  accentSubtle: 'rgba(229, 184, 66, 0.16)',
  textPrimary: '#FFF8E7',
  textSecondary: '#D6CCBC',
  textMuted: '#8F8271',
  border: 'rgba(229, 184, 66, 0.22)',
  borderSubtle: 'rgba(229, 184, 66, 0.12)',
  cardBackground: 'rgba(30, 22, 40, 0.84)',
  miniPlayerBackground: 'rgba(18, 13, 24, 0.94)',
  navBackground: 'rgba(14, 10, 19, 0.96)',
  navActive: '#FFD700',
  navInactive: '#8A7D6C',
  success: '#5CB870',
  error: '#E0614A',
  warning: '#FFD700',
  overlay: 'rgba(5, 4, 8, 0.75)',
  progressTrack: 'rgba(229, 184, 66, 0.18)',
  progressFill: '#FFD700',
  skeleton: 'rgba(42, 30, 56, 0.50)',
  tabBarBorder: 'rgba(229, 184, 66, 0.20)',
  royalViolet: '#2D1445',
  royalMaroon: '#3E0D1B',
  goldRich: '#E5B842',
  goldShine: '#FFDF6C',
  creamText: '#FFF8E7',
};

// ─── Day Theme (Ivory cream & champagne gold) ───────────────────────
export const dayColors: DhunColors = {
  background: '#FAF6EF',
  surface: '#FFFFFF',
  surfaceSecondary: '#F4ECE0',
  accent: '#C59336',
  accentWarm: '#DFAB45',
  accentSubtle: '#F6EBD8',
  textPrimary: '#1E1914',
  textSecondary: '#6B6256',
  textMuted: '#9E9486',
  border: 'rgba(197, 147, 54, 0.25)',
  borderSubtle: 'rgba(197, 147, 54, 0.12)',
  cardBackground: '#FFFFFF',
  miniPlayerBackground: '#FFFFFF',
  navBackground: '#FAF6EF',
  navActive: '#C59336',
  navInactive: '#9E9486',
  success: '#3D9950',
  error: '#D44332',
  warning: '#D4962C',
  overlay: 'rgba(0, 0, 0, 0.45)',
  progressTrack: 'rgba(197, 147, 54, 0.20)',
  progressFill: '#C59336',
  skeleton: '#F4ECE0',
  tabBarBorder: 'rgba(197, 147, 54, 0.20)',
  royalViolet: '#3D1A61',
  royalMaroon: '#4E1122',
  goldRich: '#C59336',
  goldShine: '#DFAB45',
  creamText: '#FFFDF9',
};

// ─── Evening Theme (Velvet wine & royal gold) ───────────────────────
export const eveningColors: DhunColors = {
  background: '#0D0812',
  surface: 'rgba(28, 18, 38, 0.82)',
  surfaceSecondary: 'rgba(44, 26, 58, 0.70)',
  accent: '#E5B842',
  accentWarm: '#FFD700',
  accentSubtle: 'rgba(229, 184, 66, 0.16)',
  textPrimary: '#FFF9ED',
  textSecondary: '#D8CEBF',
  textMuted: '#928574',
  border: 'rgba(229, 184, 66, 0.24)',
  borderSubtle: 'rgba(229, 184, 66, 0.12)',
  cardBackground: 'rgba(30, 20, 42, 0.84)',
  miniPlayerBackground: 'rgba(16, 11, 23, 0.94)',
  navBackground: 'rgba(13, 8, 18, 0.96)',
  navActive: '#FFD700',
  navInactive: '#8A7D6C',
  success: '#5CB870',
  error: '#E0614A',
  warning: '#FFD700',
  overlay: 'rgba(5, 4, 8, 0.78)',
  progressTrack: 'rgba(229, 184, 66, 0.18)',
  progressFill: '#FFD700',
  skeleton: 'rgba(44, 26, 58, 0.50)',
  tabBarBorder: 'rgba(229, 184, 66, 0.20)',
  royalViolet: '#33154F',
  royalMaroon: '#470E20',
  goldRich: '#E5B842',
  goldShine: '#FFDF6C',
  creamText: '#FFF9ED',
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
