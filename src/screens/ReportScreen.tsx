import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, BackHandler, InteractionManager } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { TypewriterText } from '../components/TypewriterText';
import { GlossaryButton } from '../components/GlossaryModal';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import { generateRoomLoot, generateBossUniqueLoot } from '../services/lootService';
import { createItem, isBossLootClaimed } from '../database/itemRepository';
import type { LootDrop } from '../services/lootService';
import type { ScreenProps } from '../navigation/types';

export const ReportScreen = ({ navigation, route }: ScreenProps<'Report'>) => {
  const { roomWasCleared, roomId, roomType, bossLootAlreadyClaimed } = route.params;
  const { t, lang } = useI18n();

  const combatResult   = useGameStore(s => s.lastCombatResult);
  const lastSimEvents  = useGameStore(s => s.lastSimulationEvents);
  const activeFloor    = useGameStore(s => s.activeGame?.floor ?? 1);
  const activeCycle    = useGameStore(s => s.activeGame?.cycle ?? 1);
  const seedHash       = useGameStore(s => s.activeGame?.seedHash ?? '0');
  const activeGameId   = useGameStore(s => s.activeGame?.id ?? null);
  const updateProgress = useGameStore(s => s.updateProgress);
  const gold           = useGameStore(s => s.activeGame?.gold ?? 0);

  const outcome = combatResult?.outcome ?? (roomWasCleared ? 'VICTORY' : 'DEFEAT');

  const [lootDrops, setLootDrops] = useState<LootDrop[]>([]);

  // Generate and persist loot on first render after a victory
  // PERF-003: deferred via InteractionManager so initial render is not blocked
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      if (outcome !== 'VICTORY' || !roomType || !activeGameId) return;
      try {
        const lootTable = ['NORMAL', 'ELITE', 'BOSS', 'TREASURE', 'SECRET'] as const;
        type LootRoomType = typeof lootTable[number];
        const validType: LootRoomType = lootTable.includes(roomType as LootRoomType)
          ? (roomType as LootRoomType)
          : 'NORMAL';

        const drops: LootDrop[] = generateRoomLoot(roomId, validType, activeFloor, activeCycle, seedHash);

        if (validType === 'BOSS') {
          const alreadyClaimed = bossLootAlreadyClaimed ?? isBossLootClaimed(seedHash, roomId);
          if (!alreadyClaimed) {
            const unique = generateBossUniqueLoot(seedHash, roomId, activeFloor);
            if (unique) drops.push(unique);
          }
        }

        // Persist to DB
        for (const drop of drops) {
          try {
            createItem({
              seedHash,
              ownerGameId: activeGameId,
              ownerCharName: null,
              name: drop.name,
              type: drop.type,
              rarity: drop.rarity,
              isEquipped: false,
              isUnique: drop.type === 'boss_loot',
              obtainedCycle: activeCycle,
              floorObtained: activeFloor,
              goldValue: drop.goldValue,
              data: drop.data,
              claimed: false,
            });
          } catch { /* already exists — idempotent */ }
        }

        // Update gold from goldEarned
        if (combatResult?.goldEarned) {
          updateProgress({ gold: gold + combatResult.goldEarned });
        }

        setLootDrops(drops);
      } catch { /* non-critical — report still shows */ }
    });
    return () => task.cancel();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinue = useCallback(() => {
    if (outcome === 'DEFEAT') {
      navigation.navigate('Extraction', { fromDefeat: true });
    } else {
      navigation.navigate('Map');
    }
  }, [outcome, navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleContinue();
      return true;
    });
    return () => sub.remove();
  }, [handleContinue]);

  const headerText = `─── ${t('report.title')} · ${t('common.floor')} ${String(activeFloor).padStart(2, '0')} · ${t('common.cycle')} ${String(activeCycle).padStart(2, '0')} ───`;

  const roundsElapsed = combatResult?.roundsElapsed ?? 0;
  const enemiesDefeated = combatResult?.enemiesDefeated ?? [];
  const partyAfter = combatResult?.partyAfter ?? [];
  const totalXp    = combatResult?.totalXp    ?? 0;
  const goldEarned = combatResult?.goldEarned ?? 0;

  // ── Damage chart ──────────────────────────────────────────────────────────
  const damageDone  = combatResult?.damageDone ?? {};
  const maxDamage   = Math.max(1, ...Object.values(damageDone));
  const damageEntries = Object.entries(damageDone);

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />

      {/* Header */}
      <View className="p-4 border-b border-primary/30">
        <TypewriterText
          text={headerText}
          className="text-primary text-xs text-center"
          delay={20}
          showCursor={false}
        />
      </View>

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        {/* Result */}
        <View className="items-center mb-6">
          <Text className={`font-robotomono text-2xl font-bold ${
            outcome === 'VICTORY' ? 'text-primary' : 'text-destructive'
          }`}>
            [{outcome === 'VICTORY' ? t('report.victory') : t('report.defeat')}]
          </Text>
          <Text className="text-primary/40 font-robotomono text-[8px] mt-1">
            {roundsElapsed} {t('report.rounds')} · {t('common.floor')} {String(activeFloor).padStart(2, '0')}
          </Text>
        </View>

        {/* Enemies Defeated */}
        <View className="mb-4 border border-primary/20 p-3 bg-muted/10">
          <Text className="text-primary font-robotomono text-[9px] mb-2 font-bold">{t('report.enemiesDefeated')}</Text>
          {enemiesDefeated.length === 0 ? (
            <Text className="text-primary/30 font-robotomono text-[9px]">—</Text>
          ) : (
            enemiesDefeated.map((e, i) => (
              <View key={i} className="flex-row justify-between items-center mb-1 py-1 border-b border-primary/10">
                <Text className="text-primary/70 font-robotomono text-[9px]">{e.name}</Text>
                <View className="flex-row">
                  <Text className="text-secondary font-robotomono text-[8px] mr-3">+{e.xpEarned}XP</Text>
                  {e.loot && (
                    <Text className="text-accent font-robotomono text-[8px]">{e.loot}</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Party Status */}
        <View className="mb-4 border border-primary/20 p-3 bg-muted/10">
          <Text className="text-primary font-robotomono text-[9px] mb-2 font-bold">{t('report.partyStatus')}</Text>
          {partyAfter.map((c, i) => {
            const hpLost = c.hpBefore - c.hpAfter;
            return (
              <View key={i} className="flex-row justify-between items-center mb-1 py-1 border-b border-primary/10">
                <View className="flex-row items-center">
                  <Text className="text-primary font-robotomono text-[9px] font-bold mr-2">{c.name.toUpperCase()}</Text>
                  <Text className="text-secondary/60 font-robotomono text-[7px]">{t(`party.class_${c.charClass.toUpperCase()}`)}</Text>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-primary/60 font-robotomono text-[8px]">
                    {t('common.hp')}: {c.hpAfter}/{c.hpBefore}
                  </Text>
                  {hpLost > 0 && (
                    <Text className="text-destructive font-robotomono text-[8px] ml-2">-{hpLost}</Text>
                  )}
                  <View className={`w-2 h-2 ml-2 ${
                    c.alive ? 'bg-primary' : 'bg-destructive'
                  }`} />
                </View>
              </View>
            );
          })}
        </View>

        {/* XP & Gold */}
        <View className="mb-4 flex-row">
          <View className="flex-1 mr-2 border border-secondary/30 p-3 bg-secondary/5 items-center">
            <Text className="text-secondary/50 font-robotomono text-[7px]">{t('report.totalXp')}</Text>
            <Text className="text-secondary font-robotomono text-xl font-bold">+{totalXp}</Text>
          </View>
          <View className="flex-1 ml-2 border border-secondary/30 p-3 bg-secondary/5 items-center">
            <Text className="text-secondary/50 font-robotomono text-[7px]">{t('report.goldEarned')}</Text>
            <Text className="text-secondary font-robotomono text-xl font-bold">{goldEarned}G</Text>
          </View>
        </View>

        {/* Performance Graph — damage dealt per party member */}
        {damageEntries.length > 0 && (
          <View className="mb-4 border border-primary/20 p-3 bg-primary/5">
            <Text className="text-primary font-robotomono text-[9px] mb-2 font-bold">{t('report.damageDone')}</Text>
            <View className="flex-row items-end h-16">
              {damageEntries.map(([name, dmg], i) => (
                <View key={i} className="flex-1 items-center mx-1">
                  <View
                    className="w-full bg-primary/40 border border-primary/20"
                    style={{ height: `${Math.round((dmg / maxDamage) * 100)}%`, minHeight: 2 }}
                  />
                  <Text className="text-primary/40 font-robotomono text-[6px] mt-1">
                    {name.substring(0, 5).toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Loot Obtained */}
        {lootDrops.length > 0 && (
          <View className="mb-4 border border-accent/30 p-3 bg-accent/5">
            <Text className="text-accent font-robotomono text-[9px] mb-2 font-bold">
              {lang === 'es' ? 'BOTÍN OBTENIDO' : 'LOOT OBTAINED'}
            </Text>
            {lootDrops.map((drop, i) => (
              <View key={i} className="flex-row justify-between items-center mb-1 py-1 border-b border-accent/10">
                <Text className="text-primary/70 font-robotomono text-[9px] flex-1">{drop.name}</Text>
                <Text className="text-accent font-robotomono text-[8px] uppercase mr-2">{drop.rarity}</Text>
                <Text className="text-secondary font-robotomono text-[8px]">{drop.goldValue}G</Text>
              </View>
            ))}
          </View>
        )}

        {/* World Event Alert — real events from world simulation */}
        {(() => {
          const notableEvent = lastSimEvents?.find(e =>
            e.type === 'AI_ELIMINATED' || e.type === 'ALLIANCE_FORMED' || e.type === 'BOSS_KILLED'
          );
          return notableEvent ? (
            <View className="mb-4 border border-destructive/30 p-3 bg-destructive/5">
              <Text className="text-destructive font-robotomono text-xs font-bold">
                ⚠ {t('report.worldEvent')}
              </Text>
              <Text style={{ color: 'rgba(255,62,62,0.7)' }} className="font-robotomono text-[11px] mt-1">
                {lang === 'es' ? notableEvent.summary : (notableEvent.summary_en ?? notableEvent.summary)}
                {' · '}{t('common.floor')} {String(notableEvent.floor ?? activeFloor).padStart(2, '0')}
                {' · '}{t('common.cycle')} {String(notableEvent.cycle ?? activeCycle).padStart(2, '0')}
              </Text>
            </View>
          ) : null;
        })()}

        <View className="h-8" />
      </ScrollView>

      {/* Continue Button */}
      <View className="p-4 border-t border-primary/30 bg-background">
        <TouchableOpacity
          onPress={handleContinue}
          className="bg-primary p-3 items-center"
        >
          <Text className="text-background font-bold font-robotomono">{t('common.continue')}</Text>
        </TouchableOpacity>
      </View>

      <GlossaryButton />
    </View>
  );
};
