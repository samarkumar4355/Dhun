// ─── Comet Orbit Effect ─────────────────────────────────────────────
// A tiny celestial comet that orbits the circular boundary of an icon.
// Uses React Native Reanimated for smooth rotation + SVG for the comet shape.
//
// The comet is drawn as a tapered arc segment on an SVG circle:
//   - Head: brighter, wider, luminous
//   - Tail: gradually thinner and fades to transparent
// The entire SVG layer rotates around the icon using Reanimated.

import React, { useMemo } from 'react';
import { View, StyleSheet, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
} from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

// ─── Types ──────────────────────────────────────────────────────────

interface CometOrbitProps {
  /** Diameter of the circular icon being orbited */
  iconSize: number;
  /** Gap between the icon edge and the comet path (default 4) */
  gap?: number;
  /** Seconds per revolution (default 5) */
  duration?: number;
  /** Fraction of the circumference the comet occupies (0–1, default 0.15 ≈ 15%) */
  cometLength?: number;
  /** Children (the artist icon) rendered inside the orbit */
  children: React.ReactNode;
  /** Whether the animation is active (default true) */
  animate?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Convert polar to cartesian coordinates on a circle.
 */
function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/**
 * Build an SVG arc path string.
 */
function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const sweep = endAngle - startAngle;
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

// ─── Component ──────────────────────────────────────────────────────

export function CometOrbit({
  iconSize,
  gap = 4,
  duration = 5,
  cometLength = 0.15,
  children,
  animate = true,
}: CometOrbitProps) {
  const { colors } = useTheme();

  // ─── Dimensions ───────────────────────────────────────────────────
  const orbitRadius = iconSize / 2 + gap;
  const svgSize = (orbitRadius + 3) * 2; // +3 for stroke width overflow
  const center = svgSize / 2;

  // ─── Comet arc ────────────────────────────────────────────────────
  const cometArcDeg = cometLength * 360; // ≈54° for 15%
  const arcPath = useMemo(
    () => describeArc(center, center, orbitRadius, 0, cometArcDeg),
    [center, orbitRadius, cometArcDeg]
  );

  // ─── Comet colors ────────────────────────────────────────────────
  // Use the theme's gold accent for the comet glow
  const headColor = colors.accentWarm; // bright warm gold
  const tailColor = colors.accent;     // deeper muted gold

  // ─── Animation ────────────────────────────────────────────────────
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    if (!animate) {
      rotation.value = 0;
      return;
    }
    rotation.value = 0;
    rotation.value = withRepeat(
      withTiming(360, {
        duration: duration * 1000,
        easing: Easing.linear,
      }),
      -1, // infinite
      false // no reverse
    );
  }, [animate, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // ─── Static fallback for reduced motion ───────────────────────────
  // If not animating, show a subtle static comet at the top-right
  const staticStyle = !animate
    ? { transform: [{ rotate: '30deg' }] }
    : undefined;

  return (
    <View style={[styles.wrapper, { width: svgSize, height: svgSize }]}>
      {/* Comet orbit layer */}
      <Animated.View
        style={[
          styles.orbitLayer,
          { width: svgSize, height: svgSize },
          animate ? animatedStyle : staticStyle,
        ]}
      >
        <Svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
          <Defs>
            {/* Gradient: tail (transparent) → head (bright gold glow) */}
            <LinearGradient id="cometGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={tailColor} stopOpacity="0" />
              <Stop offset="35%" stopColor={tailColor} stopOpacity="0.15" />
              <Stop offset="70%" stopColor={headColor} stopOpacity="0.6" />
              <Stop offset="88%" stopColor={headColor} stopOpacity="0.9" />
              <Stop offset="100%" stopColor="#FFFBF0" stopOpacity="1" />
            </LinearGradient>
          </Defs>

          {/* The comet trail — tapered stroke via gradient */}
          <Path
            d={arcPath}
            stroke="url(#cometGrad)"
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* Icon (children) — centered within the orbit */}
      <View
        style={[
          styles.iconContainer,
          {
            width: iconSize,
            height: iconSize,
            top: (svgSize - iconSize) / 2,
            left: (svgSize - iconSize) / 2,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  orbitLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  iconContainer: {
    position: 'absolute',
    borderRadius: 9999,
    overflow: 'hidden',
  },
});
