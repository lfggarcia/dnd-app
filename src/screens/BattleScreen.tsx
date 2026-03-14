import React, {
  useEffect, useCallback, useState, useRef, useMemo, memo,
} from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, BackHandler,
  Image, Animated, StyleSheet, Dimensions, Platform, Modal,
  type ImageSourcePropType,
} from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
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
  resolvePlayerDodge,
  resolvePlayerDash,
  resolvePlayerHelp,
  resolveEnemyTurn,
  buildCombatResultFromLive,
  createCombatRNG,
  CLASS_ABILITIES,
  type LiveCombatState,
  type LivePartyMember,
  type LiveEnemy,
  type TurnActor,
  type ClassAbility,
  type CombatEvent,
} from '../services/combatEngine';
import {
  resolveEmotion,
  tickEmotionDurations,
  isSignificantEvent,
  type PartyEmotionalState,
  type EmotionState,
} from '../services/emotionalNarrativeService';
import { NarrativeMomentPanel } from '../components/NarrativeMomentPanel';
import { MONSTER_ILLUSTRATIONS } from '../constants/monsterIllustrations';
import { awardXP } from '../services/progressionService';
import type { XPRewardSource } from '../services/progressionService';
import {
  applyMoralEvent,
  checkForAbandonment,
  generateReplacementAdventurer,
} from '../services/moralSystem';
import { isBossLootClaimed } from '../database/itemRepository';
import { recordPartyKill } from '../services/bountyService';
import { resolveEssenceDrop } from '../services/essenceService';
import { saveEssenceDrop, incrementMonsterKills } from '../database/essenceRepository';
import type { ScreenProps } from '../navigation/types';

// ── Types ──────────────────────────────────────────────────────────────────────

type UIPhase =
  | 'INITIATIVE'
  | 'PLAYER_ACTION'
  | 'PLAYER_TARGET_ATTACK'
  | 'PLAYER_TARGET_ABILITY'
  | 'ENEMY_AUTO'
  | 'ENDED';

// ── Layout budget (everything fits without scrolling) ──────────────────────────

const SCREEN_W        = Dimensions.get('window').width;
const SCREEN_H        = Dimensions.get('window').height;
const HUD_H           = 30;
const TIMELINE_H      = 74;   // 50px circles + padding
const LOG_STRIP_H     = 82;   // dedicated log row below enemies
const PARTY_STRIP_H   = 150;  // horizontal party portrait card row
const ACTION_H        = 72;
const APPROX_STATUS_H = Platform.OS === 'ios' ? 50 : 24;

const TOKEN_DIAM = 50;        // timeline circles

// Enemy width: full screen divided equally (max 4 visible per row)
const ENEMY_MAX_W = Math.min(Math.floor((SCREEN_W - 20) / 4), 160);

// ── Turn Timeline ──────────────────────────────────────────────────────────────

type TokenProps = {
  actor: TurnActor;
  index: number;
  currentTurnIdx: number;
  portraitSource: ImageSourcePropType | null;
  isDead: boolean;
};

const TurnToken = memo(({ actor, index, currentTurnIdx, portraitSource, isDead }: TokenProps) => {
  const isPast    = index < currentTurnIdx;
  const isCurrent = index === currentTurnIdx;
  const color     = actor.type === 'party' ? '#00FF41' : '#FF4444';

  return (
    <View style={[S.tokenWrap, { opacity: isPast || isDead ? 0.25 : 1 }]}>
      <View
        style={[
          S.tokenCircle,
          {
            borderColor:     isCurrent ? color : `${color}50`,
            borderWidth:     isCurrent ? 2.5 : 1.5,
            backgroundColor: isCurrent ? `${color}18` : '#0f1a0f',
          },
        ]}
      >
        {portraitSource != null && (
          <Image
            source={portraitSource}
            style={S.tokenImg}
            resizeMode="cover"
          />
        )}
        {portraitSource == null && (
          <Text style={[S.tokenFallback, { color }]}>?</Text>
        )}
        {isDead && (
          <View style={S.tokenDeadLayer}>
            <Text style={S.tokenDeadX}>✗</Text>
          </View>
        )}
      </View>
      {isCurrent && <View style={[S.tokenDot, { backgroundColor: color }]} />}
    </View>
  );
});

type TimelineProps = {
  turnOrder: TurnActor[];
  currentTurnIdx: number;
  portraitSources: Array<ImageSourcePropType | null>;
  deadFlags: boolean[];
};

const TurnTimeline = memo(({
  turnOrder, currentTurnIdx, portraitSources, deadFlags,
}: TimelineProps) => (
  <View style={S.timelineWrap}>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={S.timelineScroll}
      contentContainerStyle={S.timelineContent}
    >
      {turnOrder.map((actor, i) => (
        <TurnToken
          key={`${actor.type}-${actor.idx}-${i}`}
          actor={actor}
          index={i}
          currentTurnIdx={currentTurnIdx}
          portraitSource={portraitSources[i] ?? null}
          isDead={deadFlags[i] ?? false}
        />
      ))}
    </ScrollView>
  </View>
));

// ── Enemy Card ─────────────────────────────────────────────────────────────────

type EnemyCardProps = {
  enemy: LiveEnemy;
  isTargetable: boolean;
  uiPhase: UIPhase;
  onAttackTarget: (id: number) => void;
  onAbilityTarget: (id: number) => void;
};

const EnemyCard = memo(({
  enemy, isTargetable, uiPhase, onAttackTarget, onAbilityTarget,
}: EnemyCardProps) => {
  const hpPct   = enemy.hp > 0 ? enemy.currentHp / enemy.hp : 0;
  const hpColor = hpPct > 0.5 ? '#FFB000' : hpPct > 0.25 ? '#FF8000' : '#FF3E3E';
  const illus   = MONSTER_ILLUSTRATIONS[enemy.name];

  const handlePress = useCallback(() => {
    if (uiPhase === 'PLAYER_TARGET_ATTACK') onAttackTarget(enemy.instanceId);
    else if (uiPhase === 'PLAYER_TARGET_ABILITY') onAbilityTarget(enemy.instanceId);
  }, [uiPhase, enemy.instanceId, onAttackTarget, onAbilityTarget]);

  const inner = (
    <View
      style={[
        S.enemyCard,
        {
          borderColor: isTargetable
            ? '#FF3E3E'
            : enemy.defeated
            ? 'rgba(255,62,62,0.08)'
            : 'rgba(255,176,0,0.18)',
          opacity: enemy.defeated ? 0.38 : 1,
        },
      ]}
    >
      {/* Illustration fills all available vertical space */}
      <View style={S.enemyIllus}>
        {illus != null ? (
          <Image
            source={illus}
            style={S.enemyIllusImg}
            resizeMode="cover"
          />
        ) : (
          <Text style={S.enemyPlaceholder}>?</Text>
        )}
        {/* Gradient vignette at bottom for text readability */}
        <View style={S.enemyVignette} />
        {enemy.defeated && (
          <View style={S.enemyDeadOverlay}>
            <Text style={S.enemyDeadGlyph}>✗</Text>
          </View>
        )}
        {isTargetable && <View style={S.targetRing} />}
        {/* Name & HP pinned inside the image at bottom */}
        <View style={S.enemyInfoPin}>
          <Text
            style={[S.enemyName, { color: enemy.defeated ? 'rgba(255,62,62,0.5)' : '#FFE080' }]}
            numberOfLines={2}
          >
            {enemy.displayName.toUpperCase()}
          </Text>
          {!enemy.defeated ? (
            <>
              <View style={S.enemyHpTrack}>
                <View
                  style={[S.enemyHpFill, {
                    width: `${Math.round(hpPct * 100)}%`,
                    backgroundColor: hpColor,
                  }]}
                />
              </View>
              <Text style={[S.enemyHpLabel, { color: `${hpColor}bb` }]}>
                {enemy.currentHp}/{enemy.hp}
              </Text>
            </>
          ) : (
            <Text style={S.defeatedText}>DEFEATED</Text>
          )}
        </View>
      </View>
    </View>
  );

  if (!isTargetable || enemy.defeated) return inner;
  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.72} style={S.enemyCardTouch}>
      {inner}
    </TouchableOpacity>
  );
});

// ── Party Card (horizontal bottom strip, mirroring enemy card style) ──────────

type PartyCardProps = {
  char: LivePartyMember;
  portrait: string | null;
  isCurrentTurn: boolean;
  isTargetable: boolean;
  partyIdx: number;
  onAllyTarget: (idx: number) => void;
};

const PartyCard = memo(({
  char, portrait, isCurrentTurn, isTargetable, partyIdx, onAllyTarget,
}: PartyCardProps) => {
  const hpPct   = char.maxHp > 0 ? char.currentHp / char.maxHp : 0;
  const hpColor = char.currentHp <= 0
    ? '#FF3E3E'
    : hpPct > 0.5 ? '#00FF41' : hpPct > 0.25 ? '#FFB000' : '#FF3E3E';
  const borderColor = isCurrentTurn
    ? '#00FF41'
    : isTargetable
    ? '#4DBBFF'
    : char.currentHp <= 0
    ? 'rgba(255,62,62,0.15)'
    : `${hpColor}40`;

  const handlePress = useCallback(() => onAllyTarget(partyIdx), [onAllyTarget, partyIdx]);

  const inner = (
    <View style={[S.partyCard, { borderColor, opacity: char.currentHp <= 0 ? 0.35 : 1 }]}>
      {/* Portrait fills entire card */}
      <View style={S.partyIllus}>
        {portrait != null ? (
          <Image
            source={{ uri: portrait }}
            style={S.partyIllusImg}
            resizeMode="cover"
          />
        ) : (
          <Text style={S.partyPlaceholder}>{char.name.charAt(0).toUpperCase()}</Text>
        )}
        {/* Bottom vignette for text legibility */}
        <View style={S.partyVignette} />
        {isCurrentTurn && (
          <View style={[StyleSheet.absoluteFillObject, S.partyActivePulse]} />
        )}
        {isTargetable && <View style={S.partyTargetRing} />}
        {/* Name + HP pinned at bottom inside portrait */}
        <View style={S.partyInfoPin}>
          <Text style={[S.partyName, { color: char.currentHp <= 0 ? 'rgba(255,62,62,0.5)' : '#d0f0c0' }]} numberOfLines={1}>
            {char.name.substring(0, 9).toUpperCase()}
          </Text>
          {char.currentHp > 0 ? (
            <>
              <View style={S.partyHpTrack}>
                <View style={[S.partyHpFill, { width: `${Math.round(hpPct * 100)}%`, backgroundColor: hpColor }]} />
              </View>
              <Text style={[S.partyHpLabel, { color: `${hpColor}bb` }]}>
                {char.currentHp}/{char.maxHp}
              </Text>
            </>
          ) : (
            <Text style={S.partyDeadText}>KO</Text>
          )}
        </View>
      </View>
    </View>
  );

  if (!isTargetable || char.currentHp <= 0) return inner;
  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.72} style={S.partyCardTouch}>
      {inner}
    </TouchableOpacity>
  );
});

// ── Combat Log Strip ────────────────────────────────────────────────────────────

const LOG_COLORS = {
  defeat:  'rgba(255,62,62,0.9)',
  heal:    'rgba(77,187,255,0.9)',
  ability: 'rgba(255,176,0,0.9)',
  default: 'rgba(0,255,65,0.75)',
} as const;

const getLogColor = (e: string): string => {
  const l = e.toLowerCase();
  if (l.includes('derrotado') || l.includes('muere') || l.includes('defeat')) return LOG_COLORS.defeat;
  if (l.includes('cura') || l.includes('sana') || l.includes('restaura'))     return LOG_COLORS.heal;
  if (l.includes('furia') || l.includes('habilidad') || l.includes(' usa '))  return LOG_COLORS.ability;
  return LOG_COLORS.default;
};

const LogStrip = memo(({ log }: { log: string[] }) => {
  const last = log[log.length - 1] ?? '';
  const prev = log[log.length - 2] ?? '';
  const prev2 = log[log.length - 3] ?? '';
  return (
    <View style={S.logStrip}>
      {prev2 !== '' && (
        <Text style={[S.logEntry, { color: getLogColor(prev2), opacity: 0.35 }]} numberOfLines={1}>
          {'> '}{prev2}
        </Text>
      )}
      {prev !== '' && (
        <Text style={[S.logEntry, { color: getLogColor(prev), opacity: 0.55 }]} numberOfLines={1}>
          {'> '}{prev}
        </Text>
      )}
      {last !== '' && (
        <Text style={[S.logEntry, { color: getLogColor(last), opacity: 0.92 }]} numberOfLines={1}>
          {'> '}{last}
        </Text>
      )}
    </View>
  );
});

// ── Defeat Animation ─────────────────────────────────────────────────────────────

const DefeatAnimation = memo(({ source }: { source: ImageSourcePropType }) => {
  const scale   = useRef(new Animated.Value(0.6)).current;
  const rotDeg  = useRef(new Animated.Value(-5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(scale,   { toValue: 1.0, damping: 18, stiffness: 70, useNativeDriver: true }),
      Animated.timing(rotDeg,  { toValue: 4, duration: 1100, useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotate = rotDeg.interpolate({ inputRange: [-5, 4], outputRange: ['-5deg', '4deg'] });

  const cardW = ENEMY_MAX_W * 2.5;
  const cardH = ENEMY_MAX_W * 3.2;

  return (
    <View style={S.defeatOverlay}>
      <Animated.View
        style={{
          width: cardW,
          height: cardH,
          opacity,
          transform: [{ scale }, { rotate }],
          borderRadius: 3,
          borderWidth: 3,
          borderColor: '#FF3E3E',
          overflow: 'hidden',
          shadowColor: '#CC1010',
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 22,
          shadowOpacity: 1,
          elevation: 20,
        }}
      >
        <Image source={source} style={{ width: cardW, height: cardH}} resizeMode="cover" />
      </Animated.View>
    </View>
  );
});

// ── Main Screen ────────────────────────────────────────────────────────────────

/** Derive typed CombatEvents from new log lines for real-time emotion updates */
function deriveEventsFromLogLines(
  newLines: string[],
  state: LiveCombatState,
  turn: number,
): CombatEvent[] {
  const events: CombatEvent[] = [];
  for (const line of newLines) {
    if (line.includes('CRIT!')) {
      const isParty = state.partyState.some(m => line.startsWith(`  ${m.name.toUpperCase()}`));
      const actor = state.partyState.find(m => line.startsWith(`  ${m.name.toUpperCase()}`))?.name ?? '';
      events.push({ type: isParty ? 'CRIT_DEALT' : 'CRIT_RECEIVED', actorName: actor, turn });
    }
    if (line.includes('CAÍDO') || line.includes('CAIDA') || line.includes('0 HP')) {
      const victim = state.partyState.find(m => line.includes(m.name.toUpperCase()) && m.currentHp <= 0);
      if (victim) {
        events.push({ type: 'ALLY_DOWN', actorName: victim.name, turn });
      }
    }
    if (line.includes('nat 1')) {
      const actor = state.partyState.find(m => line.includes(m.name.toUpperCase()))?.name ?? '';
      if (actor) events.push({ type: 'NAT_ONE', actorName: actor, turn });
    }
  }
  return events;
}

// Stable fallback references — must live outside the component so they never
// change identity between renders. Using inline `?? []` / `?? {}` inside a
// Zustand selector would create a new object on every call and cause
// useSyncExternalStore to loop infinitely.
const EMPTY_PARTY_DATA: import('../database/gameRepository').CharacterSave[] = [];
const EMPTY_EXPRESSIONS_JSON: Record<number, Record<string, string>> = {};

export const BattleScreen = ({ navigation, route }: ScreenProps<'Battle'>) => {
  const { roomId, roomType } = route.params;
  const { t } = useI18n();

  // ── Store selectors ─────────────────────────────────────────────────────────
  const partyData       = useGameStore(s => s.activeGame?.partyData ?? EMPTY_PARTY_DATA);
  const portraitsMap    = useGameStore(s => s.activeGame?.portraitsJson ?? null);
  const expressionsJson = useGameStore(s => s.activeGame?.expressionsJson ?? EMPTY_EXPRESSIONS_JSON);
  const activeFloor     = useGameStore(s => s.activeGame?.floor ?? 1);
  const activeCycle     = useGameStore(s => s.activeGame?.cycle ?? 1);
  const seedHash        = useGameStore(s => s.activeGame?.seedHash ?? '');
  const activeGameId    = useGameStore(s => s.activeGame?.id ?? '');
  const mapState        = useGameStore(s => s.activeGame?.mapState ?? null);
  const setCombatResult = useGameStore(s => s.setCombatResult);
  const updateProgress  = useGameStore(s => s.updateProgress);

  // ── Combat init (once on mount) ─────────────────────────────────────────────
  const rngRef     = useRef(createCombatRNG(`combat_${roomId}`));
  const enemiesRef = useRef(generateEnemiesForRoom(roomType, roomId, activeCycle, activeFloor));

  const [cs, setCs]           = useState<LiveCombatState>(() =>
    initCombat(partyData, enemiesRef.current, rngRef.current));
  const [uiPhase, setUiPhase] = useState<UIPhase>('INITIATIVE');
  const [showTacticalPicker, setShowTacticalPicker] = useState(false);
  const [partyEmotions, setPartyEmotions] = useState<PartyEmotionalState>({});
  const [activeMoment, setActiveMoment]   = useState<{
    charName: string;
    emotion:  EmotionState;
  } | null>(null);
  const [desertionEvent, setDesertionEvent] = useState<{
    deserters: import('../database/gameRepository').CharacterSave[];
    replacements: import('../database/gameRepository').CharacterSave[];
    log: string[];
  } | null>(null);
  const momentCountRef = useRef(0);
  /** RI-08: track last round a narrative panel of each event type was shown */
  const lastNarrativeRoundRef = useRef<Record<string, number>>({});
  const bossLootClaimedRef = useRef(false);

  // Check on mount if boss loot was already claimed for this room
  useEffect(() => {
    if (roomType === 'BOSS' && seedHash) {
      try {
        bossLootClaimedRef.current = isBossLootClaimed(seedHash, roomId);
      } catch {
        bossLootClaimedRef.current = false;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tick emotion durations on turn advance ────────────────────────────────
  useEffect(() => {
    if (cs.currentTurnIdx > 0) {
      setPartyEmotions(prev => tickEmotionDurations(prev));
    }
  }, [cs.currentTurnIdx]);

  // ── Process emotion events after each combat action ────────────────────────
  const processEmotionEvents = useCallback((events: CombatEvent[]) => {
    for (const event of events) {
      const char = partyData.find(c =>
        c.name === event.actorName || c.name === event.targetName,
      );
      if (!char) continue;

      setPartyEmotions(prev => {
        const current = prev[char.name] ?? null;
        const newEmotion = resolveEmotion(event, char, current);
        if (isSignificantEvent(event.type) && momentCountRef.current < 3) {
          // RI-08: enforce ≥2 round cooldown between panels of the same event type
          const lastRound = lastNarrativeRoundRef.current[event.type] ?? -99;
          const currentRound = cs.round;
          if (currentRound - lastRound >= 2) {
            momentCountRef.current += 1;
            lastNarrativeRoundRef.current = {
              ...lastNarrativeRoundRef.current,
              [event.type]: currentRound,
            };
            setActiveMoment({ charName: char.name, emotion: newEmotion });
          }
        }
        return { ...prev, [char.name]: newEmotion };
      });
    }
  }, [partyData, cs.round]);

  // ── Phase transitions ────────────────────────────────────────────────────────
  const goToNextTurn = useCallback((state: LiveCombatState) => {
    const outcome = checkCombatOutcome(state);
    if (outcome) {
      const finalCs = { ...state, outcome };
      setCs(finalCs);
      const result = buildCombatResultFromLive(finalCs, [], rngRef.current);

      // Map RoomType → XPRewardSource
      const xpSourceMap: Partial<Record<string, XPRewardSource>> = {
        NORMAL: 'MONSTER',
        EVENT: 'MONSTER',
        SECRET: 'MONSTER',
        TREASURE: 'MONSTER',
        ELITE: 'ELITE_MONSTER',
        BOSS: 'BOSS',
      };
      const xpSource: XPRewardSource = xpSourceMap[roomType] ?? 'MONSTER';

      // Build updated party: sync HP/alive, increment deathCount for newly-dead,
      // then award XP on victory.
      let updatedParty = partyData.map(c => {
        const after = result.partyAfter.find(p => p.characterId === c.characterId);
        if (!after) return c;
        const diedInBattle = c.alive && !after.alive;
        return {
          ...c,
          hp: after.hpAfter,
          alive: after.alive,
          deathCount: diedInBattle ? (c.deathCount ?? 0) + 1 : (c.deathCount ?? 0),
        };
      });

      if (outcome === 'VICTORY') {
        updatedParty = awardXP(updatedParty, xpSource);
        updatedParty = applyMoralEvent(updatedParty, roomType === 'BOSS' ? 'BOSS_DEFEATED' : 'KILL_MONSTER');

        // Record a kill if this was a rival party room (RT-04 / FIX-04)
        if (roomId.startsWith('rival_') && activeGameId && seedHash) {
          const rivalName = roomId.replace('rival_', '');
          recordPartyKill(activeGameId, seedHash, rivalName, activeCycle, activeFloor);
        }

        // Essence drops for each defeated monster (Sprint 7 / Paso 7-06)
        if (activeGameId && seedHash) {
          for (const enemy of result.enemiesDefeated) {
            const monsterKey = enemy.name;
            for (const aliveChar of updatedParty.filter(c => c.alive)) {
              incrementMonsterKills(activeGameId, aliveChar.name, monsterKey, activeCycle, seedHash);
              const drop = resolveEssenceDrop(monsterKey, monsterKey, roomId, seedHash, activeCycle);
              if (drop) {
                saveEssenceDrop({
                  ...drop,
                  killsOnThisType: drop.killsOnThisType,
                  ownerGameId: activeGameId,
                  ownerCharName: aliveChar.name,
                  obtainedCycle: activeCycle,
                  obtainedFloor: activeFloor,
                  seedHash,
                });
              }
            }
          }
        }
      } else {
        updatedParty = applyMoralEvent(updatedParty, 'DEFEAT_IN_COMBAT');
      }

      // Apply PARTY_MEMBER_DIED for each ally that died this combat
      const diedThisCombat = updatedParty.filter(
        (c, i) => partyData[i]?.alive && !c.alive
      ).length;
      for (let i = 0; i < diedThisCombat; i++) {
        updatedParty = applyMoralEvent(updatedParty, 'PARTY_MEMBER_DIED');
      }

      // GAP-02: check for desertion after moral events (defeat/death path)
      if (outcome === 'DEFEAT' || diedThisCombat > 0) {
        const abandonResult = checkForAbandonment(updatedParty, seedHash, activeCycle);
        if (abandonResult.abandoned.length > 0) {
          const replacements = abandonResult.abandoned.map(d =>
            generateReplacementAdventurer(d, activeCycle)
          );
          updatedParty = [...abandonResult.remained, ...replacements];
          setDesertionEvent({
            deserters: abandonResult.abandoned,
            replacements,
            log: abandonResult.log,
          });
        }
      }

      // Reset narrative moment counter for next combat
      momentCountRef.current = 0;

      // BUG-04/05: clear combatRoomId and mark room visited on victory
      const roomIdNum = Number(roomId);
      let updatedMapState: string | null = null;
      if (outcome === 'VICTORY' && mapState) {
        try {
          const parsed = JSON.parse(mapState) as { floorIndex: number; visitedRoomIds: number[]; revealedRoomIds: number[]; currentRoomId: number };
          if (!parsed.visitedRoomIds.includes(roomIdNum)) {
            parsed.visitedRoomIds.push(roomIdNum);
          }
          updatedMapState = JSON.stringify(parsed);
        } catch { /* leave mapState unchanged */ }
      }

      updateProgress({
        partyData: updatedParty,
        combatRoomId: null,
        combatRoomType: null,
        ...(updatedMapState ? { mapState: updatedMapState } : {}),
      });
      setCombatResult(result);
      setUiPhase('ENDED');
      return;
    }
    const { state: nextState, phase } = findNextLiveTurn(state);
    setCs(nextState);
    setUiPhase(phase);
  }, [partyData, roomType, roomId, mapState, updateProgress, setCombatResult]);

  useEffect(() => {
    if (uiPhase !== 'INITIATIVE') return;
    const timer = setTimeout(() => goToNextTurn(cs), 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiPhase]);

  useEffect(() => {
    if (uiPhase !== 'ENEMY_AUTO') return;
    const actor = cs.turnOrder[cs.currentTurnIdx];
    if (actor?.type !== 'enemy') return;
    const timer = setTimeout(() => {
      const newCs    = resolveEnemyTurn(cs, actor.idx, rngRef.current);
      const advanced = advanceTurnLive(newCs);
      goToNextTurn(advanced);
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiPhase, cs.currentTurnIdx, cs.round]);

  // ── Player action handlers ───────────────────────────────────────────────────
  const handleAttack = useCallback(() => setUiPhase('PLAYER_TARGET_ATTACK'), []);

  const handleAbility = useCallback(() => {
    const actor = cs.turnOrder[cs.currentTurnIdx];
    if (actor?.type !== 'party') return;
    const member  = cs.partyState[actor.idx];
    const ability = CLASS_ABILITIES[member.charClass.toLowerCase()];
    if (!ability || member.abilityUsed) { handleAttack(); return; }
    if (ability.targetType === 'none' || ability.targetType === 'self') {
      const newCs    = resolvePlayerAbility(cs, actor.idx, actor.idx, rngRef.current);
      const advanced = advanceTurnLive(newCs);
      goToNextTurn(advanced);
    } else {
      setUiPhase('PLAYER_TARGET_ABILITY');
    }
  }, [cs, handleAttack, goToNextTurn]);

  const handleTactic = useCallback((tactic: 'DODGE' | 'DASH' | 'HELP') => {
    setShowTacticalPicker(false);
    const actor = cs.turnOrder[cs.currentTurnIdx];
    if (actor?.type !== 'party') return;
    let newCs: LiveCombatState;
    if (tactic === 'DODGE') {
      newCs = resolvePlayerDodge(cs, actor.idx);
    } else if (tactic === 'DASH') {
      newCs = resolvePlayerDash(cs, actor.idx);
    } else {
      // HELP: assist a random alive ally (not self)
      const aliveAllies = cs.partyState
        .map((m, i) => ({ m, i }))
        .filter(({ m, i }) => m.currentHp > 0 && i !== actor.idx);
      const helpTarget = aliveAllies.length > 0
        ? aliveAllies[0].i
        : actor.idx;
      newCs = resolvePlayerHelp(cs, actor.idx, helpTarget);
    }
    const advanced = advanceTurnLive(newCs);
    goToNextTurn(advanced);
  }, [cs, goToNextTurn]);

  const handleSelectAttackTarget = useCallback((instanceId: number) => {
    const actor = cs.turnOrder[cs.currentTurnIdx];
    if (actor?.type !== 'party') return;
    const newCs    = resolvePlayerAttack(cs, actor.idx, instanceId, rngRef.current);
    // Derive emotion events from new log lines
    if (newCs.log.length > cs.log.length) {
      const newLines = newCs.log.slice(cs.log.length);
      processEmotionEvents(deriveEventsFromLogLines(newLines, newCs, cs.round));
    }
    const advanced = advanceTurnLive(newCs);
    goToNextTurn(advanced);
  }, [cs, goToNextTurn, processEmotionEvents]);

  const handleSelectAbilityTarget = useCallback((targetIdx: number) => {
    const actor = cs.turnOrder[cs.currentTurnIdx];
    if (actor?.type !== 'party') return;
    const newCs    = resolvePlayerAbility(cs, actor.idx, targetIdx, rngRef.current);
    if (newCs.log.length > cs.log.length) {
      const newLines = newCs.log.slice(cs.log.length);
      processEmotionEvents(deriveEventsFromLogLines(newLines, newCs, cs.round));
    }
    const advanced = advanceTurnLive(newCs);
    goToNextTurn(advanced);
  }, [cs, goToNextTurn, processEmotionEvents]);

  const handleContinue = useCallback(() => {
    navigation.navigate('Report', {
      roomId,
      roomWasCleared: cs.outcome === 'VICTORY',
      roomType,
      bossLootAlreadyClaimed: roomType === 'BOSS' ? bossLootClaimedRef.current : undefined,
    });
  }, [cs.outcome, navigation, roomId, roomType]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (cs.outcome) handleContinue();
      return true;
    });
    return () => sub.remove();
  }, [handleContinue, cs.outcome]);

  // ── Derived display values ───────────────────────────────────────────────────
  const currentActor       = cs.turnOrder[cs.currentTurnIdx];
  const currentPartyMember = currentActor?.type === 'party' ? cs.partyState[currentActor.idx] : null;
  const currentAbility     = currentPartyMember
    ? (CLASS_ABILITIES[currentPartyMember.charClass.toLowerCase()] as ClassAbility | undefined) ?? null
    : null;
  const abilityDisabled    = !currentAbility || !!currentPartyMember?.abilityUsed;
  const outcomeColor       = cs.outcome === 'VICTORY' ? '#00FF41' : '#FF3E3E';

  const isEnemyTargetable =
    uiPhase === 'PLAYER_TARGET_ATTACK' ||
    (uiPhase === 'PLAYER_TARGET_ABILITY' && currentAbility?.targetType === 'enemy');
  const isAllyTargetable =
    uiPhase === 'PLAYER_TARGET_ABILITY' && currentAbility?.targetType === 'ally';

  // Pick the enemy illustration for the defeat animation (stable once outcome is set)
  const defeatIllus = useMemo<ImageSourcePropType | null>(() => {
    if (cs.outcome !== 'DEFEAT') return null;
    const alive = cs.enemyState.filter(e => !e.defeated);
    const pool  = alive.length > 0 ? alive : cs.enemyState;
    const pick  = pool.length === 1
      ? pool[0]
      : pool[rngRef.current.next(0, pool.length - 1)];
    return pick ? (MONSTER_ILLUSTRATIONS[pick.name] ?? null) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cs.outcome]);

  const getPartyPortrait = useCallback((idx: number): string | null => {
    const char = partyData[idx];
    if (!char) return null;
    const exprs = expressionsJson[idx];
    if (!exprs) return portraitsMap?.[String(idx)] ?? null;
    // Use the character's active emotion expression; fallback to neutral; fallback to base portrait
    const expressionKey = partyEmotions[char.name]?.expression ?? 'neutral';
    return exprs[expressionKey] ?? exprs['neutral'] ?? portraitsMap?.[String(idx)] ?? null;
  }, [partyData, expressionsJson, portraitsMap, partyEmotions]);

  // ── Precompute timeline data ─────────────────────────────────────────────────
  const timelinePortraits = useMemo<Array<ImageSourcePropType | null>>(() =>
    cs.turnOrder.map(actor => {
      if (actor.type === 'party') {
        const uri = getPartyPortrait(actor.idx);
        return uri != null ? { uri } : null;
      }
      const enemy = cs.enemyState[actor.idx];
      const illus = MONSTER_ILLUSTRATIONS[enemy?.name ?? ''];
      return illus != null ? (illus as ImageSourcePropType) : null;
    }),
    [cs.turnOrder, cs.enemyState, getPartyPortrait],
  );

  const timelineDeadFlags = useMemo<boolean[]>(() =>
    cs.turnOrder.map(actor =>
      actor.type === 'party'
        ? (cs.partyState[actor.idx]?.currentHp ?? 1) <= 0
        : cs.enemyState[actor.idx]?.defeated ?? false,
    ),
    [cs.turnOrder, cs.partyState, cs.enemyState],
  );

  return (
    <View style={S.root}>
      <CRTOverlay />
      {/* ── HUD strip ── */}
      <View style={S.hudStrip}>
        <Text style={S.hudLeft}>F{activeFloor} · C{activeCycle}</Text>
        <Text style={S.hudCenter}>{t('battle.title').toUpperCase()}</Text>
        <Text style={S.hudRight}>[R{cs.round}]</Text>
      </View>

      {/* ── Turn Timeline ── */}
      <TurnTimeline
        turnOrder={cs.turnOrder}
        currentTurnIdx={cs.currentTurnIdx}
        portraitSources={timelinePortraits}
        deadFlags={timelineDeadFlags}
      />

      {/* ── Enemy area + log strip ── */}
      <View style={S.centerArea}>
        <View style={S.enemySection}>
          {cs.enemyState.map((enemy, i) => (
            <EnemyCard
              key={`enemy-${i}`}
              enemy={enemy}
              isTargetable={isEnemyTargetable && !enemy.defeated}
              uiPhase={uiPhase}
              onAttackTarget={handleSelectAttackTarget}
              onAbilityTarget={handleSelectAbilityTarget}
            />
          ))}
        </View>
        <LogStrip log={cs.log} />
        {/* Defeat overlay — covers only this area, action panel stays visible */}
        {uiPhase === 'ENDED' && cs.outcome === 'DEFEAT' && defeatIllus != null && (
          <DefeatAnimation source={defeatIllus} />
        )}
      </View>

      {/* ── Narrative Moment Panel ── */}
      {activeMoment != null && (() => {
        const charIdx = partyData.findIndex(c => c.name === activeMoment.charName);
        const exprs = expressionsJson[charIdx];
        const uri = exprs?.[activeMoment.emotion.expression] ?? exprs?.['neutral'] ?? null;
        return (
          <NarrativeMomentPanel
            charName={activeMoment.charName}
            emotion={activeMoment.emotion}
            portraitUri={uri}
            onDismiss={() => setActiveMoment(null)}
          />
        );
      })()}

      {/* ── Party strip ── */}
      <View style={S.partyStrip}>
        {cs.partyState.slice(0, 5).map((char, i) => (
          <PartyCard
            key={char.characterId}
            char={char}
            portrait={getPartyPortrait(i)}
            isCurrentTurn={currentPartyMember?.name === char.name}
            isTargetable={isAllyTargetable && char.currentHp > 0}
            partyIdx={i}
            onAllyTarget={handleSelectAbilityTarget}
          />
        ))}
      </View>

      {/* ── Desertion modal (UI-GAP-01) ── */}
      {desertionEvent && (
        <Modal transparent animationType="fade" visible>
          <View style={S.desertionOverlay}>
            <View style={S.desertionCard}>
              <Text style={S.desertionTitle}>⚠ DESERCIÓN</Text>

              {desertionEvent.log.map((line, i) => (
                <Text key={i} style={S.desertionLog}>· {line}</Text>
              ))}

              <View style={S.desertionDivider} />
              <Text style={S.desertionReplacementsLabel}>REEMPLAZOS:</Text>
              {desertionEvent.replacements.map(r => (
                <Text key={r.name} style={S.desertionReplacement}>
                  + {r.name} · Lv {r.level} · {r.charClass}
                </Text>
              ))}

              <TouchableOpacity
                onPress={() => setDesertionEvent(null)}
                style={S.desertionBtn}
              >
                <Text style={S.desertionBtnText}>[CONTINUAR]</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Tactical picker modal (UI-01) ── */}
      <Modal
        transparent
        animationType="fade"
        visible={showTacticalPicker}
        onRequestClose={() => setShowTacticalPicker(false)}
      >
        <TouchableOpacity
          style={S.tacticalOverlay}
          activeOpacity={1}
          onPress={() => setShowTacticalPicker(false)}
        >
          <View style={S.tacticalCard}>
            <Text style={S.tacticalTitle}>ACCIÓN TÁCTICA</Text>
            {([
              { id: 'DODGE', icon: '🛡', label: 'ESQUIVAR', desc: 'Ataques enemigos con desventaja' },
              { id: 'DASH',  icon: '💨', label: 'AVANZAR',  desc: 'Dobla el movimiento este turno' },
              { id: 'HELP',  icon: '🤝', label: 'AYUDAR',   desc: 'Aliado obtiene ventaja en su siguiente ataque' },
            ] as const).map(opt => (
              <TouchableOpacity
                key={opt.id}
                style={S.tacticalOption}
                onPress={() => handleTactic(opt.id)}
              >
                <Text style={S.tacticalOptIcon}>{opt.icon}</Text>
                <View>
                  <Text style={S.tacticalOptLabel}>{opt.label}</Text>
                  <Text style={S.tacticalOptDesc}>{opt.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Action Panel ── */}
      <View style={S.actionPanel}>

        {uiPhase === 'INITIATIVE' && (
          <View style={S.phaseRow}>
            <Text style={S.initiativeText}>TIRANDO INICIATIVA...</Text>
          </View>
        )}

        {uiPhase === 'PLAYER_ACTION' && currentPartyMember && (
          <View style={S.actionSlotRow}>
            <TouchableOpacity onPress={handleAttack} style={S.actionSlot}>
              <Text style={S.slotIcon}>⚔</Text>
              <Text style={S.slotLabel}>ATACAR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleAbility}
              disabled={!!abilityDisabled}
              style={[S.actionSlot, S.slotAbility, abilityDisabled && S.slotDisabled]}
            >
              <Text style={[S.slotIcon, S.slotAbilityIcon]}>✦</Text>
              <Text style={[S.slotLabel, S.slotAbilityLabel]} numberOfLines={1}>
                {currentAbility?.name ?? 'HABILIDAD'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowTacticalPicker(true)}
              disabled={!!currentPartyMember?.standardActionUsed}
              style={[S.actionSlot, S.slotTactic, !!currentPartyMember?.standardActionUsed && S.slotDisabled]}
            >
              <Text style={S.slotIcon}>🛡</Text>
              <Text style={S.slotLabel} numberOfLines={1}>
                {currentPartyMember?.standardActionUsed ? 'USADA' : 'TÁCTICA'}
              </Text>
            </TouchableOpacity>
            <View style={[S.actionSlot, S.slotDisabled, { borderColor: 'rgba(0,255,65,0.1)' }]}>
              <Text style={[S.slotIcon, { color: 'rgba(0,255,65,0.2)' }]}>⚗</Text>
              <Text style={[S.slotLabel, { color: 'rgba(0,255,65,0.2)' }]}>ÍTEM</Text>
            </View>
          </View>
        )}

        {(uiPhase === 'PLAYER_TARGET_ATTACK' || uiPhase === 'PLAYER_TARGET_ABILITY') && (
          <View style={[S.phaseRow, { gap: 5 }]}>
            <Text style={S.targetPrompt}>
              {uiPhase === 'PLAYER_TARGET_ATTACK'
                ? '^ TOCA UN ENEMIGO PARA ATACAR'
                : currentAbility?.targetType === 'ally'
                ? '^ TOCA UN ALIADO COMO OBJETIVO'
                : '^ TOCA UN ENEMIGO COMO OBJETIVO'}
            </Text>
            <TouchableOpacity onPress={() => setUiPhase('PLAYER_ACTION')} style={S.cancelBtn}>
              <Text style={S.cancelBtnText}>✕ CANCELAR</Text>
            </TouchableOpacity>
          </View>
        )}

        {uiPhase === 'ENEMY_AUTO' && (
          <View style={S.phaseRow}>
            <Text style={S.enemyTurnText}>▸ TURNO ENEMIGO...</Text>
          </View>
        )}

        {uiPhase === 'ENDED' && (
          <View style={S.endedRow}>
            <Text style={[S.outcomeText, { color: outcomeColor }]}>{cs.outcome}</Text>
            <TouchableOpacity
              onPress={handleContinue}
              style={[S.continueBtn, { backgroundColor: outcomeColor }]}
            >
              <Text style={S.continueBtnText}>{'>> CONTINUAR'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#060A06',
  },

  // ── HUD ──
  hudStrip: {
    height: HUD_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,255,65,0.07)',
  },
  hudLeft: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 10,
    color: 'rgba(0,255,65,0.55)',
    letterSpacing: 1,
  },
  hudCenter: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 11,
    color: 'rgba(0,255,65,0.45)',
    letterSpacing: 2,
  },
  hudRight: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    color: 'rgba(255,176,0,0.65)',
  },

  // ── Timeline ──
  timelineWrap: {
    height: TIMELINE_H,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,255,65,0.08)',
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'center',
  },
  timelineScroll: { flex: 1 },
  timelineContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  tokenWrap: {
    alignItems: 'center',
    gap: 2,
  },
  tokenCircle: {
    width: TOKEN_DIAM,
    height: TOKEN_DIAM,
    borderRadius: TOKEN_DIAM / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: TOKEN_DIAM,
    height: TOKEN_DIAM,
  },
  tokenFallback: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 18,
  },
  tokenDeadLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenDeadX: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 22,
    color: '#FF4444',
  },
  tokenDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  // ── Center area (enemies + log strip) ──
  centerArea: {
    flex: 1,
    flexDirection: 'column',
  },

  // ── Enemy section ──
  enemySection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingTop: 6,
    gap: 4,
  },

  // Enemy card — flex:1 so they share width equally, touchable wraps it
  enemyCardTouch: {
    flex: 1,
    maxWidth: ENEMY_MAX_W * 1.2,
  },
  enemyCard: {
    flex: 1,
    maxWidth: ENEMY_MAX_W * 1.2,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(8,12,8,0.92)',
  },
  // Illustration fills the entire card; info pinned at bottom inside
  enemyIllus: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,8,5,1)',
  },
	enemyIllusImg: {
		width: '100%',
		height: '100%',
		position: 'absolute',
		top: 0,
		left: 0,
	},
  enemyPlaceholder: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 42,
    color: 'rgba(255,176,0,0.18)',
  },
  // Dark gradient at the bottom of the illustration for text legibility
  enemyVignette: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 44,
    backgroundColor: 'rgba(4,8,4,0.60)',
  },
  enemyDeadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enemyDeadGlyph: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 36,
    color: '#FF3E3E',
  },
  targetRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: '#FF3E3E',
  },
  // Info block pinned inside illustration at bottom
  enemyInfoPin: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  enemyName: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 9,
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 12,
    marginBottom: 3,
  },
  enemyHpTrack: {
    width: '82%',
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 2,
  },
  enemyHpFill:  { height: '100%' },
  enemyHpLabel: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 8,
  },
  defeatedText: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 7,
    color: 'rgba(255,62,62,0.35)',
    letterSpacing: 1,
  },

  // ── Combat log strip (non-overlapping, below enemies) ──
  logStrip: {
    height: LOG_STRIP_H,
    backgroundColor: 'rgba(0,18,4,0.99)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,255,65,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    justifyContent: 'flex-end',
    gap: 3,
  },
  logEntry: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 12,
    lineHeight: 17,
  },

  // ── Party strip (horizontal portrait cards, mirrors enemy card style) ──
  partyStrip: {
    height: PARTY_STRIP_H,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,255,65,0.12)',
    backgroundColor: 'rgba(2,5,2,0.98)',
  },
  partyCardTouch: {
    flex: 1,
  },
  partyCard: {
    flex: 1,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(8,12,8,0.92)',
  },
  partyIllus: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,8,5,1)',
  },
  partyIllusImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  partyPlaceholder: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 20,
    color: 'rgba(0,255,65,0.2)',
  },
  partyVignette: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 62,
    backgroundColor: 'rgba(2,6,2,0.85)',
  },
  partyActivePulse: {
    borderWidth: 1.5,
    borderColor: 'rgba(0,255,65,0.4)',
  },
  partyTargetRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: '#4DBBFF',
  },
  partyInfoPin: {
    position: 'absolute',
    bottom: 5,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  partyName: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    letterSpacing: 0.2,
    textAlign: 'center',
    marginBottom: 3,
  },
  partyHpTrack: {
    width: '85%',
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 2,
  },
  partyHpFill: { height: '100%' },
  partyHpLabel: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 8,
  },
  partyDeadText: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    color: 'rgba(255,62,62,0.5)',
    letterSpacing: 1,
  },

  // ── Action panel ──
  actionPanel: {
    height: ACTION_H,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,255,65,0.15)',
    backgroundColor: 'rgba(2,6,2,0.98)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  phaseRow: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSlotRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionSlot: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderColor: '#FFB000',
    backgroundColor: 'rgba(255,176,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  slotAbility: {
    borderColor: '#00FF41',
    backgroundColor: 'rgba(0,255,65,0.03)',
  },
  slotEmpty: {
    borderColor: 'rgba(0,255,65,0.1)',
    backgroundColor: 'transparent',
  },
  slotTactic: {
    borderColor: '#4FC3F7',
    backgroundColor: 'rgba(79,195,247,0.04)',
  },
  slotDisabled: { opacity: 0.32 },
  slotIcon: {
    fontSize: 20,
    color: '#FFB000',
  },
  slotAbilityIcon: { color: '#00FF41' },
  slotLabel: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 8,
    color: '#FFB000',
    letterSpacing: 0.3,
  },
  slotAbilityLabel: { color: '#00FF41' },
  tacticalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
    paddingBottom: 140,
    alignItems: 'center',
  },
  tacticalCard: {
    backgroundColor: '#0A0F0A',
    borderWidth: 1,
    borderColor: '#4FC3F7',
    borderRadius: 4,
    padding: 16,
    width: SCREEN_W * 0.85,
    gap: 4,
  },
  tacticalTitle: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 11,
    color: '#4FC3F7',
    letterSpacing: 2,
    marginBottom: 8,
    textAlign: 'center',
  },
  tacticalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(79,195,247,0.15)',
  },
  tacticalOptIcon: { fontSize: 22 },
  tacticalOptLabel: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    color: '#4FC3F7',
    letterSpacing: 1,
  },
  tacticalOptDesc: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 9,
    color: 'rgba(79,195,247,0.65)',
  },
  initiativeText: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 11,
    color: '#FFB000',
    letterSpacing: 2,
  },
  targetPrompt: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    color: '#FF3E3E',
    letterSpacing: 1,
    textAlign: 'center',
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,62,62,0.45)',
  },
  cancelBtnText: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 8,
    color: 'rgba(255,62,62,0.65)',
    letterSpacing: 1,
  },
  enemyTurnText: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 11,
    color: '#FF3E3E',
    letterSpacing: 2,
  },
  endedRow: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  outcomeText: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 22,
    letterSpacing: 4,
  },
  continueBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  continueBtnText: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 12,
    color: '#060A06',
  },

  // ── Defeat animation overlay (inside centerArea, doesn't cover action panel) ──
  defeatOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Desertion modal (UI-GAP-01) ──
  desertionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.80)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  desertionCard: {
    borderWidth: 1,
    borderColor: '#FF3E3E',
    borderRadius: 4,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#060A06',
  },
  desertionTitle: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 13,
    color: '#FF3E3E',
    letterSpacing: 2,
    marginBottom: 12,
  },
  desertionLog: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 11,
    color: 'rgba(0,255,65,0.7)',
    marginBottom: 4,
  },
  desertionDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,255,65,0.15)',
    marginTop: 12,
    marginBottom: 8,
  },
  desertionReplacementsLabel: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 10,
    color: 'rgba(0,255,65,0.4)',
    letterSpacing: 1,
    marginBottom: 6,
  },
  desertionReplacement: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 11,
    color: '#00CCFF',
    marginBottom: 2,
  },
  desertionBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.35)',
    borderRadius: 3,
    padding: 12,
    alignItems: 'center',
  },
  desertionBtnText: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 12,
    color: 'rgba(0,255,65,0.85)',
    letterSpacing: 2,
  },
});
