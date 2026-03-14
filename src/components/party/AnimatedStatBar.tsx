import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { getTranslatedField } from '../../services/translationBridge';
import type { Lang } from '../../i18n';
import type { Stats } from '../../database/gameRepository';

const S = StyleSheet.create({
  bonusText: { color: 'rgba(0,229,255,0.9)' },
});

type AnimatedStatBarProps = {
  statKey: keyof Stats;
  base: number;
  bonus: number;
  index: number;
  lang: Lang;
};

export const AnimatedStatBar = memo(({ statKey, base, bonus, index, lang }: AnimatedStatBarProps) => {
  const final = Math.min(20, base + bonus);
  const mod = Math.floor((final - 10) / 2);
  const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
  const pct = Math.min(((final - 3) / 17) * 100, 100);
  const label = getTranslatedField('ability-scores', statKey.toLowerCase(), 'name', lang) || statKey;

  const barWidth = useSharedValue(0);
  const barGlow = useSharedValue(0);

  useEffect(() => {
    barWidth.value = withDelay(
      index * 80,
      withTiming(pct, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
    barGlow.value = withDelay(
      index * 80,
      withSequence(
        withTiming(1, { duration: 250, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 400, easing: Easing.in(Easing.quad) }),
      ),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [final]);

  const barStyle = useAnimatedStyle(() => ({ width: `${barWidth.value}%` }));
  const glowStyle = useAnimatedStyle(() => ({
    shadowColor: '#00FF41',
    shadowOpacity: barGlow.value * 0.8,
    shadowRadius: 6,
    elevation: barGlow.value > 0 ? 4 : 0,
  }));

  return (
    <View className="flex-row items-center mb-2">
      <Text className="text-primary font-robotomono text-xs w-10 font-bold">{label}</Text>
      <View className="flex-1 h-4 bg-muted/40 border border-primary/30 mx-2 rounded-sm overflow-hidden">
        <Animated.View className="h-full bg-primary/50 rounded-sm" style={[barStyle, glowStyle]} />
      </View>
      <Text className="text-primary font-robotomono text-sm w-7 text-right font-bold">{final}</Text>
      {bonus > 0 && (
        <Text style={S.bonusText} className="font-robotomono text-[9px] w-6 text-right">
          +{bonus}
        </Text>
      )}
      <Text className="text-secondary font-robotomono text-xs w-7 text-right">{modStr}</Text>
    </View>
  );
});
