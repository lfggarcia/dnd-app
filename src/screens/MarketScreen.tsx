import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { useGameStore } from '../stores/gameStore';
import { useI18n } from '../i18n';
import { getResourcesByEndpoint } from '../database';
import { getItemsByGame, createItem, deleteItem, type Item } from '../database/itemRepository';
import { makePRNG } from '../utils/prng';
import type { ScreenProps } from '../navigation/types';

type MarketItem = {
  id: string;
  name: string;
  rarity: 'common' | 'uncommon' | 'rare';
  type: 'weapon' | 'armor' | 'consumable' | 'material';
  price: number;
};

const RARITY_MULTIPLIER: Record<string, number> = { common: 1, uncommon: 2.5, rare: 6 };
const BASE_PRICE = 12;
const SELL_RATIO = 0.5;

function generateMarketStock(seedHash: string, cycle: number, maxFloor: number): MarketItem[] {
  const rng = makePRNG(`${seedHash}_market_${cycle}`);
  const equipmentNames = getResourcesByEndpoint('equipment').map(r => r.name);
  if (equipmentNames.length === 0) return [];

  const count = 5 + (maxFloor > 2 ? 2 : 0);
  const items: MarketItem[] = [];
  const used = new Set<number>();

  while (items.length < count && items.length < equipmentNames.length) {
    const idx = rng.next(0, equipmentNames.length - 1);
    if (used.has(idx)) continue;
    used.add(idx);

    const rarityRoll = rng.next(1, 100);
    const rarity: 'common' | 'uncommon' | 'rare' =
      rarityRoll <= 60 ? 'common' : rarityRoll <= 90 ? 'uncommon' : 'rare';

    const floorMultiplier = 1 + maxFloor * 0.03;
    const price = Math.round(BASE_PRICE * RARITY_MULTIPLIER[rarity] * floorMultiplier);

    items.push({
      id: `market_${seedHash}_${cycle}_${idx}`,
      name: equipmentNames[idx],
      rarity,
      type: 'weapon',
      price,
    });
  }
  return items;
}

export const MarketScreen = ({ navigation }: ScreenProps<'Market'>) => {
  const { t } = useI18n();
  const seedHash    = useGameStore(s => s.activeGame?.seedHash ?? '');
  const cycle       = useGameStore(s => s.activeGame?.cycle ?? 1);
  const gold        = useGameStore(s => s.activeGame?.gold ?? 0);
  const maxFloor    = useGameStore(s => s.activeGame?.floor ?? 1);
  const activeGameId = useGameStore(s => s.activeGame?.id ?? null);
  const updateProgress = useGameStore(s => s.updateProgress);

  const [inventory, setInventory] = useState<Item[]>([]);
  const [purchased, setPurchased] = useState<Set<string>>(new Set());

  const marketStock = useMemo(
    () => generateMarketStock(seedHash, cycle, maxFloor),
    [seedHash, cycle, maxFloor],
  );

  useEffect(() => {
    if (!activeGameId) return;
    try { setInventory(getItemsByGame(activeGameId)); } catch { setInventory([]); }
  }, [activeGameId]);

  const handleBuy = useCallback((item: MarketItem) => {
    if (!activeGameId) return;
    if (gold < item.price) {
      Alert.alert(t('village.insufficientGold') ?? 'Sin fondos', `Necesitas ${item.price}G`);
      return;
    }
    try {
      createItem({
        seedHash,
        ownerGameId: activeGameId,
        ownerCharName: null,
        name: item.name,
        type: item.type,
        rarity: item.rarity,
        isEquipped: false,
        isUnique: false,
        obtainedCycle: cycle,
        floorObtained: maxFloor,
        goldValue: Math.round(item.price * SELL_RATIO),
        data: {},
        claimed: false,
      });
      updateProgress({ gold: gold - item.price });
      setPurchased(prev => new Set(prev).add(item.id));
    } catch (e) { if (__DEV__) console.warn('Buy failed', e); }
  }, [activeGameId, gold, seedHash, cycle, maxFloor, updateProgress, t]);

  const handleSell = useCallback((item: Item) => {
    const sellPrice = Math.floor(item.goldValue * SELL_RATIO);
    try {
      deleteItem(item.id);
      updateProgress({ gold: gold + sellPrice });
      setInventory(prev => prev.filter(i => i.id !== item.id));
    } catch (e) { if (__DEV__) console.warn('Sell failed', e); }
  }, [gold, updateProgress]);

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
          <Text className="text-primary font-robotomono text-sm font-bold">MERCADO</Text>
          <Text className="text-secondary font-robotomono text-[10px]">{gold}G</Text>
        </View>
        <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 9, color: 'rgba(0,255,65,0.4)', marginTop: 4 }}>
          {t('common.cycle') ?? 'Ciclo'} {cycle} · {t('village.maxFloor') ?? 'Piso máx'}: {maxFloor}
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        {/* En Venta */}
        <Text className="text-primary font-robotomono text-xs font-bold mb-3">EN VENTA</Text>
        {marketStock.length === 0 && (
          <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 10, color: 'rgba(0,255,65,0.3)', textAlign: 'center', paddingVertical: 16 }}>
            SIN STOCK
          </Text>
        )}
        {marketStock.map(item => {
          const alreadyBought = purchased.has(item.id);
          return (
            <View
              key={item.id}
              className="border border-primary/20 p-3 bg-muted/10 mb-2 flex-row items-center justify-between"
            >
              <View className="flex-1">
                <Text style={{ fontFamily: 'RobotoMono-Bold', fontSize: 11, color: alreadyBought ? 'rgba(0,255,65,0.3)' : '#00FF41' }}>
                  {item.name.toUpperCase()}
                </Text>
                <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 8, color: RARITY_COLOR[item.rarity] ?? 'rgba(0,255,65,0.4)', marginTop: 2 }}>
                  {item.rarity.toUpperCase()} · {item.type.toUpperCase()}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleBuy(item)}
                disabled={alreadyBought || gold < item.price}
                style={{
                  borderWidth: 1,
                  borderColor: alreadyBought ? 'rgba(0,255,65,0.2)' : gold >= item.price ? '#00FF41' : 'rgba(0,255,65,0.3)',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text style={{
                  fontFamily: 'RobotoMono-Bold',
                  fontSize: 10,
                  color: alreadyBought ? 'rgba(0,255,65,0.2)' : gold >= item.price ? '#00FF41' : 'rgba(0,255,65,0.3)',
                }}>
                  {alreadyBought ? 'COMPRADO' : `${item.price}G`}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Tu Inventario */}
        <Text className="text-primary font-robotomono text-xs font-bold mt-6 mb-3">TU INVENTARIO</Text>
        {inventory.length === 0 && (
          <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 10, color: 'rgba(0,255,65,0.3)', textAlign: 'center', paddingVertical: 16 }}>
            INVENTARIO VACÍO
          </Text>
        )}
        {inventory.map(item => {
          const sellPrice = Math.floor(item.goldValue * SELL_RATIO);
          return (
            <View
              key={item.id}
              className="border border-primary/20 p-3 bg-muted/10 mb-2 flex-row items-center justify-between"
            >
              <View className="flex-1">
                <Text style={{ fontFamily: 'RobotoMono-Bold', fontSize: 11, color: '#00FF41' }}>
                  {item.name.toUpperCase()}
                </Text>
                <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 8, color: RARITY_COLOR[item.rarity] ?? 'rgba(0,255,65,0.4)', marginTop: 2 }}>
                  {item.rarity.toUpperCase()}
                  {item.ownerCharName ? ` · ${item.ownerCharName.toUpperCase()}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleSell(item)}
                disabled={item.isEquipped}
                style={{
                  borderWidth: 1,
                  borderColor: item.isEquipped ? 'rgba(0,255,65,0.2)' : 'rgba(255,176,0,0.6)',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text style={{
                  fontFamily: 'RobotoMono-Bold',
                  fontSize: 10,
                  color: item.isEquipped ? 'rgba(0,255,65,0.2)' : '#FFB000',
                }}>
                  {item.isEquipped ? 'EQUIPADO' : `VENDER ${sellPrice}G`}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};
