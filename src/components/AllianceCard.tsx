import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useI18n } from '../i18n';
import type { Alliance } from '../services/allianceService';

type Props = {
  alliance: Alliance;
  currentCycle: number;
  onBreak: () => void;
};

export const AllianceCard = memo(({ alliance, currentCycle, onBreak }: Props) => {
  const { lang } = useI18n();
  const cyclesLeft = Math.max(0, alliance.expiresAtCycle - currentCycle);
  const isExpiring = cyclesLeft <= 3;

  return (
    <View
      className="border rounded p-4 mb-3"
      style={{ borderColor: isExpiring ? '#f97316aa' : '#10b98166' }}
    >
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-primary font-robotomono font-bold">
          {alliance.partyB}
        </Text>
        <View
          className="px-2 py-0.5 rounded"
          style={{ backgroundColor: isExpiring ? '#f9731633' : '#10b98133' }}
        >
          <Text
            className="font-robotomono text-xs"
            style={{ color: isExpiring ? '#f97316' : '#10b981' }}
          >
            {alliance.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between mb-3">
        <View>
          <Text className="text-primary/40 font-robotomono text-xs">
            {lang === 'es' ? 'Ciclos restantes' : 'Cycles left'}
          </Text>
          <Text
            className="font-robotomono text-sm"
            style={{ color: isExpiring ? '#f97316' : '#10b981' }}
          >
            {cyclesLeft}
          </Text>
        </View>
        <View>
          <Text className="text-primary/40 font-robotomono text-xs">
            {lang === 'es' ? 'Tarifa/ciclo' : 'Fee/cycle'}
          </Text>
          <Text className="text-primary font-robotomono text-sm">
            {alliance.protectionFee}G
          </Text>
        </View>
      </View>

      <TouchableOpacity
        className="border border-red-800/60 rounded p-2 items-center"
        onPress={onBreak}
        activeOpacity={0.7}
      >
        <Text className="text-red-400 font-robotomono text-xs">
          {lang === 'es' ? '✕ Romper alianza' : '✕ Break alliance'}
        </Text>
      </TouchableOpacity>
    </View>
  );
});
