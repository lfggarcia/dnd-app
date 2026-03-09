import React, { useEffect, useCallback, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, BackHandler, Image, StyleSheet } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { GlossaryButton } from '../components/GlossaryModal';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import {
  generateEnemiesForRoom,
  initCombat,
  checkCombatOutcome,
  advanceTurnLive,
  findNextLiveTurn,
  resolvePlayerAttack,
  resolvePlayerAbility,
  resolveEnemyTurn,
  buildCombatResultFromLive,
  createCombatRNG,
  CLASS_ABILITIES,
  type LiveCombatState,
} from '../services/combatEngine';
import { MONSTER_ILLUSTRATIONS } from '../constants/monsterIllustrations';
import type { ScreenProps } from '../navigation/types';

type UIPhase =
  | 'INITIATIVE'
  | 'PLAYER_ACTION'
  | 'PLAYER_TARGET_ATTACK'
  | 'PLAYER_TARGET_ABILITY'
  | 'ENEMY_AUTO'
  | 'ENDED';

export const BattleScreen = ({ navigation, route }: ScreenProps<'Battle'>) => {
  const { roomId, roomType } = route.params;
  const { t } = useI18n();

  // ── Store selectors ─────────────────────────────────────────────────────────
  const partyData      = useGameStore(s => s.activeGame?.partyData ?? []);
  const portrait       = useGameStore(s => s.activeGame?.partyPortrait ?? null);
  const portraitsMap   = useGameStore(s => s.activeGame?.portraitsJson ?? null);
  const activeFloor    = useGameStore(s => s.activeGame?.floor ?? 1);
  const activeCycle    = useGameStore(s => s.activeGame?.cycle ?? 1);
  const setCombatResult = useGameStore(s => s.setCombatResult);
  const updateProgress  = useGameStore(s => s.updateProgress);

  // ── Combat init (runs once on mount) ────────────────────────────────────────
  const rngRef = useRef(createCombatRNG(`combat_${roomId}`));
  const enemiesRef = useRef(generateEnemiesForRoom(roomType, roomId, activeCycle, activeFloor));

  const [cs, setCs] = useState<LiveCombatState>(() =>
    initCombat(partyData, enemiesRef.current, rngRef.current),
  );
  const [uiPhase, setUiPhase] = useState<UIPhase>('INITIATIVE');

  // Log auto-scroll
  const logScrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    logScrollRef.current?.scrollToEnd({ animated: false });
  }, [cs.log.length]);

  // ── Phase transition helpers ─────────────────────────────────────────────────
  const goToNextTurn = useCallback((state: LiveCombatState) => {
    const outcome = checkCombatOutcome(state);
    if (outcome) {
      const finalCs = { ...state, outcome };
      setCs(finalCs);
      // Persist results
      const result = buildCombatResultFromLive(finalCs, [], rngRef.current);
      const updatedParty = partyData.map(c => {
        const after = result.partyAfter.find(p => p.name === c.name);
        if (!after) return c;
        return { ...c, hp: after.hpAfter, alive: after.alive };
      });
      updateProgress({ partyData: updatedParty });
      setCombatResult(result);
      setUiPhase('ENDED');
      return;
    }
    const { state: nextState, phase } = findNextLiveTurn(state);
    setCs(nextState);
    setUiPhase(phase);
  }, [partyData, updateProgress, setCombatResult]);

  // ── Auto-advance from INITIATIVE after 2s ───────────────────────────────────
  useEffect(() => {
    if (uiPhase !== 'INITIATIVE') return;
    const timer = setTimeout(() => goToNextTurn(cs), 2000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiPhase]);

  // ── Auto-resolve enemy turns ─────────────────────────────────────────────────
  useEffect(() => {
    if (uiPhase !== 'ENEMY_AUTO') return;
    const actor = cs.turnOrder[cs.currentTurnIdx];
    if (actor?.type !== 'enemy') return;
    const timer = setTimeout(() => {
      const newCs = resolveEnemyTurn(cs, actor.idx, rngRef.current);
      const advanced = advanceTurnLive(newCs);
      goToNextTurn(advanced);
    }, 900);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiPhase, cs.currentTurnIdx, cs.round]);

  // ── Player action handlers ───────────────────────────────────────────────────
  const handleAttack = useCallback(() => {
    setUiPhase('PLAYER_TARGET_ATTACK');
  }, []);

  const handleAbility = useCallback(() => {
    const actor = cs.turnOrder[cs.currentTurnIdx];
    if (actor?.type !== 'party') return;
    const member = cs.partyState[actor.idx];
    const ability = CLASS_ABILITIES[member.charClass.toLowerCase()];
    if (!ability || member.abilityUsed) { handleAttack(); return; }

    if (ability.targetType === 'none' || ability.targetType === 'self') {
      const newCs = resolvePlayerAbility(cs, actor.idx, actor.idx, rngRef.current);
      const advanced = advanceTurnLive(newCs);
      goToNextTurn(advanced);
    } else {
      setUiPhase('PLAYER_TARGET_ABILITY');
    }
  }, [cs, handleAttack, goToNextTurn]);

  const handleSelectAttackTarget = useCallback((targetEnemyIdx: number) => {
    const actor = cs.turnOrder[cs.currentTurnIdx];
    if (actor?.type !== 'party') return;
    const newCs = resolvePlayerAttack(cs, actor.idx, targetEnemyIdx, rngRef.current);
    const advanced = advanceTurnLive(newCs);
    goToNextTurn(advanced);
  }, [cs, goToNextTurn]);

  const handleSelectAbilityTarget = useCallback((targetIdx: number) => {
    const actor = cs.turnOrder[cs.currentTurnIdx];
    if (actor?.type !== 'party') return;
    const newCs = resolvePlayerAbility(cs, actor.idx, targetIdx, rngRef.current);
    const advanced = advanceTurnLive(newCs);
    goToNextTurn(advanced);
  }, [cs, goToNextTurn]);

  const handleContinue = useCallback(() => {
    navigation.navigate('Report', {
      roomId,
      roomWasCleared: cs.outcome === 'VICTORY',
    });
  }, [cs.outcome, navigation, roomId]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (cs.outcome) handleContinue();
      return true;
    });
    return () => sub.remove();
  }, [handleContinue, cs.outcome]);

  // ── Derived display values ───────────────────────────────────────────────────
  const currentActor = cs.turnOrder[cs.currentTurnIdx];
  const currentPartyMember =
    currentActor?.type === 'party' ? cs.partyState[currentActor.idx] : null;
  const aliveEnemies = cs.enemyState.filter(e => !e.defeated);
  const alivePartyForAbility = cs.partyState.filter(p => p.currentHp > 0);
  const currentAbility = currentPartyMember
    ? CLASS_ABILITIES[currentPartyMember.charClass.toLowerCase()]
    : null;
  const abilityDisabled = !currentAbility || currentPartyMember?.abilityUsed;

  const outcomeColor = cs.outcome === 'VICTORY' ? '#00FF41' : '#FF3E3E';

  const getCharPortrait = (idx: number) => portraitsMap?.[String(idx)] ?? null;

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
          {cs.enemyState.map((enemy, i) => {
            const hpPct = enemy.hp > 0 ? enemy.currentHp / enemy.hp : 0;
            const label = enemy.displayName.toUpperCase().replace(/ /g, '_');
            return (
              <View key={i} className="items-center">
                <View
                  className="w-16 h-24 border items-center justify-center"
                  style={{
                    borderColor: enemy.defeated ? 'rgba(255,62,62,0.3)' : '#FFB000',
                    backgroundColor: enemy.defeated ? 'rgba(255,62,62,0.05)' : 'rgba(255,176,0,0.08)',
                    overflow: 'hidden',
                  }}
                >
                  {MONSTER_ILLUSTRATIONS[enemy.name] ? (
                    <Image
                      source={MONSTER_ILLUSTRATIONS[enemy.name]}
                      style={{ position: 'absolute', width: 64, height: 96 }}
                      resizeMode="cover"
                    />
                  ) : null}
                  <View style={{ position: 'absolute', width: 64, height: 96, backgroundColor: enemy.defeated ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.38)' }} />
                  <Text
                    className="font-robotomono text-center"
                    style={{ fontSize: 8, color: enemy.defeated ? 'rgba(255,62,62,0.8)' : '#FFB000' }}
                  >
                    {label}
                  </Text>
                  {enemy.defeated ? (
                    <Text className="font-robotomono" style={{ fontSize: 10, color: '#FF3E3E' }}>✗</Text>
                  ) : (
                    <>
                      <Text className="font-robotomono" style={{ fontSize: 7, color: 'rgba(255,176,0,0.9)' }}>
                        {enemy.currentHp}/{enemy.hp}
                      </Text>
                      <View style={{ width: 40, height: 2, backgroundColor: 'rgba(255,255,255,0.1)', marginTop: 2 }}>
                        <View style={{ width: `${Math.round(hpPct * 100)}%`, height: 2, backgroundColor: hpPct > 0.5 ? '#FFB000' : '#FF3E3E' }} />
                      </View>
                    </>
                  )}
                </View>
                <View className="w-16 h-1 mt-1" style={{ backgroundColor: enemy.defeated ? '#FF3E3E' : '#FFB000' }} />
              </View>
            );
          })}
        </View>

        {/* Battlefield separator */}
        <View className="border-y items-center justify-center py-1" style={{ borderColor: 'rgba(0,255,65,0.15)' }}>
          <Text className="font-robotomono" style={{ color: 'rgba(0,255,65,0.07)', fontSize: 28 }}>
            {t('battle.title')}
          </Text>
        </View>

        {/* Party row */}
        <View className="flex-row items-end justify-around py-2">
          {cs.partyState.slice(0, 5).map((char, i) => {
            const hpPct = char.maxHp > 0 ? char.currentHp / char.maxHp : 0;
            const hpColor = hpPct > 0.5 ? '#00FF41' : hpPct > 0.25 ? '#FFB000' : '#FF3E3E';
            const isCurrentTurn = currentPartyMember?.name === char.name;
            const charPortrait = getCharPortrait(i);
            return (
              <View key={`${char.name}-${i}`} className="items-center" style={{ flex: 1 }}>
                <View
                  className="border mx-1"
                  style={{
                    width: 44, height: 56,
                    borderColor: isCurrentTurn ? '#00FF41' : 'rgba(0,255,65,0.3)',
                    backgroundColor: isCurrentTurn ? 'rgba(0,255,65,0.1)' : 'transparent',
                    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
                    opacity: char.currentHp <= 0 ? 0.35 : 1,
                  }}
                >
                  {charPortrait ? (
                    <Image source={{ uri: charPortrait }} style={{ position: 'absolute', width: 44, height: 56 }} resizeMode="cover" />
                  ) : null}
                  <View style={{ alignItems: 'center', justifyContent: 'center', backgroundColor: charPortrait ? 'rgba(10,14,10,0.45)' : 'transparent', width: '100%', height: '100%' }}>
                    <Text className="font-robotomono text-center" style={{ fontSize: 7, color: hpColor }}>
                      {char.name.substring(0, 6).toUpperCase()}
                    </Text>
                    <Text className="font-robotomono" style={{ fontSize: 6, color: 'rgba(0,229,255,0.7)' }}>
                      {char.charClass.substring(0, 4).toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={{ width: 44, height: 2, backgroundColor: 'rgba(255,255,255,0.1)', marginTop: 2 }}>
                  <View style={{ width: `${Math.round(hpPct * 100)}%`, height: 2, backgroundColor: hpColor }} />
                </View>
                <Text className="font-robotomono" style={{ fontSize: 6, color: 'rgba(0,255,65,0.5)', marginTop: 1 }}>
                  {char.currentHp}/{char.maxHp}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Combat Log */}
        <View
          className="border-2 p-2"
          style={{ borderColor: '#00FF41', backgroundColor: 'rgba(10,14,10,0.9)', height: 100 }}
        >
          <ScrollView ref={logScrollRef} showsVerticalScrollIndicator={false}>
            {cs.log.map((entry, idx) => (
              <Text
                key={idx}
                className="font-robotomono"
                style={{ fontSize: 9, color: '#00FF41', marginBottom: 1, lineHeight: 14 }}
              >
                {entry}
              </Text>
            ))}
          </ScrollView>
        </View>

        {/* ── Action Panel ── */}
        <View
          style={{
            marginTop: 8,
            borderWidth: 1,
            borderColor: 'rgba(0,255,65,0.3)',
            backgroundColor: 'rgba(10,14,10,0.95)',
            padding: 10,
            minHeight: 80,
          }}
        >
          {/* INITIATIVE phase */}
          {uiPhase === 'INITIATIVE' && (
            <View className="items-center justify-center" style={{ flex: 1 }}>
              <Text className="font-robotomono" style={{ fontSize: 10, color: '#FFB000', letterSpacing: 2 }}>
                TIRANDO INICIATIVA...
              </Text>
            </View>
          )}

          {/* PLAYER_ACTION phase */}
          {uiPhase === 'PLAYER_ACTION' && currentPartyMember && (
            <View>
              <Text className="font-robotomono" style={{ fontSize: 10, color: 'rgba(0,255,65,0.6)', marginBottom: 8 }}>
                TURNO DE {currentPartyMember.name.toUpperCase()} — ELIGE ACCION:
              </Text>
              <View className="flex-row" style={{ columnGap: 8 }}>
                <TouchableOpacity
                  onPress={handleAttack}
                  style={[S.actionBtn, { borderColor: '#FFB000', flex: 1 }]}
                >
                  <Text className="font-bold font-robotomono" style={{ fontSize: 11, color: '#FFB000' }}>
                    ATACAR
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAbility}
                  disabled={!!abilityDisabled}
                  style={[S.actionBtn, {
                    borderColor: abilityDisabled ? 'rgba(0,255,65,0.2)' : '#00FF41',
                    flex: 1,
                    opacity: abilityDisabled ? 0.4 : 1,
                  }]}
                >
                  <Text className="font-bold font-robotomono" style={{ fontSize: 10, color: abilityDisabled ? 'rgba(0,255,65,0.4)' : '#00FF41' }}>
                    {currentAbility?.name ?? 'HABILIDAD'}
                  </Text>
                  {currentAbility && (
                    <Text className="font-robotomono" style={{ fontSize: 8, color: 'rgba(0,255,65,0.6)', marginTop: 2 }}>
                      {currentAbility.description}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* PLAYER_TARGET_ATTACK phase */}
          {uiPhase === 'PLAYER_TARGET_ATTACK' && (
            <View>
              <Text className="font-robotomono" style={{ fontSize: 10, color: 'rgba(0,255,65,0.6)', marginBottom: 6 }}>
                ELIGE OBJETIVO:
              </Text>
              <View className="flex-row flex-wrap" style={{ columnGap: 6, rowGap: 6 }}>
                {aliveEnemies.map((enemy) => (
                  <TouchableOpacity
                    key={enemy.instanceId}
                    onPress={() => handleSelectAttackTarget(enemy.instanceId)}
                    style={[S.actionBtn, { borderColor: '#FF3E3E' }]}
                  >
                    <Text className="font-robotomono" style={{ fontSize: 9, color: '#FF3E3E' }}>
                      {enemy.displayName.toUpperCase().replace(/ /g, '_')}
                    </Text>
                    <Text className="font-robotomono" style={{ fontSize: 8, color: 'rgba(255,62,62,0.7)' }}>
                      HP {enemy.currentHp}/{enemy.hp}  CA {enemy.ac}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* PLAYER_TARGET_ABILITY phase */}
          {uiPhase === 'PLAYER_TARGET_ABILITY' && currentPartyMember && currentAbility && (
            <View>
              <Text className="font-robotomono" style={{ fontSize: 10, color: 'rgba(0,255,65,0.6)', marginBottom: 6 }}>
                {currentAbility.name}: ELIGE OBJETIVO
              </Text>
              <View className="flex-row flex-wrap" style={{ columnGap: 6, rowGap: 6 }}>
                {currentAbility.targetType === 'enemy'
                  ? aliveEnemies.map((enemy) => (
                      <TouchableOpacity
                        key={enemy.instanceId}
                        onPress={() => handleSelectAbilityTarget(enemy.instanceId)}
                        style={[S.actionBtn, { borderColor: '#FF3E3E' }]}
                      >
                        <Text className="font-robotomono" style={{ fontSize: 9, color: '#FF3E3E' }}>
                          {enemy.displayName.toUpperCase().replace(/ /g, '_')}
                        </Text>
                        <Text className="font-robotomono" style={{ fontSize: 8, color: 'rgba(255,62,62,0.7)' }}>
                          HP {enemy.currentHp}/{enemy.hp}
                        </Text>
                      </TouchableOpacity>
                    ))
                  : alivePartyForAbility.map((ally) => (
                      <TouchableOpacity
                        key={ally.name}
                        onPress={() => handleSelectAbilityTarget(cs.partyState.findIndex(p => p.name === ally.name))}
                        style={[S.actionBtn, { borderColor: '#00FF41' }]}
                      >
                        <Text className="font-robotomono" style={{ fontSize: 9, color: '#00FF41' }}>
                          {ally.name.toUpperCase()}
                        </Text>
                        <Text className="font-robotomono" style={{ fontSize: 8, color: 'rgba(0,255,65,0.7)' }}>
                          {ally.charClass.toUpperCase()}  HP {ally.currentHp}/{ally.maxHp}
                        </Text>
                      </TouchableOpacity>
                    ))}
              </View>
            </View>
          )}

          {/* ENEMY_AUTO phase */}
          {uiPhase === 'ENEMY_AUTO' && (
            <View className="items-center justify-center" style={{ flex: 1 }}>
              <Text className="font-robotomono" style={{ fontSize: 10, color: '#FF3E3E', letterSpacing: 2 }}>
                TURNO ENEMIGO...
              </Text>
            </View>
          )}

          {/* ENDED phase */}
          {uiPhase === 'ENDED' && (
            <View className="items-center justify-center" style={{ flex: 1 }}>
              <Text className="font-bold font-robotomono" style={{ fontSize: 18, color: outcomeColor, letterSpacing: 3 }}>
                {cs.outcome}
              </Text>
              <TouchableOpacity
                onPress={handleContinue}
                className="mt-3 px-6 py-2"
                style={{ backgroundColor: outcomeColor }}
              >
                <Text className="font-bold font-robotomono" style={{ fontSize: 11, color: '#0A0E0A' }}>
                  {'>> CONTINUAR'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

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
    fontSize: 10,
    color: 'rgba(0,255,65,0.7)',
    letterSpacing: 1,
  },
  actionBtn: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: 'center',
  },
});
