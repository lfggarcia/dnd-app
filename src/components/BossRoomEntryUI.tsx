import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useI18n } from '../i18n';
import type { CharacterSave } from '../database/gameRepository';

type Props = {
  bossLabel: string;
  floor: number;
  party: CharacterSave[];
  onEnter: () => void;
  onCancel: () => void;
};

export const BossRoomEntryUI = ({ bossLabel, floor, party, onEnter, onCancel }: Props) => {
  const { lang } = useI18n();
  const alive = party.filter(c => c.alive && c.hp > 0);
  const avgHpPct = alive.length > 0
    ? Math.round(alive.reduce((sum, c) => sum + (c.hp / (c.maxHp ?? 1)), 0) / alive.length * 100)
    : 0;

  return (
    <View className="bg-black/95 border border-red-800/60 rounded p-5">
      {/* Boss name */}
      <Text className="text-red-400 font-robotomono text-xl font-bold text-center mb-1 tracking-widest">
        ⚠ {bossLabel}
      </Text>
      <Text className="text-primary/40 font-robotomono text-xs text-center mb-4">
        {lang === 'es' ? `PISO ${floor} — JEFE` : `FLOOR ${floor} — BOSS`}
      </Text>

      {/* Party status */}
      <View className="border border-primary/20 rounded p-3 mb-4">
        <Text className="text-primary/60 font-robotomono text-xs mb-2 uppercase">
          {lang === 'es' ? 'Estado del grupo' : 'Party state'}
        </Text>
        {alive.map(c => {
          const hpPct = Math.round(c.hp / (c.maxHp ?? 1) * 100);
          const color = hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#eab308' : '#ef4444';
          return (
            <View key={c.name} className="flex-row items-center justify-between mb-1">
              <Text className="text-primary font-robotomono text-xs">{c.name}</Text>
              <View className="flex-row items-center gap-2">
                <View className="w-16 h-1.5 bg-primary/10 rounded-full overflow-hidden">
                  <View className="h-full rounded-full" style={{ width: `${hpPct}%`, backgroundColor: color }} />
                </View>
                <Text className="font-robotomono text-xs" style={{ color }}>{hpPct}%</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Warning for low HP */}
      {avgHpPct < 50 && (
        <View className="border border-yellow-600/40 bg-yellow-900/10 rounded p-2 mb-3">
          <Text className="text-yellow-400 font-robotomono text-xs text-center">
            {lang === 'es'
              ? `⚠ El grupo está al ${avgHpPct}% de vida — se recomienda descansar antes`
              : `⚠ Party at ${avgHpPct}% HP — resting first is advised`}
          </Text>
        </View>
      )}

      {/* Buttons */}
      <TouchableOpacity
        className="bg-red-900/40 border border-red-600/60 rounded p-4 items-center mb-2"
        onPress={onEnter}
        activeOpacity={0.7}
      >
        <Text className="text-red-300 font-robotomono font-bold tracking-widest">
          {lang === 'es' ? '⚔ ENTRAR AL COMBATE' : '⚔ ENTER COMBAT'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        className="border border-primary/20 rounded p-3 items-center"
        onPress={onCancel}
        activeOpacity={0.7}
      >
        <Text className="text-primary/60 font-robotomono text-sm">
          {lang === 'es' ? '← Cancelar' : '← Cancel'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
