import React, { memo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useI18n } from '../i18n';
import type { BountyRecord } from '../services/bountyService';

const LEVEL_COLORS: Record<number, string> = {
  0: '#6b7280',
  1: '#22c55e',
  2: '#eab308',
  3: '#f97316',
  4: '#ef4444',
  5: '#a855f7',
};

type Props = {
  bounties: BountyRecord[];
  seedHash: string;
  onPress?: (bounty: BountyRecord) => void;
};

export const BountyBoard = memo(({ bounties, onPress }: Props) => {
  const { lang } = useI18n();
  const active = bounties.filter(b => b.isActive);

  if (active.length === 0) {
    return (
      <View className="border border-primary/20 rounded p-4 items-center">
        <Text className="text-primary/40 font-robotomono text-sm">
          {lang === 'es' ? 'No hay recompensas activas' : 'No active bounties'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView>
      {active.map(bounty => {
        const color = LEVEL_COLORS[bounty.bountyLevel] ?? LEVEL_COLORS[0];
        return (
          <TouchableOpacity
            key={bounty.id}
            className="border rounded p-3 mb-2"
            style={{ borderColor: `${color}66` }}
            onPress={() => onPress?.(bounty)}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center gap-2">
                <View className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <Text className="font-robotomono text-xs uppercase tracking-widest" style={{ color }}>
                  {lang === 'es' ? `NIVEL ${bounty.bountyLevel}` : `LEVEL ${bounty.bountyLevel}`}
                </Text>
              </View>
              <Text className="text-primary font-robotomono text-sm font-bold">
                {bounty.rewardAmount}G
              </Text>
            </View>
            <Text className="text-primary/60 font-robotomono text-xs">
              {lang === 'es' ? `Bajas: ${bounty.killCount}` : `Kills: ${bounty.killCount}`}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});
