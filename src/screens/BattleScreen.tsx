import React, {
  useEffect, useCallback, useState, useRef, useMemo, memo,
} from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, BackHandler,
  Image, StyleSheet, Dimensions, Platform,
  type ImageSourcePropType,
} from 'react-native';
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
  type LivePartyMember,
  type LiveEnemy,
  type TurnActor,
  type ClassAbility,
} from '../services/combatEngine';
import { MONSTER_ILLUSTRATIONS } from '../constants/monsterIllustrations';
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
const LOG_STRIP_H     = 44;   // dedicated log row below enemies
const PARTY_STRIP_H   = 56;   // horizontal party portrait row
const ACTION_H        = 72;
const APPROX_STATUS_H = Platform.OS === 'ios' ? 50 : 24;

const TOKEN_DIAM   = 50;                                         // timeline circles
const PARTY_CHIP_D = 38;                                         // portrait chip diameter

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
            style={StyleSheet.absoluteFillObject}
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
            resizeMode="contain"
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

// ── Party Chip (horizontal bottom strip) ──────────────────────────────────────

type PartyChipProps = {
  char: LivePartyMember;
  portrait: string | null;
  isCurrentTurn: boolean;
  isTargetable: boolean;
  partyIdx: number;
  onAllyTarget: (idx: number) => void;
};

const PartyChip = memo(({
  char, portrait, isCurrentTurn, isTargetable, partyIdx, onAllyTarget,
}: PartyChipProps) => {
  const hpPct     = char.maxHp > 0 ? char.currentHp / char.maxHp : 0;
  const hpColor   = char.currentHp <= 0
    ? '#FF3E3E'
    : hpPct > 0.5 ? '#00FF41' : hpPct > 0.25 ? '#FFB000' : '#FF3E3E';
  const ringColor = isCurrentTurn ? '#00FF41' : isTargetable ? '#4DBBFF' : `${hpColor}60`;
  const ringWidth = isCurrentTurn ? 2.5 : 1.5;

  const handlePress = useCallback(() => onAllyTarget(partyIdx), [onAllyTarget, partyIdx]);

  const chip = (
    <View style={[S.partyChipWrap, { opacity: char.currentHp <= 0 ? 0.3 : 1 }]}>
      <View style={[S.partyChipCircle, {
        borderColor: ringColor,
        borderWidth: ringWidth,
        backgroundColor: isCurrentTurn ? `${hpColor}18` : 'rgba(10,15,10,0.95)',
      }]}>
        {portrait != null && (
          <Image
            source={{ uri: portrait }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        )}
        {isCurrentTurn && (
          <View style={[StyleSheet.absoluteFillObject, S.chipActivePulse]} />
        )}
      </View>
      <View style={[S.chipHpTrack, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
        <View style={[S.chipHpFill, {
          width: `${Math.round(hpPct * 100)}%`,
          backgroundColor: hpColor,
        }]} />
      </View>
      <Text style={[S.chipName, { color: hpColor }]} numberOfLines={1}>
        {char.name.substring(0, 5).toUpperCase()}
      </Text>
    </View>
  );

  if (!isTargetable || char.currentHp <= 0) return chip;
  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.72} style={S.partyChipTouch}>
      {chip}
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
  return (
    <View style={S.logStrip}>
      {prev !== '' && (
        <Text style={[S.logEntry, { color: getLogColor(prev), opacity: 0.38 }]} numberOfLines={1}>
          {'> '}{prev}
        </Text>
      )}
      {last !== '' && (
        <Text style={[S.logEntry, { color: getLogColor(last), opacity: 0.88 }]} numberOfLines={1}>
          {'> '}{last}
        </Text>
      )}
    </View>
  );
});

// ── Main Screen ────────────────────────────────────────────────────────────────

export const BattleScreen = ({ navigation, route }: ScreenProps<'Battle'>) => {
  const { roomId, roomType } = route.params;
  const { t } = useI18n();

  // ── Store selectors ─────────────────────────────────────────────────────────
  const partyData       = useGameStore(s => s.activeGame?.partyData ?? []);
  const portraitsMap    = useGameStore(s => s.activeGame?.portraitsJson ?? null);
  const expressionsJson = useGameStore(s => s.activeGame?.expressionsJson ?? {});
  const activeFloor     = useGameStore(s => s.activeGame?.floor ?? 1);
  const activeCycle     = useGameStore(s => s.activeGame?.cycle ?? 1);
  const setCombatResult = useGameStore(s => s.setCombatResult);
  const updateProgress  = useGameStore(s => s.updateProgress);

  // ── Combat init (once on mount) ─────────────────────────────────────────────
  const rngRef     = useRef(createCombatRNG(`combat_${roomId}`));
  const enemiesRef = useRef(generateEnemiesForRoom(roomType, roomId, activeCycle, activeFloor));

  const [cs, setCs]           = useState<LiveCombatState>(() =>
    initCombat(partyData, enemiesRef.current, rngRef.current));
  const [uiPhase, setUiPhase] = useState<UIPhase>('INITIATIVE');

  // ── Phase transitions ────────────────────────────────────────────────────────
  const goToNextTurn = useCallback((state: LiveCombatState) => {
    const outcome = checkCombatOutcome(state);
    if (outcome) {
      const finalCs = { ...state, outcome };
      setCs(finalCs);
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

  const handleSelectAttackTarget = useCallback((instanceId: number) => {
    const actor = cs.turnOrder[cs.currentTurnIdx];
    if (actor?.type !== 'party') return;
    const newCs    = resolvePlayerAttack(cs, actor.idx, instanceId, rngRef.current);
    const advanced = advanceTurnLive(newCs);
    goToNextTurn(advanced);
  }, [cs, goToNextTurn]);

  const handleSelectAbilityTarget = useCallback((targetIdx: number) => {
    const actor = cs.turnOrder[cs.currentTurnIdx];
    if (actor?.type !== 'party') return;
    const newCs    = resolvePlayerAbility(cs, actor.idx, targetIdx, rngRef.current);
    const advanced = advanceTurnLive(newCs);
    goToNextTurn(advanced);
  }, [cs, goToNextTurn]);

  const handleContinue = useCallback(() => {
    navigation.navigate('Report', { roomId, roomWasCleared: cs.outcome === 'VICTORY' });
  }, [cs.outcome, navigation, roomId]);

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

  const getPartyPortrait = useCallback((idx: number): string | null => {
    const exprs = expressionsJson[idx];
    return exprs?.['aggressive'] ?? exprs?.['angry'] ?? exprs?.['neutral']
      ?? portraitsMap?.[String(idx)] ?? null;
  }, [expressionsJson, portraitsMap]);

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
      </View>

      {/* ── Party strip ── */}
      <View style={S.partyStrip}>
        {cs.partyState.slice(0, 5).map((char, i) => (
          <PartyChip
            key={`${char.name}-${i}`}
            char={char}
            portrait={getPartyPortrait(i)}
            isCurrentTurn={currentPartyMember?.name === char.name}
            isTargetable={isAllyTargetable && char.currentHp > 0}
            partyIdx={i}
            onAllyTarget={handleSelectAbilityTarget}
          />
        ))}
      </View>

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
            <View style={[S.actionSlot, S.slotEmpty]} />
            <View style={[S.actionSlot, S.slotEmpty]} />
          </View>
        )}

        {(uiPhase === 'PLAYER_TARGET_ATTACK' || uiPhase === 'PLAYER_TARGET_ABILITY') && (
          <View style={S.phaseRow}>
            <Text style={S.targetPrompt}>
              {uiPhase === 'PLAYER_TARGET_ATTACK'
                ? '^ TOCA UN ENEMIGO PARA ATACAR'
                : currentAbility?.targetType === 'ally'
                ? '^ TOCA UN ALIADO COMO OBJETIVO'
                : '^ TOCA UN ENEMIGO COMO OBJETIVO'}
            </Text>
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

      <GlossaryButton />
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
    fontSize: 9,
    color: 'rgba(0,255,65,0.4)',
    letterSpacing: 1,
  },
  hudCenter: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    color: 'rgba(0,255,65,0.2)',
    letterSpacing: 2,
  },
  hudRight: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    color: 'rgba(255,176,0,0.45)',
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
		flexWrap: 'wrap',
    alignItems: 'stretch',
		justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 6,
    gap: 4,
  },

  // Enemy card — flex:1 so they share width equally, touchable wraps it
  enemyCardTouch: {
    flex: 1,
    maxWidth: ENEMY_MAX_W,
  },
  enemyCard: {
    flex: 1,
    maxWidth: ENEMY_MAX_W*1.2,
		maxHeight: ENEMY_MAX_W*1.9,
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
		resizeMode: 'contain',
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
    height: 70,
    backgroundColor: 'rgba(4,8,4,0.78)',
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
    fontSize: 7,
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 10,
    marginBottom: 3,
  },
  enemyHpTrack: {
    width: '82%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 2,
  },
  enemyHpFill:  { height: '100%' },
  enemyHpLabel: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 7,
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
    backgroundColor: 'rgba(2,5,2,0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,255,65,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    justifyContent: 'flex-end',
    gap: 1,
  },
  logEntry: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 8.5,
    lineHeight: 13,
  },

  // ── Party strip (horizontal portrait chips) ──
  partyStrip: {
    height: PARTY_STRIP_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,255,65,0.1)',
    backgroundColor: 'rgba(2,5,2,0.98)',
  },
  partyChipTouch: {
    alignItems: 'center',
  },
  partyChipWrap: {
    alignItems: 'center',
    gap: 3,
  },
  partyChipCircle: {
    width: PARTY_CHIP_D,
    height: PARTY_CHIP_D,
    borderRadius: PARTY_CHIP_D / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActivePulse: {
    borderWidth: 1.5,
    borderColor: 'rgba(0,255,65,0.5)',
    borderRadius: PARTY_CHIP_D / 2,
  },
  chipHpTrack: {
    width: PARTY_CHIP_D,
    height: 2.5,
    borderRadius: 1,
  },
  chipHpFill: { height: '100%', borderRadius: 1 },
  chipName: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 6,
    letterSpacing: 0.2,
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
  slotDisabled: { opacity: 0.32 },
  slotIcon: {
    fontSize: 20,
    color: '#FFB000',
  },
  slotAbilityIcon: { color: '#00FF41' },
  slotLabel: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 6,
    color: '#FFB000',
    letterSpacing: 0.3,
  },
  slotAbilityLabel: { color: '#00FF41' },
  initiativeText: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 11,
    color: '#FFB000',
    letterSpacing: 2,
  },
  targetPrompt: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 11,
    color: '#FF3E3E',
    letterSpacing: 1,
    textAlign: 'center',
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
});
