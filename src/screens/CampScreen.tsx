import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import { cyclesRemaining } from '../services/timeService';
import { confirmLevelUps } from '../services/progressionService';
import { checkForAbandonment } from '../services/moralSystem';
import { InventoryGrid } from '../components/InventoryGrid';
import { getItemsByGame } from '../database/itemRepository';
import type { ScreenProps } from '../navigation/types';

type CampTab = 'PARTY' | 'REST' | 'INVENTORY';

export const CampScreen = ({ navigation, route }: ScreenProps<'Camp'>) => {
  const { lang } = useI18n();
  const { floor } = route.params;

  const partyData = useGameStore(s => s.activeGame?.partyData ?? []);
  const gold      = useGameStore(s => s.activeGame?.gold ?? 0);
  const cycle     = useGameStore(s => s.activeGame?.cycle ?? 1);
  const seedHash  = useGameStore(s => s.activeGame?.seedHash ?? '');
  const activeGameId = useGameStore(s => s.activeGame?.id ?? null);
  const updateProgress  = useGameStore(s => s.updateProgress);
  const advanceCycle    = useGameStore(s => s.advanceCycle);
  const advanceToVillage = useGameStore(s => s.advanceToVillage);

  const [tab, setTab] = useState<CampTab>('PARTY');

  // ── Party tab ────────────────────────────────────────────────────────────────
  const handleLevelUp = useCallback((charIndex: number) => {
    const char = partyData[charIndex];
    if (!char || (char.pendingLevelUps ?? 0) === 0) return;
    const result = confirmLevelUps(char);
    const updated = partyData.map((c, i) => i === charIndex ? result.char : c);
    updateProgress({ partyData: updated });
  }, [partyData, updateProgress]);

  // ── Rest tab ─────────────────────────────────────────────────────────────────
  const SHORT_REST_COST = 0;
  const LONG_REST_CYCLE_COST = 1;

  const handleShortRest = useCallback(() => {
    // Short rest: heal 25% of maxHp for each alive member — free at camp
    const healed = partyData.map(c => {
      if (!c.alive) return c;
      const restored = Math.floor(c.maxHp * 0.25);
      return { ...c, hp: Math.min(c.maxHp, c.hp + restored) };
    });
    updateProgress({ partyData: healed });
    Alert.alert(
      lang === 'es' ? 'Descanso corto' : 'Short rest',
      lang === 'es' ? 'La party recuperó 25% de HP.' : 'The party recovered 25% HP.',
    );
  }, [partyData, updateProgress, lang]);

  const handleLongRest = useCallback(async () => {
    // Long rest: full HP restore — costs 1 cycle
    const healed = partyData.map(c => ({ ...c, hp: c.alive ? c.maxHp : c.hp }));

    // Check for abandonment before committing the rest
    if (seedHash) {
      const { abandoned, remained, log } = checkForAbandonment(
        healed,
        seedHash,
        cycle,
      );
      if (abandoned.length > 0) {
        updateProgress({ partyData: remained });
        Alert.alert(
          lang === 'es' ? '⚠ Deserción' : '⚠ Desertion',
          log.join('\n'),
        );
      } else {
        updateProgress({ partyData: healed });
      }
    } else {
      updateProgress({ partyData: healed });
    }

    await advanceCycle('REST_LONG');
    navigation.navigate('CycleTransition', {
      from: 'DAY',
      to: 'NIGHT',
      cycle: (cycle ?? 1) + LONG_REST_CYCLE_COST,
    });
  }, [partyData, updateProgress, advanceCycle, navigation, cycle, seedHash, lang]);

  const handleWaitEndOfSeason = useCallback(() => {
    const remaining = cyclesRemaining(cycle);
    if (remaining === 0) {
      Alert.alert(
        lang === 'es' ? 'La Torre está cerrada' : 'The Tower is closed',
        lang === 'es' ? 'Ya estás en el ciclo 60.' : 'You are already at cycle 60.',
      );
      return;
    }
    navigation.navigate('SimulationLoading', { fromCycle: cycle });
  }, [cycle, navigation, lang]);

  // ── HP color helper ───────────────────────────────────────────────────────────
  const hpColor = (hp: number, maxHp: number) => {
    const pct = maxHp > 0 ? hp / maxHp : 0;
    if (!hp) return '#FF3E3E';
    return pct > 0.5 ? '#00FF41' : pct > 0.25 ? '#FFB000' : '#FF3E3E';
  };

  const remaining = cyclesRemaining(cycle);

  // ── Tab labels ───────────────────────────────────────────────────────────────
  const TABS: { key: CampTab; label: string }[] = [
    { key: 'PARTY',     label: lang === 'es' ? 'PARTY'     : 'PARTY'     },
    { key: 'REST',      label: lang === 'es' ? 'DESCANSO'  : 'REST'      },
    { key: 'INVENTORY', label: lang === 'es' ? 'INVENTARIO': 'INVENTORY' },
  ];

  const partyWithPending = useMemo(
    () => partyData.filter(c => (c.pendingLevelUps ?? 0) > 0).length,
    [partyData],
  );

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />

      {/* Header */}
      <View className="p-4 border-b border-primary/30 flex-row items-center">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
          <Text className="text-primary font-robotomono text-xs">
            {'<'} {lang === 'es' ? 'VOLVER' : 'BACK'}
          </Text>
        </TouchableOpacity>
        <Text className="text-primary font-robotomono text-sm font-bold flex-1 text-center mr-8">
          {lang === 'es' ? `⛺ CAMPAMENTO · PISO ${floor}` : `⛺ CAMP · FLOOR ${floor}`}
        </Text>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-primary/20">
        {TABS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setTab(key)}
            className={`flex-1 py-3 items-center border-b-2 ${tab === key ? 'border-primary' : 'border-transparent'}`}
          >
            <Text className={`font-robotomono text-xs ${tab === key ? 'text-primary' : 'text-primary/40'}`}>
              {label}
              {key === 'PARTY' && partyWithPending > 0
                ? ` ↑${partyWithPending}`
                : null}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView className="flex-1 p-4">
        {/* PARTY TAB */}
        {tab === 'PARTY' && partyData.map((char, idx) => {
          const pending = char.pendingLevelUps ?? 0;
          const hCol = hpColor(char.hp, char.maxHp);
          return (
            <View key={char.characterId} className="border border-primary/30 rounded p-3 mb-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-primary font-robotomono text-sm font-bold">
                    {char.name}
                    {pending > 0 ? <Text className="text-accent"> ↑ LV {char.level + pending}</Text> : null}
                  </Text>
                  <Text className="text-primary/60 font-robotomono text-xs">
                    {char.charClass.toUpperCase()} · Lv {char.level}
                  </Text>
                </View>
                {!char.alive && (
                  <Text className="text-destructive font-robotomono text-xs">
                    {lang === 'es' ? 'MUERTO' : 'DEAD'}
                  </Text>
                )}
              </View>

              {/* HP bar */}
              {char.alive && (
                <View className="mt-2">
                  <View className="flex-row justify-between mb-1">
                    <Text className="font-robotomono text-xs" style={{ color: hCol }}>
                      HP {char.hp}/{char.maxHp}
                    </Text>
                    <Text className="text-primary/40 font-robotomono text-xs">
                      XP {char.xp}
                    </Text>
                  </View>
                  <View className="h-1 bg-primary/20 rounded-full">
                    <View
                      className="h-full rounded-full"
                      style={{ width: `${Math.round((char.hp / char.maxHp) * 100)}%`, backgroundColor: hCol }}
                    />
                  </View>
                </View>
              )}

              {/* Level up button */}
              {pending > 0 && char.alive && (
                <TouchableOpacity
                  onPress={() => handleLevelUp(idx)}
                  className="mt-2 border border-accent py-2 rounded items-center"
                >
                  <Text className="text-accent font-robotomono text-xs font-bold">
                    {lang === 'es'
                      ? `⬆ CONFIRMAR NIVEL ${char.level + pending}`
                      : `⬆ CONFIRM LEVEL ${char.level + pending}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* REST TAB */}
        {tab === 'REST' && (
          <View>
            {/* Cycle info */}
            <View className="border border-primary/20 rounded p-3 mb-4">
              <Text className="text-primary/60 font-robotomono text-xs">
                {lang === 'es'
                  ? `CICLO ACTUAL: ${cycle} / 60 · Restantes: ${remaining}`
                  : `CURRENT CYCLE: ${cycle} / 60 · Remaining: ${remaining}`}
              </Text>
            </View>

            {/* Short rest */}
            <TouchableOpacity
              onPress={handleShortRest}
              className="border border-primary/50 rounded p-4 mb-3"
            >
              <Text className="text-primary font-robotomono text-sm font-bold">
                {lang === 'es' ? 'DESCANSO CORTO' : 'SHORT REST'}
              </Text>
              <Text className="text-primary/60 font-robotomono text-xs mt-1">
                {lang === 'es'
                  ? '+25% HP por miembro vivo · Gratis en campamento'
                  : '+25% HP per living member · Free at camp'}
              </Text>
              <Text className="text-accent font-robotomono text-xs mt-1">
                {lang === 'es' ? 'Costo: 0G · 0 ciclos' : 'Cost: 0G · 0 cycles'}
              </Text>
            </TouchableOpacity>

            {/* Long rest */}
            <TouchableOpacity
              onPress={handleLongRest}
              className="border border-primary/50 rounded p-4 mb-3"
            >
              <Text className="text-primary font-robotomono text-sm font-bold">
                {lang === 'es' ? 'DESCANSO LARGO' : 'LONG REST'}
              </Text>
              <Text className="text-primary/60 font-robotomono text-xs mt-1">
                {lang === 'es'
                  ? 'HP completo para la party'
                  : 'Full HP for the party'}
              </Text>
              <Text className="text-accent font-robotomono text-xs mt-1">
                {lang === 'es' ? 'Costo: 0G · 1 ciclo' : 'Cost: 0G · 1 cycle'}
              </Text>
            </TouchableOpacity>

            {/* Wait end of season */}
            {remaining > 0 && (
              <TouchableOpacity
                onPress={handleWaitEndOfSeason}
                className="border border-primary/30 rounded p-4 mb-3 opacity-70"
              >
                <Text className="text-primary font-robotomono text-sm font-bold">
                  {lang === 'es' ? 'ESPERAR FIN DE TEMPORADA' : 'WAIT END OF SEASON'}
                </Text>
                <Text className="text-primary/60 font-robotomono text-xs mt-1">
                  {lang === 'es'
                    ? `Saltar al Ciclo 60 · Simula ${remaining} ciclos`
                    : `Skip to Cycle 60 · Simulates ${remaining} cycles`}
                </Text>
                <Text className="text-destructive/80 font-robotomono text-xs mt-1">
                  {lang === 'es' ? '⚠ Acción irreversible' : '⚠ Irreversible action'}
                </Text>
              </TouchableOpacity>
            )}

            {remaining === 0 && (
              <View className="border border-destructive/50 rounded p-4">
                <Text className="text-destructive font-robotomono text-sm font-bold text-center">
                  {lang === 'es' ? '⚠ LA TORRE SE CIERRA' : '⚠ THE TOWER CLOSES'}
                </Text>
                <Text className="text-primary/60 font-robotomono text-xs mt-2 text-center">
                  {lang === 'es'
                    ? 'Has llegado al Ciclo 60. La Torre expulsa a todos.'
                    : 'You have reached Cycle 60. The Tower expels all.'}
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Village')}
                  className="mt-3 border border-primary py-2 rounded items-center"
                >
                  <Text className="text-primary font-robotomono text-xs">
                    {lang === 'es' ? 'VOLVER AL PUEBLO' : 'RETURN TO VILLAGE'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* INVENTORY TAB */}
        {tab === 'INVENTORY' && activeGameId && (
          <View>
            <Text className="text-primary/40 font-robotomono text-xs mb-3 px-1">
              {lang === 'es' ? 'OBJETOS RECOGIDOS' : 'COLLECTED ITEMS'}
            </Text>
            <InventoryGrid
              items={getItemsByGame(activeGameId).map(item => ({
                id: item.id,
                name: item.name,
                type: item.type,
                rarity: item.rarity,
                goldValue: item.goldValue,
                data: item.data,
              }))}
              onItemPress={(item) => {
                Alert.alert(item.name, `${item.rarity.toUpperCase()} · ${item.goldValue}G`);
              }}
              onItemEquip={() => {/* Equip in Sprint 7 with essenceService */}}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
};
