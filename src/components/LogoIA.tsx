import React, { memo, useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import LogoSvg from '../assets/logo/logoia.svg';

const LOGO_ASPECT = 1280 / 714; // native SVG dimensions

/**
 * New IA logo rendered from the SVG asset.
 * Displays at full screen width (with 32px padding) and adds a subtle
 * brightness pulse to match the app's terminal/neon aesthetic.
 */
export const LogoIA = memo(() => {
  const brightness = useSharedValue(1);

  useEffect(() => {
    brightness.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2500, easing: Easing.linear }),
        withTiming(0.6, { duration: 60, easing: Easing.steps(1) }),
        withTiming(1, { duration: 60, easing: Easing.steps(1) }),
        withTiming(1, { duration: 1200, easing: Easing.linear }),
        withTiming(0.4, { duration: 40, easing: Easing.steps(1) }),
        withTiming(0.9, { duration: 40, easing: Easing.steps(1) }),
        withTiming(0.3, { duration: 30, easing: Easing.steps(1) }),
        withTiming(1, { duration: 60, easing: Easing.steps(1) }),
        withTiming(1, { duration: 3000, easing: Easing.linear }),
      ),
      -1,
      false,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: brightness.value,
  }));

  const { width } = useWindowDimensions();
  const logoWidth = width - 64;
  const logoHeight = logoWidth / LOGO_ASPECT;

  return (
    <Animated.View style={animatedStyle}>
      <LogoSvg width={logoWidth} height={logoHeight} />
    </Animated.View>
  );
});
