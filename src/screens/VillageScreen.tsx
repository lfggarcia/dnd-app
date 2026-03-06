import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { GlossaryButton } from '../components/GlossaryModal';
import { GuildIcon, DiamondIcon, HammerIcon, ShieldIcon, MoonIcon, CrossIcon } from '../components/Icons';
import { useGameStore } from '../stores/gameStore';
import { useI18n } from '../i18n';
import type { ScreenProps } from '../navigation/types';

const BUILDING_KEYS = ['guild', 'market', 'blacksmith', 'armory', 'inn', 'church'] as const;
const BUILDING_ICON_COMPONENTS: Record<string, React.FC<{ size?: number; color?: string }>> = {
  guild: GuildIcon,
  market: DiamondIcon,
  blacksmith: HammerIcon,
  armory: ShieldIcon,
  inn: MoonIcon,
  church: CrossIcon,
};

// ─── Rival generation from seedHash ───────────────────────
const RIVAL_NAMES = [
  'IRON_WOLVES', 'SHADOW_PACT', 'CRIMSON_OATH', 'DEAD_RECKONING', 'LAST_LIGHT',
  'BLOOD_FANGS', 'NIGHT_REAPERS', 'STORM_GUARD', 'BONE_LEGION', 'VOID_WALKERS',
];

function generateRivals(seedHash: string, playerFloor: number) {
  // Simple deterministic pick from seedHash
  const hashNum = seedHash.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const picked: string[] = [];
  for (let i = 0; i < 5; i++) {
    const idx = (hashNum + i * 7) % RIVAL_NAMES.length;
    const name = RIVAL_NAMES[idx];
    if (!picked.includes(name)) picked.push(name);
    else picked.push(RIVAL_NAMES[(idx + 3) % RIVAL_NAMES.length]);
  }
  return picked.map((name, i) => {
    // Rivals scale loosely around player progress
    const baseFloor = Math.max(1, playerFloor + 2 - i + ((hashNum + i) % 3));
    const rep = Math.min(99, Math.max(10, 90 - i * 12 + ((hashNum + i) % 10)));
    const defeated = i === 4 && playerFloor > 1; // last rival defeated after floor 1
    return { name, floor: baseFloor, status: defeated ? 'defeated' as const : 'active' as const, rep };
  });
}

const BUILDING_NAV: Partial<Record<string, keyof import('../navigation/types').RootStackParamList>> = {
  guild: 'Guild',
};

export const VillageScreen = ({ navigation }: ScreenProps<'Village'>) => {
  const { t } = useI18n();
  const activeGame = useGameStore(s => s.activeGame);

  const gold = activeGame?.gold ?? 0;
  const cycle = activeGame?.cycle ?? 1;
  const maxFloor = activeGame?.floor ?? 1;

  const rivals = useMemo(
    () => generateRivals(activeGame?.seedHash ?? '0', maxFloor),
    [activeGame?.seedHash, maxFloor],
  );

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />


      {/* Header */}
      <View className="p-4 border-b border-primary/30">
        <Text className="text-primary font-robotomono text-sm text-center font-bold">
          {t('village.title')}
        </Text>
        <View className="flex-row justify-between mt-2">
          <Text className="text-secondary font-robotomono text-[10px]">{t('common.gold')}: {gold}G</Text>
          <Text className="text-primary/50 font-robotomono text-[10px]">{t('common.cycle')}: {cycle}</Text>
          <Text className="text-accent font-robotomono text-[10px]">{t('village.maxFloor')}: {maxFloor}</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        {/* Village Description */}
        <View className="border border-primary/20 p-3 bg-primary/5 mb-4">
          <Text className="text-primary/60 font-robotomono text-[10px] leading-4">
            {t('village.description')}
          </Text>
        </View>

        {/* Buildings Section */}
        <Text className="text-primary font-robotomono text-xs font-bold mb-3">{t('village.buildings')}</Text>

        {BUILDING_KEYS.map((key) => (
          <TouchableOpacity
            key={key}
            className="border border-primary/30 p-3 bg-muted/10 mb-2 flex-row items-center"
            onPress={() => {
              const screen = BUILDING_NAV[key];
              if (screen) navigation.navigate(screen as any);
            }}
          >
            <View className="mr-3">
              {React.createElement(BUILDING_ICON_COMPONENTS[key], { size: 20 })}
            </View>
            <View className="flex-1">
              <Text className="text-primary font-robotomono text-[11px] font-bold">
                {t(`village.${key}`)}
              </Text>
              <Text className="text-primary/40 font-robotomono text-[9px] mt-0.5">
                {t(`village.${key}Desc`)}
              </Text>
            </View>
            <Text className="text-primary/30 font-robotomono text-xs">{'>'}</Text>
          </TouchableOpacity>
        ))}

        {/* Rivalry Monitor */}
        <Text className="text-primary font-robotomono text-xs font-bold mt-6 mb-3">{t('village.rivalryMonitor')}</Text>

        <View className="border border-primary/20 p-3 bg-muted/5 mb-4">
          {rivals.map((rival, i) => (
            <View key={i} className="flex-row items-center py-2 border-b border-primary/10">
              <Text className="text-primary/40 font-robotomono text-[9px] w-5">{i + 1}.</Text>
              <View className="flex-1">
                <Text className={`font-robotomono text-[10px] font-bold ${rival.status === 'defeated' ? 'text-primary/30 line-through' : 'text-primary'}`}>
                  {rival.name}
                </Text>
              </View>
              <Text className="text-accent font-robotomono text-[9px] mr-3">{t('village.floor')} {rival.floor}</Text>
              <View className="w-12">
                <View className="h-1 bg-primary/10">
                  <View className="h-1 bg-primary" style={{ width: `${rival.rep}%` }} />
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Spacer for bottom button */}
        <View className="h-24" />
      </ScrollView>

      {/* Enter Tower Button - Fixed at bottom */}
      <View className="p-4 border-t border-primary/30 bg-background">
        <TouchableOpacity
          onPress={() => navigation.navigate('Map')}
          className="bg-primary p-4 items-center"
          activeOpacity={0.7}
        >
          <Text className="text-background font-bold font-robotomono text-lg">⚔ {t('village.enterTower')}</Text>
          <Text className="text-background/60 font-robotomono text-[10px] mt-1">{t('village.enterTowerDesc')}</Text>
        </TouchableOpacity>
      </View>

      <GlossaryButton bottomOffset={120} />
    </View>
  );
};
