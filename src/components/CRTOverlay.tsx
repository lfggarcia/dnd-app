import React, { memo, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Defs, Pattern, Rect, Line } from 'react-native-svg';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence,
  cancelAnimation,
} from 'react-native-reanimated';

// Computed once at module load — TORRE is portrait-only, no rotation support
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Single SVG node replaces 100 View nodes — pattern tile repeats infinitely
export const ScanlineOverlay = memo(() => {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Svg width={SCREEN_W} height={SCREEN_H}>
        <Defs>
          <Pattern id="scanlines" x="0" y="0" width="1" height="2" patternUnits="userSpaceOnUse">
            <Line x1="0" y1="1" x2="1" y2="1" stroke="rgba(0,255,65,0.05)" strokeWidth="1" />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width={SCREEN_W} height={SCREEN_H} fill="url(#scanlines)" />
      </Svg>
    </View>
  );
});

export const CRTOverlay = memo(() => {
  const flicker = useSharedValue(1);

  useEffect(() => {
    flicker.value = withRepeat(
      withSequence(
        withTiming(0.98, { duration: 50 }),
        withTiming(1, { duration: 50 }),
        withTiming(0.99, { duration: 1500 }),
        withTiming(0.97, { duration: 50 }),
        withTiming(1, { duration: 50 })
      ),
      -1,
      true
    );
    // CR-060: cancel animation on unmount to prevent orphaned Reanimated worklets
    return () => cancelAnimation(flicker);
  }, [flicker]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - flicker.value + 0.05,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ScanlineOverlay />
      <Animated.View 
        className="bg-primary/5"
        style={[StyleSheet.absoluteFill, animatedStyle]} 
      />
    </View>
  );
});
