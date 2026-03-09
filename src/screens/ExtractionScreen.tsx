import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, BackHandler } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { GlossaryButton } from '../components/GlossaryModal';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import type { ScreenProps } from '../navigation/types';

const LOOT_ITEMS = [
  { name: 'IRON_LONGSWORD', rarity: 'COMMON', type: 'WEAPON', qty: 1 },
  { name: 'SHADOW_ESSENCE', rarity: 'UNCOMMON', type: 'MATERIAL', qty: 2 },
  { name: 'BONE_FRAGMENT', rarity: 'COMMON', type: 'MATERIAL', qty: 5 },
  { name: 'WIGHT_DUST', rarity: 'UNCOMMON', type: 'MATERIAL', qty: 1 },
];

const LOOT_TOTAL_QTY = LOOT_ITEMS.reduce((acc, i) => acc + i.qty, 0);
const LOOT_MATERIAL_QTY = LOOT_ITEMS.filter(i => i.type === 'MATERIAL').reduce((acc, i) => acc + i.qty, 0);

const RARITY_COLORS: Record<string, string> = {
  COMMON: 'text-primary/60',
  UNCOMMON: 'text-accent',
  RARE: 'text-secondary',
  LEGENDARY: 'text-destructive',
};

export const ExtractionScreen = ({ navigation }: ScreenProps<'Extraction'>) => {
  const { t } = useI18n();
  const cycle = useGameStore(s => s.activeGame?.cycle ?? 0);
  const updateProgress = useGameStore(s => s.updateProgress);

  const [gold, setGold] = useState(0);
  const [phase, setPhase] = useState<'counting' | 'done'>('counting');

  const canReturnToVillage = cycle >= 60;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.navigate('Map');
      return true;
    });
    return () => sub.remove();
  }, [navigation]);
  const targetGold = 120;

  const handleReturnToVillage = useCallback(() => {
    updateProgress({ location: 'village' });
    navigation.reset({ index: 0, routes: [{ name: 'Village' }] });
  }, [updateProgress, navigation]);

  useEffect(() => {
    let current = 0;
    const step = Math.ceil(targetGold / 40);
    const interval = setInterval(() => {
      current += step;
      if (current >= targetGold) {
        setGold(targetGold);
        setPhase('done');
        clearInterval(interval);
      } else {
        setGold(current);
      }
    }, 30);
    return () => clearInterval(interval);
  }, []);

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />


      {/* Header */}
      <View className="p-4 border-b border-primary/30">
        <Text className="text-primary font-robotomono text-sm text-center font-bold">
          {t('extraction.title')}
        </Text>
      </View>

      <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
        {/* Gold Counter */}
        <View className="border-2 border-primary p-6 bg-muted/20 items-center mb-6">
          <Text className="text-primary/50 font-robotomono text-xs mb-2">{t('extraction.goldExtracted')}</Text>
          <Text className="text-primary font-robotomono text-5xl font-bold">{gold}G</Text>
          <Text className="text-primary/30 font-robotomono text-[9px] mt-1">
            {phase === 'counting' ? t('extraction.counting') : t('extraction.transferComplete')}
          </Text>
        </View>

        {/* Loot Inventory */}
        <View className="border border-primary/30 p-4 bg-muted/10 mb-6">
          <Text className="text-primary font-robotomono text-xs mb-3 font-bold">{t('extraction.itemsAcquired')}</Text>
          {LOOT_ITEMS.map((item, i) => (
            <View key={i} className="flex-row justify-between items-center py-2 border-b border-primary/10">
              <View className="flex-row items-center flex-1">
                <View className={`w-2 h-2 mr-2 ${
                  item.rarity === 'UNCOMMON' ? 'bg-accent' :
                  item.rarity === 'RARE' ? 'bg-secondary' : 'bg-primary/40'
                }`} />
                <View>
                  <Text className={`font-robotomono text-[10px] font-bold ${RARITY_COLORS[item.rarity]}`}>
                    {item.name}
                  </Text>
                  <Text className="text-primary/30 font-robotomono text-[7px]">
                    {item.type} · {item.rarity}
                  </Text>
                </View>
              </View>
              <Text className="text-primary font-robotomono text-[10px]">x{item.qty}</Text>
            </View>
          ))}
        </View>

        {/* Summary Stats */}
        <View className="flex-row mb-6">
          <View className="flex-1 mr-2 border border-primary/20 p-3 bg-primary/5 items-center">
            <Text className="text-primary/40 font-robotomono text-[8px]">{t('extraction.items')}</Text>
            <Text className="text-primary font-robotomono text-lg font-bold">
              {LOOT_TOTAL_QTY}
            </Text>
          </View>
          <View className="flex-1 mx-1 border border-primary/20 p-3 bg-primary/5 items-center">
            <Text className="text-primary/40 font-robotomono text-[8px]">{t('extraction.materials')}</Text>
            <Text className="text-primary font-robotomono text-lg font-bold">
              {LOOT_MATERIAL_QTY}
            </Text>
          </View>
          <View className="flex-1 ml-2 border border-secondary/20 p-3 bg-secondary/5 items-center">
            <Text className="text-secondary/40 font-robotomono text-[8px]">{t('common.gold')}</Text>
            <Text className="text-secondary font-robotomono text-lg font-bold">{targetGold}G</Text>
          </View>
        </View>

      </ScrollView>

      {/* Action Buttons */}
      <View className="p-4 border-t border-primary/30 bg-background">
        <TouchableOpacity
          onPress={() => navigation.navigate('Map')}
          className="bg-primary p-3 items-center mb-2"
        >
          <Text className="text-background font-bold font-robotomono text-base">{t('extraction.continueExploring')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={canReturnToVillage ? handleReturnToVillage : undefined}
          disabled={!canReturnToVillage}
          className={`p-3 items-center ${canReturnToVillage ? 'border border-accent' : 'border border-primary/20'}`}
          style={canReturnToVillage ? {} : { opacity: 0.35 }}
        >
          <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 12, color: canReturnToVillage ? '#00E5FF' : '#00FF41' }}>
            {t('extraction.returnVillage')}
          </Text>
          {!canReturnToVillage && (
            <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 9, color: 'rgba(0,255,65,0.6)', marginTop: 3 }}>
              {t('extraction.lockedNotice')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <GlossaryButton />
    </View>
  );
};
