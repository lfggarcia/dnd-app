import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import type { ScreenProps } from '../navigation/types';

type LogEntry = {
  cycle: number;
  phase: 'DAY' | 'NIGHT';
  event: string;
  type: 'BOSS_KILLED' | 'PARTY_ELIMINATED' | 'ALLIANCE_FORMED' | 'BOUNTY_ISSUED' | 'FLOOR_CLEARED' | 'COMBAT';
};

const TYPE_COLORS: Record<string, string> = {
  BOSS_KILLED: 'text-secondary',
  PARTY_ELIMINATED: 'text-destructive',
  ALLIANCE_FORMED: 'text-accent',
  BOUNTY_ISSUED: 'text-destructive',
  FLOOR_CLEARED: 'text-primary',
  COMBAT: 'text-primary/70',
};

const TYPE_ICONS: Record<string, string> = {
  BOSS_KILLED: '☠',
  PARTY_ELIMINATED: '✕',
  ALLIANCE_FORMED: '⚖',
  BOUNTY_ISSUED: '⚠',
  FLOOR_CLEARED: '▲',
  COMBAT: '⚔',
};

const WORLD_LOG: LogEntry[] = [
  { cycle: 1, phase: 'DAY', event: 'TOWER OPENS — SEASON BEGINS · 10 PARTIES ENTER', type: 'FLOOR_CLEARED' },
  { cycle: 1, phase: 'DAY', event: 'IRON_WOLVES clear FLOOR_01 first', type: 'FLOOR_CLEARED' },
  { cycle: 1, phase: 'DAY', event: 'YOUR_PARTY defeats SKELETON_KNIGHT patrol on FLOOR_01', type: 'COMBAT' },
  { cycle: 1, phase: 'DAY', event: 'LAST_LIGHT eliminated on FLOOR_03 by ABERRATION_SWARM', type: 'PARTY_ELIMINATED' },
  { cycle: 1, phase: 'NIGHT', event: 'SHADOW_PACT and CRIMSON_OATH form ALLIANCE (500G/cycle)', type: 'ALLIANCE_FORMED' },
  { cycle: 2, phase: 'DAY', event: 'IRON_WOLVES defeat FLOOR_02 BOSS: BONE_COLOSSUS', type: 'BOSS_KILLED' },
  { cycle: 2, phase: 'DAY', event: 'BOUNTY issued on DEAD_RECKONING (3 party attacks)', type: 'BOUNTY_ISSUED' },
  { cycle: 2, phase: 'NIGHT', event: 'CRIMSON_OATH reaches FLOOR_04', type: 'FLOOR_CLEARED' },
];

export const WorldLogScreen = ({ navigation }: ScreenProps<'WorldLog'>) => {
  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />

      {/* Header */}
      <View className="p-3 border-b border-primary/40 flex-row justify-between items-center">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-primary font-robotomono text-xs">{'<'} BACK</Text>
        </TouchableOpacity>
        <Text className="text-primary font-robotomono text-xs font-bold">WORLD_LOG</Text>
        <Text className="text-primary/40 font-robotomono text-[9px]">CYCLE: 02/60</Text>
      </View>

      {/* Legend */}
      <View className="flex-row px-4 py-2 border-b border-primary/10 bg-muted/10">
        {Object.entries(TYPE_ICONS).map(([type, icon]) => (
          <View key={type} className="flex-row items-center mr-3">
            <Text className="text-xs mr-1">{icon}</Text>
            <Text className={`font-robotomono text-[6px] ${TYPE_COLORS[type]}`}>{type}</Text>
          </View>
        ))}
      </View>

      {/* Log Entries */}
      <ScrollView className="flex-1 px-4 py-2" showsVerticalScrollIndicator={false}>
        {WORLD_LOG.map((entry, i) => {
          const prevEntry = WORLD_LOG[i - 1];
          const showCycleHeader = !prevEntry || prevEntry.cycle !== entry.cycle || prevEntry.phase !== entry.phase;

          return (
            <View key={i}>
              {showCycleHeader && (
                <View className="flex-row items-center mt-3 mb-1">
                  <View className="flex-1 h-[1px] bg-primary/20" />
                  <Text className="text-secondary font-robotomono text-[8px] mx-3 font-bold">
                    {entry.phase === 'DAY' ? '☀' : '☽'} CYCLE_{String(entry.cycle).padStart(2, '0')} — {entry.phase}
                  </Text>
                  <View className="flex-1 h-[1px] bg-primary/20" />
                </View>
              )}
              <View className="flex-row py-2 border-b border-primary/5">
                <Text className="text-base mr-2">{TYPE_ICONS[entry.type]}</Text>
                <Text className={`flex-1 font-robotomono text-[9px] ${TYPE_COLORS[entry.type]}`}>
                  {entry.event}
                </Text>
              </View>
            </View>
          );
        })}
        <View className="h-8" />
      </ScrollView>

      {/* Footer */}
      <View className="p-3 border-t border-primary/20 bg-muted/10">
        <Text className="text-primary/30 font-robotomono text-[7px] text-center">
          THE GUILD RECORDS ONLY WHAT IS REPORTED · INFORMATION MAY BE INCOMPLETE
        </Text>
      </View>
    </View>
  );
};
