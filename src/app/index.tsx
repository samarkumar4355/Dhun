// ─── Dhun Splash Screen ─────────────────────────────────────────────

import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuth } from '@/services/AuthProvider';
import { DhunWordmark } from '@/components/DhunWordmark';
import { FlowingWaves } from '@/animations/FlowingWaves';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SplashScreen() {
  const { colors } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const wordmarkOpacity = useSharedValue(0);
  const wordmarkTranslateY = useSharedValue(20);
  const wavesOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const phraseOpacity = useSharedValue(0);

  const navigateNext = () => {
    if (isAuthenticated) {
      router.replace('/(tabs)/listen');
    } else {
      router.replace('/login');
    }
  };

  useEffect(() => {
    // Sequence: waves → wordmark → tagline → phrase → navigate
    wavesOpacity.value = withDelay(
      300,
      withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) })
    );

    wordmarkOpacity.value = withDelay(
      800,
      withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) })
    );

    wordmarkTranslateY.value = withDelay(
      800,
      withTiming(0, { duration: 1000, easing: Easing.out(Easing.cubic) })
    );

    taglineOpacity.value = withDelay(
      1600,
      withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) })
    );

    phraseOpacity.value = withDelay(
      2200,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) })
    );

    // Navigate after animation
    const timer = setTimeout(() => {
      navigateNext();
    }, 3500);

    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
    transform: [{ translateY: wordmarkTranslateY.value }],
  }));

  const wavesStyle = useAnimatedStyle(() => ({
    opacity: wavesOpacity.value,
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  const phraseStyle = useAnimatedStyle(() => ({
    opacity: phraseOpacity.value,
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Center content */}
      <View style={styles.centerContent}>
        <Animated.View style={wordmarkStyle}>
          <DhunWordmark size="large" />
        </Animated.View>

        <Animated.View style={[styles.taglineContainer, taglineStyle]}>
          <Animated.Text style={[styles.tagline, { color: colors.textSecondary }]}>
            Your Music, Untouched.
          </Animated.Text>
        </Animated.View>

        <Animated.View style={[styles.phraseContainer, phraseStyle]}>
          <Animated.Text style={[styles.phrase, { color: colors.textMuted }]}>
            Made for every feeling.
          </Animated.Text>
        </Animated.View>
      </View>

      {/* Flowing waves at bottom */}
      <Animated.View style={[styles.wavesContainer, wavesStyle]}>
        <FlowingWaves height={220} waveCount={6} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    alignItems: 'center',
    marginBottom: 80,
  },
  taglineContainer: {
    marginTop: 16,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '400',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
  phraseContainer: {
    marginTop: 12,
  },
  phrase: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  wavesContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
