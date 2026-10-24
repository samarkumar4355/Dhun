// ─── Flowing Waves Animation ────────────────────────────────────────
// Reusable golden wave component for splash and import screens

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface FlowingWavesProps {
  height?: number;
  waveCount?: number;
  opacity?: number;
}

function generateWavePath(
  width: number,
  height: number,
  amplitude: number,
  frequency: number,
  phase: number,
  yOffset: number,
): string {
  const points: string[] = [];
  const steps = 60;
  
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const y = yOffset + amplitude * Math.sin((frequency * x / width) * Math.PI * 2 + phase);
    points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  
  return points.join(' ');
}

interface WaveLineProps {
  width: number;
  height: number;
  amplitude: number;
  frequency: number;
  yOffset: number;
  color: string;
  strokeWidth: number;
  phaseOffset: number;
  duration: number;
}

function WaveLine({
  width,
  height,
  amplitude,
  frequency,
  yOffset,
  color,
  strokeWidth,
  phaseOffset,
  duration,
}: WaveLineProps) {
  const phase = useSharedValue(phaseOffset);

  useEffect(() => {
    phase.value = withRepeat(
      withTiming(phaseOffset + Math.PI * 2, {
        duration,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [phase, phaseOffset, duration]);

  const animatedProps = useAnimatedProps(() => {
    const points: string[] = [];
    const steps = 50;
    
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * width;
      const y = yOffset + amplitude * Math.sin((frequency * x / width) * Math.PI * 2 + phase.value);
      points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    
    return {
      d: points.join(' '),
    };
  });

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      stroke={color}
      strokeWidth={strokeWidth}
      fill="none"
      strokeLinecap="round"
      opacity={0.6}
    />
  );
}

export function FlowingWaves({ height = 200, waveCount = 5, opacity = 1 }: FlowingWavesProps) {
  const { colors } = useTheme();
  const width = 400;

  const waves = React.useMemo(() => {
    return Array.from({ length: waveCount }, (_, i) => ({
      amplitude: 8 + i * 3,
      frequency: 1.2 + i * 0.3,
      yOffset: height * 0.3 + i * (height * 0.12),
      strokeWidth: 1.5 - i * 0.15,
      phaseOffset: i * 0.8,
      duration: 4000 + i * 800,
      color: i < 2 ? colors.accentWarm : colors.accent,
    }));
  }, [waveCount, height, colors]);

  return (
    <View style={[styles.container, { height, opacity }]}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {waves.map((wave, index) => (
          <WaveLine
            key={index}
            width={width}
            height={height}
            amplitude={wave.amplitude}
            frequency={wave.frequency}
            yOffset={wave.yOffset}
            color={wave.color}
            strokeWidth={wave.strokeWidth}
            phaseOffset={wave.phaseOffset}
            duration={wave.duration}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
});
