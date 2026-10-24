// ─── Reusable Glass Surface Component ───────────────────────────────
// Frosted glassmorphism container with translucent tones, subtle border sheen,
// soft diffused shadows, and native/web backdrop-blur compatibility.

import React from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Platform,
  GestureResponderEvent,
} from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/spacing';
import { webGlassStyle } from '@/theme/glass';

export interface GlassSurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'card' | 'subtle' | 'elevated' | 'interactive';
  borderRadius?: number;
  /** Whether to render a delicate 0.5px top highlight sheen simulating light catch */
  showTopHighlight?: boolean;
  /** Optional soft ambient gold glow behind the surface for hero cards */
  showAmbientGlow?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'none';
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
}

export function GlassSurface({
  children,
  style,
  variant = 'card',
  borderRadius = radius.lg,
  showTopHighlight = true,
  showAmbientGlow = false,
  onPress,
  accessibilityLabel,
  accessibilityRole,
  pointerEvents,
}: GlassSurfaceProps) {
  const { glass, isDark } = useTheme();

  // Determine background color based on hierarchy variant
  const backgroundColor =
    variant === 'elevated'
      ? glass.surfaceElevated
      : variant === 'subtle'
      ? glass.surfaceSubtle
      : glass.surface;

  const containerStyle: ViewStyle = {
    backgroundColor,
    borderRadius,
    borderColor: glass.border,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    ...(variant === 'elevated' ? glass.shadow : {}),
    ...(Platform.OS === 'web' ? webGlassStyle : {}),
  };

  const content = (
    <>
      {/* Soft ambient gold backglow for hero elements */}
      {showAmbientGlow && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark
                ? 'rgba(215, 166, 90, 0.06)'
                : 'rgba(196, 145, 59, 0.05)',
              borderRadius,
            },
          ]}
        />
      )}

      {/* Top highlight sheen line */}
      {showTopHighlight && (
        <View
          pointerEvents="none"
          style={[
            styles.topSheen,
            {
              backgroundColor: glass.borderHighlight,
              borderTopLeftRadius: borderRadius,
              borderTopRightRadius: borderRadius,
            },
          ]}
        />
      )}

      {children}
    </>
  );

  if (onPress || variant === 'interactive') {
    return (
      <Pressable
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole || 'button'}
        pointerEvents={pointerEvents}
        style={({ pressed }) => [
          containerStyle,
          {
            opacity: pressed ? 0.88 : 1,
            transform: pressed ? [{ scale: 0.99 }] : [{ scale: 1 }],
          },
          style,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      pointerEvents={pointerEvents}
      accessibilityLabel={accessibilityLabel}
      style={[containerStyle, style]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  topSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 0.75,
    zIndex: 2,
  },
});
