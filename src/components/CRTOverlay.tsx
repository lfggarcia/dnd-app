import React, { useEffect } from 'react';
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

// Helper component to render scanlines
export const ScanlineOverlay = () => {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {Array.from({ length: 100 }).map((_, i) => (
        <View key={i} style={styles.scanline} />
      ))}
    </View>
  );
};

export const CRTOverlay = () => {
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
};
