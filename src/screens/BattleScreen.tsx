import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, BackHandler } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { GlossaryButton } from '../components/GlossaryModal';
import { useI18n } from '../i18n';
import type { ScreenProps } from '../navigation/types';

export const BattleScreen = ({ navigation }: ScreenProps<'Battle'>) => {
  const { t } = useI18n();

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.navigate('Report');
      return true;
    });
    return () => sub.remove();
  }, [navigation]);

  const LOG_ENTRIES = [
    `INITIATIVE: PARTY (18) vs ENEMY (12)`,
    `d20(15) + STR(4) VS ${t('battle.ac')}(14) = ✓`,
    `DMG: 8 (PHYSICAL)`,
    `> ${t('battle.turn')}: SQUAD_VULCAN`,
  ];

  return (
    <View className="flex-1 bg-background p-4">
      <CRTOverlay />


      {/* Enemies Area (Top) */}
      <View className="h-1/3 flex-row items-center justify-around">
        <View className="items-center">
          <View className="w-16 h-24 border border-secondary bg-secondary/10 items-center justify-center">
            <Text className="text-secondary font-robotomono text-[10px]">LICH_V1</Text>
          </View>
          <View className="w-16 h-1 bg-secondary mt-1" />
        </View>
        <View className="items-center">
          <View className="w-16 h-24 border border-secondary bg-secondary/10 items-center justify-center">
            <Text className="text-secondary font-robotomono text-[10px]">SKELETON</Text>
          </View>
          <View className="w-16 h-1 bg-secondary mt-1" />
        </View>
      </View>

      {/* Battlefield Midground */}
      <View className="flex-1 border-y border-primary/20 items-center justify-center">
        <Text className="text-primary/10 font-robotomono text-6xl">{t('battle.title')}</Text>
      </View>

      {/* Player Area (Bottom) */}
      <View className="h-1/4 flex-row items-end justify-around pb-4">
        {[1, 2, 3, 4, 5].map(i => (
          <View key={i} className="items-center">
            <View className={`w-12 h-16 border ${i === 1 ? 'border-primary bg-primary/20 shadow-lg' : 'border-primary/40'}`} />
            <View className="w-12 h-1 bg-primary mt-1" />
            {i === 1 && (
              <Text className="text-primary font-bold text-[8px] mt-1 font-robotomono">{t('battle.selectTarget')}</Text>
            )}
          </View>
        ))}
      </View>

      {/* Combat Log Box */}
      <View className="h-32 border-2 border-primary bg-muted p-2">
        <ScrollView>
          {LOG_ENTRIES.map((entry, idx) => (
            <Text key={idx} className="text-primary font-robotomono text-[10px] mb-1">
              {idx === LOG_ENTRIES.length - 1 ? '> ' : ''}{entry}
            </Text>
          ))}
        </ScrollView>
        <View className="absolute bottom-2 right-2 px-2 py-1 bg-primary">
          <Text className="text-background font-bold text-[10px] font-robotomono">{t('battle.waitingAction')}</Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => navigation.navigate('Report')}
        className="absolute top-4 right-4 bg-secondary p-2"
      >
        <Text className="text-background font-bold text-[10px] font-robotomono">{t('battle.forceEnd')}</Text>
      </TouchableOpacity>

      <GlossaryButton />
    </View>
  );
};
