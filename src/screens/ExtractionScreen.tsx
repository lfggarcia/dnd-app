import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, BackHandler, StyleSheet } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { GlossaryButton } from '../components/GlossaryModal';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import { getRecentItems } from '../database/itemRepository';
import type { ScreenProps } from '../navigation/types';

const RARITY_COLORS: Record<string, string> = {
  COMMON: 'text-primary/60',
  UNCOMMON: 'text-accent',
  RARE: 'text-secondary',
  LEGENDARY: 'text-destructive',
};

export const ExtractionScreen = ({ navigation, route }: ScreenProps<'Extraction'>) => {
  const { t } = useI18n();
  const cycle          = useGameStore(s => s.activeGame?.cycle ?? 0);
  const realGold       = useGameStore(s => s.activeGame?.gold ?? 0);
  const activeGameId   = useGameStore(s => s.activeGame?.id ?? null);
  const updateProgress = useGameStore(s => s.updateProgress);
  const advanceToVillage = useGameStore(s => s.advanceToVillage);

  const fromDefeat = route.params?.fromDefeat ?? false;

  const [displayedGold, setDisplayedGold] = useState(0);
  const [phase, setPhase] = useState<'counting' | 'done'>('counting');
  const [items, setItems] = useState<{ name: string; rarity: string; type: string; qty: number }[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!fromDefeat) navigation.navigate('Map');
      return true;
    });
    return () => sub.remove();
  }, [navigation, fromDefeat]);

  // Load real items from itemRepository (session items only)
  useEffect(() => {
    if (!activeGameId) return;
    try {
      const sessionItems = getRecentItems(activeGameId, cycle - 1);
      setItems(sessionItems.map(item => ({
        name: item.name,
        rarity: item.rarity.toUpperCase(),
        type: item.type.toUpperCase(),
        qty: 1,
      })));
    } catch { setItems([]); }
  }, [activeGameId, cycle]);

  // Animate gold counter from 0 to realGold
  useEffect(() => {
    if (realGold === 0) { setPhase('done'); return; }
    let current = 0;
    const step = Math.ceil(realGold / 40);
    const interval = setInterval(() => {
      current += step;
      if (current >= realGold) {
        setDisplayedGold(realGold);
        setPhase('done');
        clearInterval(interval);
      } else {
        setDisplayedGold(current);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [realGold]);

  const handleReturnToVillage = useCallback(async () => {
    if (fromDefeat) {
      setIsSimulating(true);
      try { await advanceToVillage(); } catch { /* non-critical */ } finally { setIsSimulating(false); }
    }
    updateProgress({ location: 'village' });
    navigation.reset({ index: 0, routes: [{ name: 'Village' }] });
  }, [fromDefeat, advanceToVillage, updateProgress, navigation]);

  const totalQty    = items.length;
  const materialQty = items.filter(i => i.type === 'MATERIAL').length;

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />

      {/* World simulation overlay (shown on defeat) */}
      {isSimulating && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', zIndex: 99 }]}>
          <Text style={{ fontFamily: 'RobotoMono-Bold', fontSize: 12, color: '#00FF41', letterSpacing: 1 }}>
            ⟳ EL MUNDO CONTINÚA SIN TI...
          </Text>
        </View>
      )}

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
          <Text className="text-primary font-robotomono text-5xl font-bold">{displayedGold}G</Text>
          <Text className="text-primary/30 font-robotomono text-[9px] mt-1">
            {phase === 'counting' ? t('extraction.counting') : t('extraction.transferComplete')}
          </Text>
        </View>

        {/* Loot Inventory */}
        <View className="border border-primary/30 p-4 bg-muted/10 mb-6">
          <Text className="text-primary font-robotomono text-xs mb-3 font-bold">{t('extraction.itemsAcquired')}</Text>
          {items.length === 0 ? (
            <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 9, color: 'rgba(0,255,65,0.3)', textAlign: 'center', paddingVertical: 12 }}>
              SIN ÍTEMS
            </Text>
          ) : items.map((item, i) => (
            <View key={i} className="flex-row justify-between items-center py-2 border-b border-primary/10">
              <View className="flex-row items-center flex-1">
                <View style={{
                  width: 8, height: 8, marginRight: 8,
                  backgroundColor: item.rarity === 'UNCOMMON' ? '#00E5FF' : item.rarity === 'RARE' ? '#FFB000' : 'rgba(0,255,65,0.4)',
                }} />
                <View>
                  <Text className={`font-robotomono text-[10px] font-bold ${RARITY_COLORS[item.rarity] ?? 'text-primary/60'}`}>
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
            <Text className="text-primary font-robotomono text-lg font-bold">{totalQty}</Text>
          </View>
          <View className="flex-1 mx-1 border border-primary/20 p-3 bg-primary/5 items-center">
            <Text className="text-primary/40 font-robotomono text-[8px]">{t('extraction.materials')}</Text>
            <Text className="text-primary font-robotomono text-lg font-bold">{materialQty}</Text>
          </View>
          <View className="flex-1 ml-2 border border-secondary/20 p-3 bg-secondary/5 items-center">
            <Text className="text-secondary/40 font-robotomono text-[8px]">{t('common.gold')}</Text>
            <Text className="text-secondary font-robotomono text-lg font-bold">{realGold}G</Text>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View className="p-4 border-t border-primary/30 bg-background">
        {!fromDefeat && (
          <TouchableOpacity
            onPress={() => navigation.navigate('Map')}
            className="bg-primary p-3 items-center mb-2"
          >
            <Text className="text-background font-bold font-robotomono text-base">{t('extraction.continueExploring')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleReturnToVillage}
          className={`p-3 items-center border ${fromDefeat ? 'bg-primary' : 'border-accent'}`}
        >
          <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 12, color: fromDefeat ? '#0A0E0A' : '#00E5FF' }}>
            {t('extraction.returnVillage')}
          </Text>
        </TouchableOpacity>
      </View>

      <GlossaryButton />
    </View>
  );
};

