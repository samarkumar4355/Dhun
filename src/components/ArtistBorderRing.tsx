// ─── Revolving Full Border Ring Animation for Artists ────────────────
// A continuous, full 360-degree border ring that revolves around the artist icon
// with harmonious, constantly changing colours (champagne gold, warm rose/amber,
// luminous pearl ivory, soft celestial silver/jade).

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
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
  Circle,
} from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

export interface ArtistBorderRingProps {
  /** Diameter of the circular icon being orbited */
  iconSize: number;
  /** Gap between the icon edge and the rotating ring (default 3.5) */
  gap?: number;
  /** Seconds per revolution (default 5.5s) */
  duration?: number;
  /** Stroke width of the rotating ring (default 2px) */
  strokeWidth?: number;
  /** Children (the artist icon) rendered inside the ring */
  children: React.ReactNode;
  /** Whether the animation is active (default true) */
  animate?: boolean;
  /** Deterministic ID to avoid SSR hydration mismatches */
  id?: string;
  /** Legacy prop for backward compatibility */
  cometLength?: number;
}

export function ArtistBorderRing({
  iconSize,
  gap = 3.5,
  duration = 5.5,
  strokeWidth = 2,
  children,
  animate = true,
  id = 'artist',
}: ArtistBorderRingProps) {
  const { isDark } = useTheme();

  // Clean deterministic ID for gradients
  const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const gradId1 = `artistRingGrad1_${cleanId}`;
  const gradId2 = `artistRingGrad2_${cleanId}`;
  const glowGradId = `artistRingGlow_${cleanId}`;

  // Dimensions
  const orbitRadius = iconSize / 2 + gap;
  const svgSize = Math.ceil((orbitRadius + strokeWidth + 6) * 2);
  const center = svgSize / 2;

  // Shared rotation values for smooth multi-layered color shifting
  const rotation1 = useSharedValue(0);
  const rotation2 = useSharedValue(0);

  useEffect(() => {
    if (!animate) {
      rotation1.value = 0;
      rotation2.value = 0;
      return;
    }

    // Primary rotation: clockwise
    rotation1.value = 0;
    rotation1.value = withRepeat(
      withTiming(360, {
        duration: duration * 1000,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    // Counter-phased rotation: slightly different duration for shifting color interference
    rotation2.value = 0;
    rotation2.value = withRepeat(
      withTiming(-360, {
        duration: duration * 1.35 * 1000,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [animate, duration]);

  const animatedStyle1 = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation1.value}deg` }],
  }));

  const animatedStyle2 = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation2.value}deg` }],
  }));

  return (
    <View style={[styles.wrapper, { width: svgSize, height: svgSize }]}>
      {/* ─── Layer 1: Ambient Glow Ring (Clockwise) ────────────────── */}
      <Animated.View
        style={[
          styles.orbitLayer,
          { width: svgSize, height: svgSize },
          animate ? animatedStyle1 : undefined,
        ]}
        pointerEvents="none"
      >
        <Svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
          <Defs>
            <LinearGradient id={glowGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#D7A65A" stopOpacity={isDark ? 0.35 : 0.25} />
              <Stop offset="25%" stopColor="#E89A74" stopOpacity={isDark ? 0.40 : 0.28} />
              <Stop offset="50%" stopColor="#FAF6ED" stopOpacity={isDark ? 0.45 : 0.32} />
              <Stop offset="75%" stopColor="#8EB5B0" stopOpacity={isDark ? 0.35 : 0.25} />
              <Stop offset="100%" stopColor="#D7A65A" stopOpacity={isDark ? 0.35 : 0.25} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={center}
            cy={center}
            r={orbitRadius}
            stroke={`url(#${glowGradId})`}
            strokeWidth={strokeWidth + 2.4}
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* ─── Layer 2: Primary Crisp Rotating Ring ─────────────────── */}
      <Animated.View
        style={[
          styles.orbitLayer,
          { width: svgSize, height: svgSize },
          animate ? animatedStyle1 : undefined,
        ]}
        pointerEvents="none"
      >
        <Svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
          <Defs>
            <LinearGradient id={gradId1} x1="0%" y1="0%" x2="100%" y2="100%">
              {/* Champagne Gold */}
              <Stop offset="0%" stopColor="#D7A65A" stopOpacity="0.95" />
              {/* Warm Amber / Coral */}
              <Stop offset="25%" stopColor="#E89A74" stopOpacity="0.90" />
              {/* Luminous Pearl Ivory */}
              <Stop offset="50%" stopColor="#FAF6ED" stopOpacity="1" />
              {/* Soft Celestial Jade / Silver */}
              <Stop offset="75%" stopColor="#8EB5B0" stopOpacity="0.88" />
              {/* Back to Champagne Gold */}
              <Stop offset="100%" stopColor="#D7A65A" stopOpacity="0.95" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={center}
            cy={center}
            r={orbitRadius}
            stroke={`url(#${gradId1})`}
            strokeWidth={strokeWidth}
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* ─── Layer 3: Counter-phased Shimmer Layer (Changing Colour) ─ */}
      <Animated.View
        style={[
          styles.orbitLayer,
          { width: svgSize, height: svgSize },
          animate ? animatedStyle2 : undefined,
        ]}
        pointerEvents="none"
      >
        <Svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
          <Defs>
            <LinearGradient id={gradId2} x1="100%" y1="0%" x2="0%" y2="100%">
              {/* Luminous Pearl Ivory */}
              <Stop offset="0%" stopColor="#FAF6ED" stopOpacity="0.65" />
              {/* Soft Lavender Silver */}
              <Stop offset="30%" stopColor="#C4B5D4" stopOpacity="0.55" />
              {/* Warm Rose Gold */}
              <Stop offset="65%" stopColor="#E59F7D" stopOpacity="0.60" />
              {/* Radiant Warm Gold */}
              <Stop offset="100%" stopColor="#E5B869" stopOpacity="0.70" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={center}
            cy={center}
            r={orbitRadius}
            stroke={`url(#${gradId2})`}
            strokeWidth={strokeWidth}
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* ─── Center Artist Icon Content ────────────────────────────── */}
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

// Backward compatibility alias
export const CometOrbit = ArtistBorderRing;

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
  },
  iconContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
