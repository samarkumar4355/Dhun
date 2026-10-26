// ─── Travelling Colour-Changing Animated Border ──────────────────────
// A subtle, quiet-luxury highlight that travels smoothly around the component's
// perimeter. Transitions through champagne gold, warm ivory, soft pearl, and silver.

import React, { useEffect, useState, useId } from 'react';
import {
  View,
  StyleSheet,
  LayoutChangeEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import { borderAnimationPalette } from '@/theme/glass';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export interface AnimatedBorderProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  /** Deterministic ID to avoid SSR hydration mismatches */
  id?: string;
  /** Fixed width (if known) or measured automatically */
  width?: number;
  /** Fixed height (if known) or measured automatically */
  height?: number;
  /** Whether the travelling highlight animation is active (default true) */
  active?: boolean;
  /** Duration in seconds per perimeter cycle (default 6.5s) */
  duration?: number;
  /** Stroke width of travelling highlight (default 1.2px) */
  strokeWidth?: number;
  /** Subtle background border color (default 'transparent') */
  staticBorderColor?: string;
}

export function AnimatedBorder({
  children,
  style,
  borderRadius = 14,
  id,
  width: propWidth,
  height: propHeight,
  active = true,
  duration = 6.5,
  strokeWidth = 1.2,
  staticBorderColor,
}: AnimatedBorderProps) {
  const [layout, setLayout] = useState({
    width: propWidth || 0,
    height: propHeight || 0,
  });

  const fallbackId = useId();
  const gradId = `animBorderGrad_${(id || fallbackId).replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  const handleLayout = (e: LayoutChangeEvent) => {
    if (!propWidth || !propHeight) {
      const { width: w, height: h } = e.nativeEvent.layout;
      if (Math.abs(w - layout.width) > 1 || Math.abs(h - layout.height) > 1) {
        setLayout({ width: Math.round(w), height: Math.round(h) });
      }
    }
  };

  const w = propWidth || layout.width;
  const h = propHeight || layout.height;

  // Approximate perimeter of rounded rectangle
  const r = Math.min(borderRadius, Math.min(w / 2, h / 2));
  const straightLength = Math.max(0, 2 * (w - 2 * r) + 2 * (h - 2 * r));
  const cornerLength = 2 * Math.PI * r;
  const perimeter = straightLength + cornerLength;

  // Highlight segment length: ~12-15% of perimeter
  const dashLength = Math.max(28, Math.min(80, perimeter * 0.13));

  // Reanimated offset
  const offset = useSharedValue(0);

  useEffect(() => {
    if (!active || perimeter <= 0) {
      offset.value = 0;
      return;
    }

    offset.value = 0;
    offset.value = withRepeat(
      withTiming(perimeter, {
        duration: duration * 1000,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [active, perimeter, duration]);

  const animatedProps = useAnimatedProps(() => {
    return {
      strokeDashoffset: -offset.value,
    };
  });

  const hasDimensions = w > 0 && h > 0;

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.container,
        { borderRadius },
        staticBorderColor ? { borderColor: staticBorderColor, borderWidth: 1 } : undefined,
        style,
      ]}
    >
      {/* Overlay SVG containing the travelling gradient highlight */}
      {hasDimensions && active && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
            <Defs>
              {/* Refined multi-stop transition: champagne gold → warm ivory → pearl → soft silver */}
              <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={borderAnimationPalette.champagneGold} stopOpacity="0.8" />
                <Stop offset="30%" stopColor={borderAnimationPalette.warmGoldHighlight} stopOpacity="0.9" />
                <Stop offset="65%" stopColor={borderAnimationPalette.warmIvory} stopOpacity="0.95" />
                <Stop offset="85%" stopColor={borderAnimationPalette.pearl} stopOpacity="1" />
                <Stop offset="100%" stopColor={borderAnimationPalette.softSilver} stopOpacity="0.7" />
              </LinearGradient>
            </Defs>

            <AnimatedRect
              x={strokeWidth / 2}
              y={strokeWidth / 2}
              width={Math.max(0, w - strokeWidth)}
              height={Math.max(0, h - strokeWidth)}
              rx={r}
              ry={r}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${Math.max(1, perimeter - dashLength)}`}
              strokeLinecap="round"
              animatedProps={animatedProps}
            />
          </Svg>
        </View>
      )}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'visible',
  },
});
