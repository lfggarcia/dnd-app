import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { SliderButton } from '../components/SliderButton';
import type { ScreenProps } from '../navigation/types';

const BUILDINGS = [
  { id: 'guild', name: 'GUILD', icon: '⚔', desc: 'RANKINGS · BOUNTIES · WORLD_LOG · RECRUIT', color: 'secondary' },
  { id: 'market', name: 'MARKET', icon: '◈', desc: 'BUY · SELL · TRADE_ITEMS', color: 'secondary' },
  { id: 'blacksmith', name: 'BLACKSMITH', icon: '⚒', desc: 'FORGE · UPGRADE · REPAIR_GEAR', color: 'secondary' },
  { id: 'armory', name: 'ARMORY', icon: '🛡', desc: 'WEAPONS · ARMOR · EQUIPMENT', color: 'secondary' },
  { id: 'inn', name: 'INN', icon: '☽', desc: 'REST · RECOVER_HP · COSTS_1_CYCLE', color: 'secondary' },
  { id: 'church', name: 'CHURCH', icon: '✟', desc: 'REVIVE_MEMBERS · CURE_STATUS', color: 'secondary' },
] as const;

const RIVAL_PARTIES = [
  { name: 'IRON_WOLVES', floor: 8, status: 'ACTIVE', rep: 92 },
  { name: 'SHADOW_PACT', floor: 6, status: 'ACTIVE', rep: 78 },
  { name: 'CRIMSON_OATH', floor: 5, status: 'ACTIVE', rep: 71 },
  { name: 'DEAD_RECKONING', floor: 4, status: 'ACTIVE', rep: 65 },
  { name: 'LAST_LIGHT', floor: 3, status: 'WOUNDED', rep: 45 },
];

export const VillageScreen = ({ navigation }: ScreenProps<'Village'>) => {
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const building = BUILDINGS.find(b => b.id === selectedBuilding);

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />

      {/* Header Bar */}
      <View className="p-3 border-b border-secondary/40 flex-row justify-between items-center">
        <View>
          <Text className="text-secondary font-robotomono text-[10px]">
            {'>'} SAFE_ZONE: VILLAGE_HUB
          </Text>
        </View>
        <View className="flex-row items-center">
          <Text className="text-secondary font-robotomono text-[10px] mr-4">
            GOLD: 2,400G
          </Text>
          <Text className="text-primary font-robotomono text-[10px]">
            CYCLE: 01/60
          </Text>
        </View>
      </View>

      {/* Day/Night Indicator */}
      <View className="flex-row items-center px-4 py-1 bg-primary/5">
        <View className="w-2 h-2 bg-secondary rounded-full mr-2" />
        <Text className="text-secondary font-robotomono text-[8px]">DAY_PHASE</Text>
        <Text className="text-primary/40 font-robotomono text-[8px] ml-auto">FLOOR: 01 · NO_COMBAT_ZONE</Text>
      </View>

      <View className="flex-1 flex-row">
        {/* Buildings Grid */}
        <View className="flex-1 p-3">
          <Text className="text-secondary font-robotomono text-[9px] mb-3">VILLAGE_BUILDINGS:</Text>
          <View className="flex-row flex-wrap">
            {BUILDINGS.map(b => {
              const isSelected = selectedBuilding === b.id;
              return (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => setSelectedBuilding(isSelected ? null : b.id)}
                  className={`w-[48%] mr-[2%] mb-2 border p-3 ${
                    isSelected
                      ? 'border-secondary bg-secondary/15'
                      : 'border-secondary/25 bg-muted/15'
                  }`}
                >
                  <View className="flex-row items-center mb-1">
                    <Text className="text-lg mr-2">{b.icon}</Text>
                    <Text className={`font-robotomono text-xs font-bold ${
                      isSelected ? 'text-secondary' : 'text-secondary/70'
                    }`}>
                      {b.name}
                    </Text>
                  </View>
                  <Text className="text-secondary/40 font-robotomono text-[7px]">{b.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Building Detail Panel */}
          {building && (
            <View className="mt-2 border border-secondary/40 p-3 bg-muted/20 flex-1">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-secondary font-robotomono font-bold text-sm">
                  [{building.name}]
                </Text>
                <TouchableOpacity onPress={() => setSelectedBuilding(null)}>
                  <Text className="text-secondary/60 font-robotomono text-[10px]">CLOSE [X]</Text>
                </TouchableOpacity>
              </View>
              <View className="border border-secondary/20 p-3 bg-muted/30 flex-1">
                <Text className="text-secondary font-robotomono text-[9px] mb-2">
                  MODULES_ONLINE:
                </Text>
                {building.id === 'guild' && (
                  <View>
                    <TouchableOpacity className="border border-secondary/20 p-2 mb-1 bg-secondary/5"
                      onPress={() => navigation.navigate('WorldLog')}>
                      <Text className="text-secondary font-robotomono text-[9px]">{'>'} VIEW_WORLD_LOG</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="border border-secondary/20 p-2 mb-1 bg-secondary/5">
                      <Text className="text-secondary font-robotomono text-[9px]">{'>'} VIEW_RANKINGS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="border border-secondary/20 p-2 mb-1 bg-secondary/5">
                      <Text className="text-secondary font-robotomono text-[9px]">{'>'} BOUNTY_BOARD</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="border border-secondary/20 p-2 mb-1 bg-secondary/5">
                      <Text className="text-secondary font-robotomono text-[9px]">{'>'} RECRUIT_MEMBER</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {building.id === 'inn' && (
                  <View>
                    <TouchableOpacity className="border border-secondary/20 p-2 mb-1 bg-secondary/5">
                      <Text className="text-secondary font-robotomono text-[9px]">{'>'} SHORT_REST (HEAL 50% · 0 CYCLES)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="border border-secondary/20 p-2 mb-1 bg-secondary/5">
                      <Text className="text-secondary font-robotomono text-[9px]">{'>'} LONG_REST (HEAL 100% · 1 CYCLE)</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {building.id === 'church' && (
                  <View>
                    <TouchableOpacity className="border border-secondary/20 p-2 mb-1 bg-secondary/5">
                      <Text className="text-secondary font-robotomono text-[9px]">{'>'} REVIVE_MEMBER (COST: VARIES)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="border border-secondary/20 p-2 mb-1 bg-secondary/5">
                      <Text className="text-secondary font-robotomono text-[9px]">{'>'} CURE_STATUS (50G)</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {!['guild', 'inn', 'church'].includes(building.id) && (
                  <Text className="text-secondary/40 font-robotomono text-[8px] italic">
                    INVENTORY_SYSTEM — PENDING_IMPLEMENTATION
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Right Panel: Rivalry Monitor + Launch */}
        <View className="w-[35%] border-l border-secondary/20 p-3">
          <Text className="text-secondary font-robotomono text-[9px] mb-2">RIVALRY_MONITOR:</Text>
          <ScrollView className="flex-1">
            {RIVAL_PARTIES.map((p, i) => (
              <View
                key={p.name}
                className="mb-1 p-2 border border-secondary/15 bg-muted/10 flex-row justify-between items-center"
              >
                <View className="flex-1">
                  <Text className="text-secondary font-robotomono text-[8px] font-bold">
                    {String(i + 1).padStart(2, '0')}. {p.name}
                  </Text>
                  <Text className="text-secondary/40 font-robotomono text-[7px]">
                    FLOOR {p.floor} · {p.status}
                  </Text>
                </View>
                <Text className="text-secondary font-robotomono text-[9px]">{p.rep}%</Text>
              </View>
            ))}
          </ScrollView>

          {/* Party Status Mini */}
          <View className="mt-3 border border-primary/30 p-2 bg-primary/5 mb-3">
            <Text className="text-primary font-robotomono text-[8px] mb-1">YOUR_PARTY:</Text>
            <Text className="text-primary font-robotomono text-[9px] font-bold">HP: 100% · MEMBERS: 4/4</Text>
            <Text className="text-primary/50 font-robotomono text-[7px]">FLOOR: 01 · READY</Text>
          </View>

          <SliderButton
            label="ENTER_TOWER"
            onConfirm={() => navigation.navigate('Map')}
            width={140}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    backgroundColor: 'rgba(255, 176, 0, 0.05)',
  },
});
