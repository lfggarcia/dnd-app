import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, BackHandler, Image, StyleSheet } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { GlossaryButton } from '../components/GlossaryModal';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import { generateEnemiesForRoom, resolveCombat } from '../services/combatEngine';
import type { ScreenProps } from '../navigation/types';

/** Delay between each log line appearing (ms) */
const LOG_TICK_MS = 70;

export const BattleScreen = ({ navigation, route }: ScreenProps<'Battle'>) => {
  const { roomId, roomType } = route.params;
  const { t } = useI18n();

  // ── Store selectors (granular — evita re-renders globales) ──────────────────
  const partyData      = useGameStore(s => s.activeGame?.partyData ?? []);
  const portrait       = useGameStore(s => s.activeGame?.partyPortrait ?? null);
  const portraitsMap   = useGameStore(s => s.activeGame?.portraitsJson ?? null);
  const activeFloor    = useGameStore(s => s.activeGame?.floor ?? 1);
  const activeCycle    = useGameStore(s => s.activeGame?.cycle ?? 1);
  const setCombatResult = useGameStore(s => s.setCombatResult);
  const updateProgress  = useGameStore(s => s.updateProgress);

  const aliveParty = useMemo(() => partyData.filter(c => c.alive), [partyData]);

  const getCharPortrait = useCallback(
    (char: typeof partyData[0], index: number): string | null =>
      portraitsMap?.[String(index)] ?? char.portrait ?? null,
    [portraitsMap],
  );

  // ── Combat resolution (runs once on mount, fully deterministic) ─────────────
  const enemies = useMemo(
    () => generateEnemiesForRoom(roomType, roomId, activeCycle, activeFloor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const combatResult = useMemo(
    () => resolveCombat(partyData, enemies, roomId, []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Animated log (one line per tick) ────────────────────────────────────────
  const [visibleLines, setVisibleLines] = useState(1);
  const logScrollRef = useRef<ScrollView>(null);
  const animationDone = visibleLines >= combatResult.log.length;

  useEffect(() => {
    if (animationDone) return;
    const t = setTimeout(() => setVisibleLines(v => v + 1), LOG_TICK_MS);
    return () => clearTimeout(t);
  }, [visibleLines, animationDone]);

  // Auto-scroll log to bottom as new lines appear
  useEffect(() => {
    logScrollRef.current?.scrollToEnd({ animated: false });
  }, [visibleLines]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const handleContinue = useCallback(() => {
    // Persist HP changes back to partyData
    const updatedParty = partyData.map(c => {
      const after = combatResult.partyAfter.find(p => p.name === c.name);
      if (!after) return c;
      return { ...c, hp: after.hpAfter, alive: after.alive };
    });
    updateProgress({ partyData: updatedParty });
    setCombatResult(combatResult);
    navigation.navigate('Report', {
      roomId,
      roomWasCleared: combatResult.outcome === 'VICTORY',
    });
  }, [partyData, combatResult, updateProgress, setCombatResult, navigation, roomId]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleContinue();
      return true;
    });
    return () => sub.remove();
  }, [handleContinue]);

  // ── Derived display ──────────────────────────────────────────────────────────
  const outcomeColor = combatResult.outcome === 'VICTORY' ? '#00FF41' : '#FF3E3E';
  const visibleLog   = combatResult.log.slice(0, visibleLines);

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />

      {/* Party Portrait Banner */}
      {portrait ? (
        <View style={S.portraitBanner}>
          <Image source={{ uri: portrait }} style={S.portraitImg} resizeMode="cover" />
          <View style={S.portraitDimmer} />
          <View style={S.portraitHud}>
            <Text style={S.hudText}>FLOOR {activeFloor}  ·  CYCLE {activeCycle}</Text>
          </View>
        </View>
      ) : (
        <View style={S.noPortraitHud}>
          <Text style={S.hudText}>FLOOR {activeFloor}  ·  CYCLE {activeCycle}</Text>
        </View>
      )}

      <View style={{ flex: 1, padding: 16 }}>
        {/* Enemies Area */}
        <View className="flex-row items-center justify-around mb-3">
          {enemies.map((enemy, i) => {
            const finalState = combatResult.enemiesDefeated.find(
              e => e.name === enemy.displayName.toUpperCase().replace(/ /g, '_'),
            );
            const isDefeated = !!finalState || animationDone
              ? combatResult.enemiesDefeated.some(
                  e => e.name === enemy.displayName.toUpperCase().replace(/ /g, '_'),
                )
              : false;
            return (
              <View key={i} className="items-center">
                <View
                  className="w-16 h-24 border items-center justify-center"
                  style={{
                    borderColor: isDefeated ? 'rgba(255,62,62,0.3)' : '#FFB000',
                    backgroundColor: isDefeated ? 'rgba(255,62,62,0.05)' : 'rgba(255,176,0,0.08)',
                  }}
                >
                  <Text
                    className="font-robotomono text-center"
                    style={{
                      fontSize: 8,
                      color: isDefeated ? 'rgba(255,62,62,0.5)' : '#FFB000',
                    }}
                  >
                    {enemy.displayName.toUpperCase().replace(/ /g, '_')}
                  </Text>
                  {isDefeated && (
                    <Text className="font-robotomono" style={{ fontSize: 10, color: '#FF3E3E' }}>
                      ✗
                    </Text>
                  )}
                  {!isDefeated && (
                    <Text className="font-robotomono" style={{ fontSize: 7, color: 'rgba(255,176,0,0.5)' }}>
                      HP:{enemy.hp} AC:{enemy.ac}
                    </Text>
                  )}
                </View>
                <View
                  className="w-16 h-1 mt-1"
                  style={{ backgroundColor: isDefeated ? '#FF3E3E' : '#FFB000' }}
                />
              </View>
            );
          })}
        </View>

        {/* Battlefield separator */}
        <View className="border-y items-center justify-center py-2" style={{ borderColor: 'rgba(0,255,65,0.15)' }}>
          <Text className="font-robotomono" style={{ color: 'rgba(0,255,65,0.07)', fontSize: 32 }}>
            {t('battle.title')}
          </Text>
        </View>

        {/* Party row */}
        <View className="flex-row items-end justify-around py-3">
          {aliveParty.slice(0, 5).map((char, i) => {
            const afterData = combatResult.partyAfter.find(p => p.name === char.name);
            const displayHp  = animationDone ? (afterData?.hpAfter ?? char.hp) : char.hp;
            const displayMax = char.maxHp;
            const hpPct      = displayMax > 0 ? displayHp / displayMax : 0;
            const hpColor    = hpPct > 0.5 ? '#00FF41' : hpPct > 0.25 ? '#FFB000' : '#FF3E3E';
            const charPortrait = getCharPortrait(char, i);
            return (
              <View key={`${char.name}-${i}`} className="items-center" style={{ flex: 1 }}>
                <View
                  className="border mx-1"
                  style={{
                    width: 44, height: 56,
                    borderColor: i === 0 ? '#00FF41' : 'rgba(0,255,65,0.3)',
                    backgroundColor: i === 0 ? 'rgba(0,255,65,0.1)' : 'transparent',
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {charPortrait ? (
                    <Image
                      source={{ uri: charPortrait }}
                      style={{ position: 'absolute', width: 44, height: 56 }}
                      resizeMode="cover"
                    />
                  ) : null}
                  <View style={{
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: charPortrait ? 'rgba(10,14,10,0.45)' : 'transparent',
                    width: '100%', height: '100%',
                  }}>
                    <Text className="font-robotomono text-center" style={{ fontSize: 7, color: hpColor }}>
                      {char.name.substring(0, 6).toUpperCase()}
                    </Text>
                    <Text className="font-robotomono" style={{ fontSize: 6, color: 'rgba(0,229,255,0.7)' }}>
                      {char.charClass.substring(0, 4).toUpperCase()}
                    </Text>
                  </View>
                </View>
                {/* HP bar */}
                <View style={{ width: 44, height: 2, backgroundColor: 'rgba(255,255,255,0.1)', marginTop: 2 }}>
                  <View style={{ width: `${Math.round(hpPct * 100)}%`, height: 2, backgroundColor: hpColor }} />
                </View>
                <Text className="font-robotomono" style={{ fontSize: 6, color: 'rgba(0,255,65,0.5)', marginTop: 1 }}>
                  {displayHp}/{displayMax}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Combat Log */}
        <View
          className="border-2 p-2"
          style={{ borderColor: '#00FF41', backgroundColor: 'rgba(10,14,10,0.9)', height: 110 }}
        >
          <ScrollView ref={logScrollRef} showsVerticalScrollIndicator={false}>
            {visibleLog.map((entry, idx) => (
              <Text
                key={idx}
                className="font-robotomono"
                style={{ fontSize: 8, color: '#00FF41', marginBottom: 1, lineHeight: 13 }}
              >
                {entry}
              </Text>
            ))}
          </ScrollView>

          {/* Status tag bottom-right */}
          {animationDone ? (
            <View
              className="absolute bottom-2 right-2 px-2 py-1"
              style={{ backgroundColor: outcomeColor }}
            >
              <Text className="font-bold font-robotomono" style={{ fontSize: 9, color: '#0A0E0A' }}>
                {combatResult.outcome}
              </Text>
            </View>
          ) : (
            <View className="absolute bottom-2 right-2 px-2 py-1" style={{ backgroundColor: '#00FF41' }}>
              <Text className="font-bold font-robotomono" style={{ fontSize: 9, color: '#0A0E0A' }}>
                {t('battle.waitingAction')}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Continue button — only active once animation is done */}
      <TouchableOpacity
        onPress={handleContinue}
        disabled={!animationDone}
        className="absolute top-4 right-4 p-2"
        style={{ backgroundColor: animationDone ? outcomeColor : '#555' }}
      >
        <Text className="font-bold font-robotomono" style={{ fontSize: 9, color: '#0A0E0A' }}>
          {animationDone ? `→ ${t('battle.forceEnd')}` : '...'}
        </Text>
      </TouchableOpacity>

      <GlossaryButton />
    </View>
  );
};

const S = StyleSheet.create({
  portraitBanner: {
    height: 90,
    overflow: 'hidden',
  },
  portraitImg: {
    width: '100%',
    height: 90,
  },
  portraitDimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,14,10,0.55)',
  },
  portraitHud: {
    position: 'absolute',
    bottom: 6,
    left: 12,
  },
  noPortraitHud: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  hudText: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 9,
    color: 'rgba(0,255,65,0.7)',
    letterSpacing: 1,
  },
});
