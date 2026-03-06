import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';

interface Props {
  onConfirm: () => void;
  label: string;
  width?: number;
}

export const SliderButton = ({ onConfirm, label, width = 300 }: Props) => {
  const translateX = useSharedValue(0);
  const trackWidth = width - 60; // Button width is 60

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationX > 0 && event.translationX < trackWidth) {
        translateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      if (event.translationX > trackWidth * 0.8) {
        translateX.value = withSpring(trackWidth);
        runOnJS(onConfirm)();
      } else {
        translateX.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, trackWidth * 0.5], [1, 0], 'clamp'),
  }));

  return (
    <View style={{ width, height: 60 }} className="bg-muted border-2 border-primary overflow-hidden justify-center px-2">
      <Animated.Text 
        className="text-primary font-robotomono text-center absolute self-center"
        style={textStyle}
      >
        {label} {">>>"}
      </Animated.Text>
      
      <GestureDetector gesture={gesture}>
        <Animated.View 
          style={[{ width: 50, height: 44 }, animatedStyle]} 
          className="bg-primary items-center justify-center"
        >
          <Text className="text-background font-bold">II</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};
