import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { useGameStore } from '../stores/gameStore';
import { useI18n } from '../i18n';
import { getItemsByGame, type Item } from '../database/itemRepository';
import { getDB } from '../database';
import type { ScreenProps } from '../navigation/types';

const UPGRADE_BASE_COST = 40;
const UPGRADE_RARITY_MULT: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 5,
  unique: 0, // Can't upgrade unique items
};
const NEXT_RARITY: Record<string, string | null> = {
  common: 'uncommon',
  uncommon: 'rare',
  rare: null,
  unique: null,
};

function getUpgradeCost(item: Item): number | null {
  const mult = UPGRADE_RARITY_MULT[item.rarity];
  if (!mult) return null; // unique or unknown rarity
  if (!NEXT_RARITY[item.rarity]) return null; // already max
  return Math.round(UPGRADE_BASE_COST * mult * (1 + item.floorObtained * 0.05));
}

function upgradeItem(itemId: string, newRarity: string): void {
  const db = getDB();
  const newGoldValue = { common: 24, uncommon: 60, rare: 144, unique: 480 }[newRarity] ?? 24;
  db.executeSync(
    'UPDATE items SET rarity = ?, gold_value = ? WHERE id = ?',
    [newRarity, newGoldValue, itemId],
  );
}

export const BlacksmithScreen = ({ navigation }: ScreenProps<'Blacksmith'>) => {
  const { t } = useI18n();
  const gold        = useGameStore(s => s.activeGame?.gold ?? 0);
  const activeGameId = useGameStore(s => s.activeGame?.id ?? null);
  const updateProgress = useGameStore(s => s.updateProgress);

  const [inventory, setInventory] = useState<Item[]>([]);

  const refreshInventory = useCallback(() => {
    if (!activeGameId) return;
    try {
      setInventory(getItemsByGame(activeGameId).filter(i => i.type === 'weapon' || i.type === 'armor'));
    } catch { setInventory([]); }
  }, [activeGameId]);

  useEffect(() => { refreshInventory(); }, [refreshInventory]);

  const handleUpgrade = useCallback((item: Item) => {
    const cost = getUpgradeCost(item);
    const nextRarity = NEXT_RARITY[item.rarity];
    if (!cost || !nextRarity) return;
    if (gold < cost) {
      Alert.alert(t('village.insufficientGold') ?? 'Sin fondos', `La mejora cuesta ${cost}G`);
      return;
    }
    try {
      upgradeItem(item.id, nextRarity);
      updateProgress({ gold: gold - cost });
      refreshInventory();
    } catch (e) { console.warn('Upgrade failed', e); }
  }, [gold, updateProgress, refreshInventory, t]);

  const RARITY_COLOR: Record<string, string> = {
    common: 'rgba(0,255,65,0.7)',
    uncommon: '#00E5FF',
    rare: '#FFB000',
    unique: '#FF3E3E',
  };

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />

      {/* Header */}
      <View className="p-4 border-b" style={{ borderBottomColor: 'rgba(0,255,65,0.3)' }}>
        <View className="flex-row justify-between items-center">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ fontFamily: 'RobotoMono-Bold', fontSize: 10, color: 'rgba(0,255,65,0.6)' }}>{'<'} {t('common.back') ?? 'VOLVER'}</Text>
          </TouchableOpacity>
          <Text className="text-primary font-robotomono text-sm font-bold">HERRERÍA</Text>
          <Text className="text-secondary font-robotomono text-[10px]">{gold}G</Text>
        </View>
        <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 9, color: 'rgba(0,255,65,0.4)', marginTop: 4 }}>
          Mejora el equipo aumentando su rareza
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        <Text className="text-primary font-robotomono text-xs font-bold mb-3">EQUIPO DISPONIBLE</Text>

        {inventory.length === 0 && (
          <View className="border border-primary/20 p-4 bg-muted/5 mb-4 items-center">
            <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 10, color: 'rgba(0,255,65,0.3)', textAlign: 'center' }}>
              Sin equipo para mejorar.{'\n'}Consigue armas o armadura en el mercado.
            </Text>
          </View>
        )}

        {inventory.map(item => {
          const cost = getUpgradeCost(item);
          const nextRarity = NEXT_RARITY[item.rarity];
          const canAfford = cost !== null && gold >= cost;
          return (
            <View
              key={item.id}
              className="border border-primary/20 p-3 bg-muted/10 mb-2"
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-1">
                  <Text style={{ fontFamily: 'RobotoMono-Bold', fontSize: 11, color: '#00FF41' }}>
                    {item.name.toUpperCase()}
                  </Text>
                  <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 8, color: RARITY_COLOR[item.rarity] ?? 'rgba(0,255,65,0.4)', marginTop: 2 }}>
                    {item.rarity.toUpperCase()}
                    {item.ownerCharName ? ` · ${item.ownerCharName.toUpperCase()}` : ''}
                  </Text>
                </View>

                {nextRarity ? (
                  <TouchableOpacity
                    onPress={() => handleUpgrade(item)}
                    disabled={!canAfford}
                    style={{
                      borderWidth: 1,
                      borderColor: canAfford ? '#FFB000' : 'rgba(255,176,0,0.3)',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{
                      fontFamily: 'RobotoMono-Bold',
                      fontSize: 9,
                      color: canAfford ? '#FFB000' : 'rgba(255,176,0,0.3)',
                    }}>
                      {cost}G → {nextRarity.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 9, color: 'rgba(0,255,65,0.3)' }}>
                    {item.rarity === 'unique' ? 'ÚNICO' : 'MÁX'}
                  </Text>
                )}
              </View>
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};
