import React, { memo, useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, Pattern, Rect, Line } from 'react-native-svg';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence 
} from 'react-native-reanimated';

// Single SVG node replaces 100 View nodes — pattern tile repeats infinitely
export const ScanlineOverlay = memo(() => {
  const { width, height } = useWindowDimensions();
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <Pattern id="scanlines" x="0" y="0" width="1" height="2" patternUnits="userSpaceOnUse">
            <Line x1="0" y1="1" x2="1" y2="1" stroke="rgba(0,255,65,0.05)" strokeWidth="1" />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#scanlines)" />
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
