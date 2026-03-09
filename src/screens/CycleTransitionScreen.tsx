import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, Animated } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { useI18n } from '../i18n';
import type { ScreenProps } from '../navigation/types';

export const CycleTransitionScreen = ({ navigation }: ScreenProps<'CycleTransition'>) => {
  const { t } = useI18n();
  const [phase, setPhase] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  const nextCycle = 4;
  const previousFloor = 5;

  const phases = useMemo(() => [
    t('cycleTransition.extracting'),
    t('cycleTransition.processing'),
    `${t('cycleTransition.cycle')} ${nextCycle - 1} \u2192 ${t('cycleTransition.cycle')} ${nextCycle}`,
    t('cycleTransition.worldShifts'),
    t('cycleTransition.ready'),
  ], [t]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  useEffect(() => {
    if (phase < phases.length - 1) {
      const timer = setTimeout(() => setPhase(p => p + 1), 1500);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => navigation.navigate('Village'), 2000);
      return () => clearTimeout(timer);
    }
  }, [phase, phases.length, navigation]);

  const progress = ((phase + 1) / phases.length) * 100;

  return (
    <View className="flex-1 bg-background items-center justify-center">
      <CRTOverlay />

      <Animated.View style={{ opacity: fadeAnim }} className="items-center px-8">
        {/* Cycle Number */}
        <Animated.Text
          style={{ opacity: pulseAnim }}
          className="text-primary font-robotomono text-6xl font-bold mb-2"
        >
          {nextCycle}
        </Animated.Text>
        <Text className="text-primary/40 font-robotomono text-xs mb-8">{t('cycleTransition.cycle')}</Text>

        {/* Phase Text */}
        <View className="mb-8 h-12 items-center justify-center">
          <Text className="text-primary font-robotomono text-sm text-center">{phases[phase]}</Text>
        </View>

        {/* Progress Bar */}
        <View className="w-48 h-1 bg-primary/10 mb-4">
          <View className="h-1 bg-primary" style={{ width: `${progress}%` }} />
        </View>

        {/* Phase Indicators */}
        <View className="flex-row mb-8">
          {phases.map((_, i) => (
            <View
              key={i}
              className={`w-2 h-2 mx-1 ${i <= phase ? 'bg-primary' : 'bg-primary/20'}`}
            />
          ))}
        </View>

        {/* Summary */}
        <View className="border border-primary/20 p-4 w-64 bg-muted/5">
          <View className="flex-row justify-between mb-2">
            <Text className="text-primary/40 font-robotomono text-[9px]">{t('cycleTransition.maxFloor')}</Text>
            <Text className="text-primary font-robotomono text-[9px]">{previousFloor}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-primary/40 font-robotomono text-[9px]">{t('cycleTransition.nextCycle')}</Text>
            <Text className="text-primary font-robotomono text-[9px]">{nextCycle}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-primary/40 font-robotomono text-[9px]">{t('cycleTransition.towerResets')}</Text>
            <Text className="text-secondary font-robotomono text-[9px]">{t('common.yes')}</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};
