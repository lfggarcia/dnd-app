import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, BackHandler } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { GlossaryButton } from '../components/GlossaryModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { GuildIcon, DiamondIcon, HammerIcon, ShieldIcon, MoonIcon, CrossIcon, SwordIcon } from '../components/Icons';
import { useGameStore } from '../stores/gameStore';
import { useI18n } from '../i18n';
import { generateRivals } from '../services/rivalGenerator';
import { getResourcesByEndpoint } from '../database';
import type { ScreenProps } from '../navigation/types';

// Deterministic pick N items from a string[] using a string seed
function deterministicPick(pool: string[], seedKey: string, count: number): string[] {
  if (pool.length === 0) return [];
  let h = 5381;
  for (let i = 0; i < seedKey.length; i++) {
    h = (Math.imul(h, 33) ^ seedKey.charCodeAt(i)) >>> 0;
  }
  const picked: string[] = [];
  const used = new Set<number>();
  const n = Math.min(count, pool.length);
  while (picked.length < n) {
    h = (Math.imul(1664525, h) + 1013904223) >>> 0;
    const idx = h % pool.length;
    if (!used.has(idx)) {
      used.add(idx);
      picked.push(pool[idx]);
    }
  }
  return picked;
}

const BUILDING_KEYS = ['guild', 'market', 'blacksmith', 'armory', 'inn', 'church'] as const;
const BUILDING_ICON_COMPONENTS: Record<string, React.FC<{ size?: number; color?: string }>> = {
  guild: GuildIcon,
  market: DiamondIcon,
  blacksmith: HammerIcon,
  armory: ShieldIcon,
  inn: MoonIcon,
  church: CrossIcon,
};

const BUILDING_NAV: Partial<Record<string, keyof import('../navigation/types').RootStackParamList>> = {
  guild: 'Guild',
};

export const VillageScreen = ({ navigation }: ScreenProps<'Village'>) => {
  const { t } = useI18n();
  const clearActive = useGameStore(s => s.clearActive);
  const updateProgress = useGameStore(s => s.updateProgress);
  const gold = useGameStore(s => s.activeGame?.gold ?? 0);
  const cycle = useGameStore(s => s.activeGame?.cycle ?? 1);
  const maxFloor = useGameStore(s => s.activeGame?.floor ?? 1);
  const phase = useGameStore(s => s.activeGame?.phase ?? 'DAY');
  const seedHash = useGameStore(s => s.activeGame?.seedHash ?? '0');
  const [showExitModal, setShowExitModal] = useState(false);

  // Mark location as village on mount
  useEffect(() => {
    updateProgress({ location: 'village' });
  }, [updateProgress]);

  // Android back → show exit confirm
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowExitModal(true);
      return true;
    });
    return () => sub.remove();
  }, []);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);

  const rivals = useMemo(
    () => generateRivals(seedHash, maxFloor, cycle),
    [seedHash, maxFloor, cycle],
  );

  // Cargamos los nombres de equipment y monstruos una sola vez al montar.
  // Sacar las queries síncronas de SQLite del useMemo evita bloquear el hilo
  // JS en cada re-render causado por cambios de seed/cycle/floor.
  const [equipmentNames, setEquipmentNames] = useState<string[]>([]);
  const [monsterPool, setMonsterPool] = useState<string[]>([]);

  useEffect(() => {
    const eq = getResourcesByEndpoint('equipment');
    setEquipmentNames(eq.map(r => r.name));

    const mo = getResourcesByEndpoint('monsters');
    const singleWord = mo
      .filter(r => !r.name.includes(' '))
      .map(r => r.name.toUpperCase());
    // Si hay pocos nombres de una sola palabra usamos todos
    setMonsterPool(singleWord.length >= 5 ? singleWord : mo.map(r => r.name.toUpperCase()));
  }, []); // solo al montar — los datos de la DB no cambian en runtime

  const marketItems = useMemo(
    () => deterministicPick(
      equipmentNames,
      `${seedHash}_market_${cycle}`,
      3,
    ),
    [equipmentNames, seedHash, cycle],
  );

  const knownThreats = useMemo(
    () => deterministicPick(
      monsterPool,
      `${seedHash}_threats_${maxFloor}`,
      3,
    ),
    [monsterPool, seedHash, maxFloor],
  );

  const allRivalsWaiting = rivals.every(r => r.status === 'waiting');

  const handleBuildingPress = useCallback((key: string) => {
    const screen = BUILDING_NAV[key];
    if (screen) navigation.navigate(screen as any);
  }, [navigation]);

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />


      {/* Header */}
      <View className="p-4 border-b" style={{ borderBottomColor: 'rgba(0,255,65,0.3)' }}>
        <View className="flex-row justify-between items-center">
          <TouchableOpacity onPress={() => setShowExitModal(true)}>
            <Text style={{ fontFamily: 'RobotoMono-Bold', fontSize: 10, color: 'rgba(0,255,65,0.6)' }}>{'<'} {t('village.exitGame')}</Text>
          </TouchableOpacity>
          <Text className="text-primary font-robotomono text-sm font-bold">
            {t('village.title')}
          </Text>
          <View style={{ width: 70 }} />
        </View>
        <View className="flex-row justify-between mt-2">
          <Text className="text-secondary font-robotomono text-[10px]">{t('common.gold')}: {gold}G</Text>
          <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 10, color: phase === 'NIGHT' ? '#B266FF' : 'rgba(0,255,65,0.5)' }}>
            {phase === 'NIGHT' ? t('common.night') : t('common.day')} {cycle}
          </Text>
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
            onPress={() => handleBuildingPress(key)}
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
              {key === 'market' && marketItems.length > 0 && (
                <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 8, color: 'rgba(255,176,0,0.55)', marginTop: 3 }}>
                  {t('village.marketStock')}: {marketItems.join(' · ')}
                </Text>
              )}
            </View>
            <Text className="text-primary/30 font-robotomono text-xs">{'>'}</Text>
          </TouchableOpacity>
        ))}

        {/* Rivalry Monitor */}
        <Text className="text-primary font-robotomono text-xs font-bold mt-6 mb-3">{t('village.rivalryMonitor')}</Text>

        {allRivalsWaiting ? (
          <View className="border border-primary/20 p-4 bg-muted/5 mb-4 items-center">
            <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 10, color: 'rgba(0,255,65,0.3)', textAlign: 'center', lineHeight: 18 }}>
              {t('village.noRivals')}
            </Text>
          </View>
        ) : (
          <View className="border border-primary/20 p-3 bg-muted/5 mb-4">
            {rivals.map((rival, i) => (
              <View key={i} className="flex-row items-center py-2" style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(0,255,65,0.1)' }}>
                <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 9, color: 'rgba(0,255,65,0.4)', width: 20 }}>{i + 1}.</Text>
                <View className="flex-1">
                  <Text style={{
                    fontFamily: 'RobotoMono-Bold',
                    fontSize: 10,
                    color: rival.status === 'waiting' ? 'rgba(0,255,65,0.3)' : '#00FF41',
                  }}>
                    {rival.name}
                  </Text>
                </View>
                {rival.status === 'waiting' ? (
                  <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 9, color: 'rgba(0,255,65,0.25)' }}>
                    {t('village.rivalWaiting')}
                  </Text>
                ) : (
                  <>
                    <Text className="text-accent font-robotomono text-[9px] mr-3">{t('village.floor')} {rival.floor}</Text>
                    <View className="w-12">
                      <View className="h-1" style={{ backgroundColor: 'rgba(0,255,65,0.1)' }}>
                        <View className="h-1 bg-primary" style={{ width: `${rival.rep}%` }} />
                      </View>
                    </View>
                  </>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Known threats from D&D 5e DB */}
        {knownThreats.length > 0 && (
          <View className="border p-3 bg-muted/5 mb-4" style={{ borderColor: 'rgba(255,62,62,0.25)' }}>
            <Text style={{ fontFamily: 'RobotoMono-Bold', fontSize: 9, color: 'rgba(255,62,62,0.6)', marginBottom: 5, letterSpacing: 0.5 }}>
              {t('village.threats').toUpperCase()} — {t('village.floor').toUpperCase()} {maxFloor}
            </Text>
            <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 10, color: 'rgba(255,62,62,0.75)', letterSpacing: 0.3 }}>
              {knownThreats.join(' · ')}
            </Text>
          </View>
        )}

        {/* Spacer for bottom button */}
        <View className="h-24" />
      </ScrollView>

      {/* Enter Tower Button - Fixed at bottom */}
      <View className="p-4 border-t border-primary/30 bg-background">
        <TouchableOpacity
          onPress={() => setShowDisclaimerModal(true)}
          className="bg-primary p-4 items-center"
          activeOpacity={0.7}
        >
          <View className="flex-row items-center justify-center">
            <SwordIcon size={18} color="#0A0E0A" />
            <Text className="text-background font-bold font-robotomono text-lg ml-2">{t('village.enterTower')}</Text>
          </View>
          <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 10, color: 'rgba(10,14,10,0.6)', marginTop: 4 }}>{t('village.enterTowerDesc')}</Text>
        </TouchableOpacity>
      </View>

      <GlossaryButton bottomOffset={120} />

      <ConfirmModal
        visible={showDisclaimerModal}
        title={t('map.towerDisclaimerTitle')}
        message={t('map.towerDisclaimerMsg')}
        confirmLabel={t('village.enterTower')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          setShowDisclaimerModal(false);
          navigation.navigate('Map');
        }}
        onCancel={() => setShowDisclaimerModal(false)}
      />

      <ConfirmModal
        visible={showExitModal}
        title={t('village.exitConfirmTitle')}
        message={t('village.exitConfirmMsg')}
        confirmLabel={t('village.exitGame')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          setShowExitModal(false);
          clearActive();
          navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        }}
        onCancel={() => setShowExitModal(false)}
      />
    </View>
  );
};
