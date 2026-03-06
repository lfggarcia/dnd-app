import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { CRTOverlay } from '../components/CRTOverlay';
import type { ScreenProps } from '../navigation/types';

export const CycleTransitionScreen = ({ navigation, route }: ScreenProps<'CycleTransition'>) => {
  const { from, to, cycle } = route.params;
  const textOpacity = useSharedValue(0);
  const lineWidth = useSharedValue(0);
  const eventOpacity = useSharedValue(0);

  const goBack = () => {
    navigation.goBack();
  };

  useEffect(() => {
    textOpacity.value = withTiming(1, { duration: 400 });
    lineWidth.value = withDelay(300, withTiming(1, { duration: 600 }));
    eventOpacity.value = withDelay(800, withTiming(1, { duration: 400 }));

    const timer = setTimeout(goBack, 3000);
    return () => clearTimeout(timer);
  }, []);

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const lineStyle = useAnimatedStyle(() => ({
    width: `${lineWidth.value * 100}%` as any,
  }));

  const eventStyle = useAnimatedStyle(() => ({
    opacity: eventOpacity.value,
  }));

  const isNight = to === 'NIGHT';

  return (
    <View className={`flex-1 ${isNight ? 'bg-[#05080A]' : 'bg-background'} items-center justify-center px-8`}>
      <CRTOverlay />

      {/* Phase Transition */}
      <Animated.View style={textStyle} className="items-center">
        <Text className="text-primary/30 font-robotomono text-[9px] mb-4">
          CYCLE_{String(cycle).padStart(2, '0')} / 60
        </Text>

        <View className="flex-row items-center mb-2">
          <Text className={`font-robotomono text-2xl ${isNight ? 'text-primary/40' : 'text-secondary'}`}>
            {from === 'DAY' ? '☀' : '☽'}
          </Text>
          <Text className="text-primary/30 font-robotomono text-xl mx-4">→</Text>
          <Text className={`font-robotomono text-2xl ${isNight ? 'text-accent' : 'text-secondary'}`}>
            {to === 'DAY' ? '☀' : '☽'}
          </Text>
        </View>

        <Text className={`font-robotomono text-3xl font-bold mb-2 ${isNight ? 'text-accent' : 'text-secondary'}`}>
          {to}_PHASE
        </Text>

        {isNight && (
          <Text className="text-destructive/60 font-robotomono text-[8px]">
            ⚠ ENEMIES STRONGER · BETTER LOOT · MORE XP
          </Text>
        )}
      </Animated.View>

      {/* Separator Line */}
      <View className="w-full items-center my-6">
        <Animated.View style={lineStyle} className="h-[1px] bg-primary/30" />
      </View>

      {/* Cycle Events Summary */}
      <Animated.View style={eventStyle} className="w-full">
        <Text className="text-primary/40 font-robotomono text-[8px] text-center mb-2">
          WORLD_EVENTS_THIS_CYCLE:
        </Text>
        <View className="border border-primary/15 p-3 bg-muted/10">
          <Text className="text-primary/60 font-robotomono text-[8px] mb-1">
            ▲ IRON_WOLVES cleared FLOOR_02
          </Text>
          <Text className="text-destructive/60 font-robotomono text-[8px] mb-1">
            ✕ LAST_LIGHT eliminated on FLOOR_03
          </Text>
          <Text className="text-accent/60 font-robotomono text-[8px]">
            ⚖ SHADOW_PACT formed alliance with CRIMSON_OATH
          </Text>
        </View>
      </Animated.View>

      {/* Auto-dismiss indicator */}
      <Text className="absolute bottom-8 text-primary/20 font-robotomono text-[7px]">
        AUTO_CONTINUE...
      </Text>
    </View>
  );
};
