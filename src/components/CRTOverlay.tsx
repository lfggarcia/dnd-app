import React, { memo, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence 
} from 'react-native-reanimated';

const styles = StyleSheet.create({
  scanline: {
    height: 1,
    backgroundColor: 'rgba(0, 255, 65, 0.05)',
  }
});

// Hoisted so React can diff a stable reference — avoids re-creating 100 items
const SCANLINE_INDICES = Array.from({ length: 100 }, (_, i) => i);

// Memoized: re-renders only if its own props change (it has none)
export const ScanlineOverlay = memo(() => (
  <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
    {SCANLINE_INDICES.map(i => (
      <View key={i} style={styles.scanline} />
    ))}
  </View>
));

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
