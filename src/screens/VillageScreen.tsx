import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { GlossaryButton } from '../components/GlossaryModal';
import { useI18n } from '../i18n';
import type { ScreenProps } from '../navigation/types';

const BUILDING_KEYS = ['guild', 'market', 'blacksmith', 'armory', 'inn', 'church'] as const;
const BUILDING_ICONS: Record<string, string> = {
  guild: '⚔', market: '◈', blacksmith: '⚒', armory: '🛡', inn: '☽', church: '✟',
};

const RIVAL_PARTIES = [
  { name: 'IRON_WOLVES', floor: 8, status: 'active', rep: 92 },
  { name: 'SHADOW_PACT', floor: 6, status: 'active', rep: 78 },
  { name: 'CRIMSON_OATH', floor: 5, status: 'active', rep: 71 },
  { name: 'DEAD_RECKONING', floor: 4, status: 'active', rep: 65 },
  { name: 'LAST_LIGHT', floor: 3, status: 'defeated', rep: 45 },
];

export const VillageScreen = ({ navigation }: ScreenProps<'Village'>) => {
  const { t } = useI18n();

  const [gold] = useState(340);
  const [cycle] = useState(3);
  const [maxFloor] = useState(5);

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
          >
            <Text className="text-xl mr-3">{BUILDING_ICONS[key]}</Text>
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
          {RIVAL_PARTIES.map((rival, i) => (
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

      <GlossaryButton />
    </View>
  );
};
