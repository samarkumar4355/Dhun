// ─── Active Navigation Icon Accent ──────────────────────────────────
// A delicate circular moving perimeter accent for active navigation tab icons.
// Keeps the icon completely legible while adding refined, quiet-luxury motion.

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Path } from 'react-native-svg';
import { borderAnimationPalette } from '@/theme/glass';

interface NavIconAccentProps {
  focused: boolean;
  size?: number;
  /** Deterministic ID for SVG gradient definitions to avoid SSR hydration mismatches */
  id?: string;
  children: React.ReactNode;
}

export function NavIconAccent({ focused, size = 32, id = 'nav', children }: NavIconAccentProps) {
  const rotation = useSharedValue(0);
  const gradId = `navIconGrad_${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  useEffect(() => {
    if (!focused) {
      rotation.value = 0;
      return;
    }

    rotation.value = 0;
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 5500,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const r = (size - 4) / 2;
  const center = size / 2;
  // A small 65° arc (approx 18% of circumference)
  const arcLengthDeg = 65;
  const radStart = ((-90) * Math.PI) / 180;
  const radEnd = ((-90 + arcLengthDeg) * Math.PI) / 180;
  const startX = center + r * Math.cos(radStart);
  const startY = center + r * Math.sin(radStart);
  const endX = center + r * Math.cos(radEnd);
  const endY = center + r * Math.sin(radEnd);
  const arcPath = `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Moving circular accent for active tab */}
      {focused && (
        <Animated.View
          style={[styles.orbitLayer, { width: size, height: size }, animatedStyle]}
          pointerEvents="none"
        >
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Defs>
              <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={borderAnimationPalette.champagneGold} stopOpacity="0" />
                <Stop offset="50%" stopColor={borderAnimationPalette.warmGoldHighlight} stopOpacity="0.7" />
                <Stop offset="100%" stopColor={borderAnimationPalette.pearl} stopOpacity="0.95" />
              </LinearGradient>
            </Defs>

            <Path
              d={arcPath}
              stroke={`url(#${gradId})`}
              strokeWidth={1.3}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        </Animated.View>
      )}

      {/* Center Icon */}
      <View style={styles.iconWrapper}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  orbitLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  iconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
