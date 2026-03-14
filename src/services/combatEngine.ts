/**
 * D&D 5e Combat Engine — Sprint 4B
 *
 * Auto-resolves tactical combat between the player's party and dungeon enemies.
 * Deterministic per roomId (same room always produces the same combat outcome).
 *
 * Implements:
 * - Initiative: DEX_mod + d20 per actor, sorted descending
 * - Hit roll: (attackMod + profBonus) vs target AC; nat-1 always misses, nat-20 crits
 * - Damage: weapon dice + stat modifier; ×2 dice on crit
 * - HP tracking: party members and enemies share mutable combat state
 * - XP decay via monsterEvolutionService.calculateXP
 * - Enemy generation seeded by roomId for determinism
 */

import type { CharacterSave } from '../database/gameRepository';
import type { MonsterStats, KillRecord } from './monsterEvolutionService';
import { calculateXP, getEvolvedMonster } from './monsterEvolutionService';
import type { RoomType } from './dungeonGraphService';
import { CLASS_STAT_PRIORITY } from './characterStats';
import { makePRNG, type PRNG } from '../utils/prng';

// ─── Public types ─────────────────────────────────────────────────────────────

export type CombatPartyMember = {
  /** Canonical character identifier (NI-09). Use for matching, not `name`. */
  characterId: string;
  name: string;
  charClass: string;
  hpBefore: number;
  hpAfter: number;
  alive: boolean;
};

export type CombatEnemy = {
  /** ALL_CAPS_UNDERSCORE key used in game log */
  name: string;
  xpEarned: number;
  loot: string | null;
};

export type CombatEventType =
  | 'ALLY_DOWN'              // un miembro de la party llegó a 0 HP
  | 'CRIT_DEALT'             // la party hizo un golpe crítico (nat 20)
  | 'CRIT_RECEIVED'          // un enemigo hizo un golpe crítico a la party
  | 'NAT_ONE'                // fumble propio (nat 1)
  | 'LOW_HEALTH'             // HP de un miembro < 25%
  | 'VERY_LOW_HEALTH'        // HP < 10% — supervivencia crítica
  | 'ABILITY_USED'           // habilidad de clase activada
  | 'ENEMY_DEFEATED'         // un enemigo fue derrotado
  | 'BOSS_DEFEATED'          // el boss cayó (roomType === 'BOSS')
  | 'VICTORY'                // combate terminado — victoria
  | 'DEFEAT'                 // combate terminado — derrota
  | 'ESSENCE_DROP_RARE'      // rank 4 o 3 (Raro o Épico) obtenido en combate
  | 'ESSENCE_DROP_MYTHIC'    // rank 2 o 1 (Mítico o Legendario) obtenido en combate
  | 'ESSENCE_EVOLVED'        // esencia evolucionada al nivel 2 o 3
  | 'CHARACTER_ASCENDED';    // personaje completó la ascensión

export type CombatEvent = {
  type: CombatEventType;
  actorName: string;
  targetName?: string;
  value?: number;
  turn: number;
};

export type CombatResult = {
  outcome: 'VICTORY' | 'DEFEAT';
  roundsElapsed: number;
  partyAfter: CombatPartyMember[];
  /** Enemies actually defeated during this combat */
  enemiesDefeated: CombatEnemy[];
  totalXp: number;
  goldEarned: number;
  /** Total damage dealt per party member name */
  damageDone: Record<string, number>;
  /** Sequential combat log lines for display in BattleScreen */
  log: string[];
  /** Typed combat events derived from the final state — optional, non-breaking */
  events?: CombatEvent[];
};

// ─── PRNG — imported from src/utils/prng.ts (NI-03) ────────────────────────
// makePRNG and PRNG type come from the shared utility above.

// ─── Dice parser ──────────────────────────────────────────────────────────────

function rollDice(notation: string, rng: RNG): number {
  // Accepts "NdS", "NdS+B", "NdS-B"
  const m = notation.match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!m) return 1;
  const count = parseInt(m[1], 10);
  const sides = parseInt(m[2], 10);
  const bonus = m[3] ? parseInt(m[3], 10) : 0;
  let total = bonus;
  for (let i = 0; i < count; i++) total += rng.next(1, sides);
  return Math.max(1, total);
}

// ─── DnD helpers ─────────────────────────────────────────────────────────────

function statMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Primary attack stat based on class priority */
function getAttackStat(charClass: string): keyof CharacterSave['baseStats'] {
  const priority = CLASS_STAT_PRIORITY[charClass.toLowerCase()];
  return (priority?.[0] ?? 'STR') as keyof CharacterSave['baseStats'];
}

/** Base weapon damage dice by class */
const CLASS_WEAPON_DICE: Record<string, string> = {
  barbarian: '1d12',
  fighter:   '1d8',
  paladin:   '1d6',
  ranger:    '1d8',
  rogue:     '1d6',
  wizard:    '1d6',
  cleric:    '1d6',
  druid:     '1d4',
  monk:      '1d6',
  bard:      '1d6',
  sorcerer:  '1d8',
  warlock:   '1d10',
};

/** Proficiency bonus at level 1 */
const PROF_BONUS = 2;

/** Gold earned per XP point (CR-CE-02: extracted from inline magic number) */
const GOLD_PER_XP = 0.15;

// ─── Enemy generation ─────────────────────────────────────────────────────────

type EnemyPool = { base: string; count: [number, number] }[];

const ROOM_ENEMY_POOLS: Record<RoomType, EnemyPool> = {
  START:    [],
  NORMAL:   [
    { base: 'skeleton', count: [2, 3] },
    { base: 'goblin',   count: [2, 3] },
    { base: 'zombie',   count: [2, 3] },
    { base: 'rat',      count: [3, 4] },
  ],
  ELITE:    [
    { base: 'orc',     count: [2, 3] },
    { base: 'cultist', count: [3, 4] },
    { base: 'gnoll',   count: [2, 3] },
    { base: 'skeleton', count: [3, 4] },
  ],
  EVENT:    [
    { base: 'cultist', count: [1, 2] },
    { base: 'goblin',  count: [1, 2] },
  ],
  TREASURE: [
    { base: 'rat',    count: [1, 2] },
    { base: 'goblin', count: [1, 2] },
  ],
  BOSS: [
    { base: 'lich',            count: [1, 1] },
    { base: 'dragon_wyrmling', count: [1, 1] },
    { base: 'troll',           count: [1, 1] },
  ],
  SECRET: [
    { base: 'vampire', count: [1, 1] },
    { base: 'wight',   count: [1, 2] },
    { base: 'banshee', count: [1, 1] },
  ],
  SAFE_ZONE: [],
};

const LOOT_TABLE = [
  'GOLD_COINS x5', 'IRON_DAGGER', 'HEALTH_POTION',
  'SHADOW_ESSENCE x2', 'TORCH x3', 'OLD_MAP',
  'BONE_FRAGMENT', 'TATTERED_SCROLL',
];

/**
 * Generate enemies for a given room deterministically.
 * Same roomId + cycle + floor always yields the same encounter.
 */
export function generateEnemiesForRoom(
  roomType: RoomType,
  roomId: string,
  cycle: number,
  floor: number,
): MonsterStats[] {
  const rng = makePRNG(`room_${roomId}_c${cycle}_f${floor}`);
  const pool = ROOM_ENEMY_POOLS[roomType];
  if (!pool.length) return [getEvolvedMonster('goblin', cycle, floor)];

  const entry = pool[rng.next(0, pool.length - 1)];
  const count = rng.next(entry.count[0], entry.count[1]);
  return Array.from({ length: count }, () => ({ ...getEvolvedMonster(entry.base, cycle, floor) }));
}

// ─── Combat resolver ──────────────────────────────────────────────────────────

const MAX_ROUNDS = 20;

/**
 * Fully resolve a combat encounter.
 * Returns CombatResult with all round-by-round log entries.
 */
export function resolveCombat(
  party: CharacterSave[],
  enemies: MonsterStats[],
  roomId: string,
  killRecords: KillRecord[],
): CombatResult {
  const rng = makePRNG(`combat_${roomId}`);
  const log: string[] = [];

  // Party: track mutable HP in combat without mutating the originals
  // CR-CE-01: guard hp > 0 — a character may be alive:true but hp:0 if state was not synced
  const partyState = party
    .filter(c => c.alive && (c.hp ?? 0) > 0)
    .map(c => ({ ...c, hpBefore: c.hp, currentHp: c.hp }));

  // Enemies: each instance is independent
  const enemyState = enemies.map((e, i) => ({
    ...e,
    instanceId: i,
    currentHp: e.hp,
    defeated: false,
  }));

  const defeatedEnemies: CombatEnemy[] = [];
  const damageDone: Record<string, number> = {};

  // ── Initiative ──────────────────────────────────────────────────────────────
  type Actor = { isParty: true; idx: number } | { isParty: false; idx: number };
  const initiativePairs: { actor: Actor; roll: number }[] = [
    ...partyState.map((c, i) => ({
      actor: { isParty: true as const, idx: i },
      roll: statMod(c.baseStats.DEX) + rng.next(1, 20),
    })),
    ...enemyState.map((e, i) => ({
      actor: { isParty: false as const, idx: i },
      roll: statMod(10) + rng.next(1, 20), // enemies use DEX 10 baseline
    })),
  ];
  initiativePairs.sort((a, b) => b.roll - a.roll);

  log.push('INITIATIVE:');
  initiativePairs.forEach(({ actor, roll }) => {
    const label = actor.isParty
      ? partyState[actor.idx].name.toUpperCase()
      : enemyState[actor.idx].displayName.toUpperCase().replace(/ /g, '_');
    log.push(`  ${label} (${roll})`);
  });

  // ── Combat loop ─────────────────────────────────────────────────────────────
  let round = 0;
  let outcome: 'VICTORY' | 'DEFEAT' = 'VICTORY';

  outer: while (round < MAX_ROUNDS) {
    round++;
    log.push(`── ROUND ${round} ──`);

    for (const { actor } of initiativePairs) {
      const aliveParty   = partyState.filter(c => c.currentHp > 0);
      const aliveEnemies = enemyState.filter(e => !e.defeated);

      if (aliveParty.length === 0 || aliveEnemies.length === 0) break outer;

      if (actor.isParty) {
        // ── Party member attacks a random living enemy ──
        const attacker = partyState[actor.idx];
        if (attacker.currentHp <= 0) continue;

        const target = aliveEnemies[rng.next(0, aliveEnemies.length - 1)];
        const atkStat = getAttackStat(attacker.charClass);
        const atkMod  = statMod(attacker.baseStats[atkStat]);
        const d20     = rng.next(1, 20);
        const roll    = d20 + atkMod + PROF_BONUS;
        const isCrit  = d20 === 20;
        const isFumble = d20 === 1;
        const targetLabel = target.displayName.toUpperCase().replace(/ /g, '_');

        if (isFumble) {
          log.push(`  ${attacker.name.toUpperCase()} ▶ ${targetLabel} — MISS (nat 1)`);
        } else if (isCrit || roll >= target.ac) {
          const weaponDice = CLASS_WEAPON_DICE[attacker.charClass.toLowerCase()] ?? '1d6';
          const baseDmg    = rollDice(weaponDice, rng);
          const dmg        = Math.max(1, baseDmg + atkMod + (isCrit ? baseDmg : 0));
          target.currentHp = Math.max(0, target.currentHp - dmg);
          damageDone[attacker.name] = (damageDone[attacker.name] ?? 0) + dmg;

          const hitTag = isCrit ? 'CRIT!' : 'HIT';
          log.push(`  ${attacker.name.toUpperCase()} ▶ ${targetLabel} [${hitTag}] −${dmg} HP`);

          if (target.currentHp <= 0) {
            target.defeated = true;
            const prevKills = killRecords.find(k => k.monsterType === target.name)?.killCount ?? 0;
            const xpEarned  = calculateXP(target, prevKills);
            const lootRoll  = rng.next(0, 2); // 2/3 chance of loot
            const loot      = lootRoll > 0 ? LOOT_TABLE[rng.next(0, LOOT_TABLE.length - 1)] : null;
            defeatedEnemies.push({
              name: target.displayName.toUpperCase().replace(/ /g, '_'),
              xpEarned,
              loot,
            });
            log.push(`  ✓ ${targetLabel} DEFEATED`);
          }
        } else {
          log.push(`  ${attacker.name.toUpperCase()} ▶ ${targetLabel} — MISS (${roll} vs AC ${target.ac})`);
        }
      } else {
        // ── Enemy attacks a random living party member ──
        const attacker = enemyState[actor.idx];
        if (attacker.defeated) continue;

        const aliveTargets = partyState.filter(c => c.currentHp > 0);
        if (aliveTargets.length === 0) break outer;
        const target = aliveTargets[rng.next(0, aliveTargets.length - 1)];

        // Character AC: 10 + DEX_mod (unarmored, MVP simplification)
        const targetAC = 10 + statMod(target.baseStats.DEX);
        const d20      = rng.next(1, 20);
        const roll     = d20 + attacker.attackBonus;
        const isCrit   = d20 === 20;
        const isFumble = d20 === 1;
        const atkLabel = attacker.displayName.toUpperCase().replace(/ /g, '_');

        if (isFumble) {
          log.push(`  ${atkLabel} ▶ ${target.name.toUpperCase()} — MISS (nat 1)`);
        } else if (isCrit || roll >= targetAC) {
          const baseDmg    = rollDice(attacker.damage, rng);
          const dmg        = Math.max(1, isCrit ? baseDmg * 2 : baseDmg);
          target.currentHp = Math.max(0, target.currentHp - dmg);

          const hitTag = isCrit ? 'CRIT!' : 'HIT';
          log.push(`  ${atkLabel} ▶ ${target.name.toUpperCase()} [${hitTag}] −${dmg} HP`);

          if (target.currentHp <= 0) {
            log.push(`  ✗ ${target.name.toUpperCase()} KNOCKED_OUT`);
          }
        } else {
          log.push(`  ${atkLabel} ▶ ${target.name.toUpperCase()} — MISS (${roll} vs AC ${targetAC})`);
        }
      }
    }

    // Check end condition after full round
    if (partyState.every(c => c.currentHp <= 0)) { outcome = 'DEFEAT'; break; }
    if (enemyState.every(e => e.defeated))        { outcome = 'VICTORY'; break; }
  }

  // ── Final tallies ──────────────────────────────────────────────────────────
  const totalXp    = defeatedEnemies.reduce((s, e) => s + e.xpEarned, 0);
  const goldEarned = Math.round(totalXp * GOLD_PER_XP) + rng.next(5, 25);

  const partyAfter: CombatPartyMember[] = partyState.map(c => ({
    characterId: c.characterId,
    name:     c.name,
    charClass: c.charClass,
    hpBefore: c.hpBefore,
    hpAfter:  Math.max(0, c.currentHp),
    alive:    c.currentHp > 0,
  }));

  return { outcome, roundsElapsed: round, partyAfter, enemiesDefeated: defeatedEnemies, totalXp, goldEarned, damageDone, log };
}

// ─── Interactive Combat — Types ───────────────────────────────────────────────

export type ClassAbility = {
  name: string;
  description: string;
  /** Who the player picks as the ability target */
  targetType: 'enemy' | 'ally' | 'self' | 'none';
};

export const CLASS_ABILITIES: Record<string, ClassAbility> = {
  barbarian: { name: 'FURIA',            description: '+4 DMG todo combate',  targetType: 'none'  },
  fighter:   { name: 'SEGUNDO_ALIENTO',  description: 'Curar 1d10+2',         targetType: 'self'  },
  paladin:   { name: 'GOLPE_DIVINO',     description: '+2d8 al enemigo',       targetType: 'enemy' },
  ranger:    { name: 'MARCA_CAZADOR',    description: '+1d6 al enemigo',       targetType: 'enemy' },
  rogue:     { name: 'ATAQUE_FURTIVO',   description: '+3d6 al enemigo',       targetType: 'enemy' },
  wizard:    { name: 'MISIL_MAGICO',     description: '3x(1d4+1) sin falla',   targetType: 'enemy' },
  cleric:    { name: 'PALABRA_CURATIVA', description: 'Curar 1d4+SAB aliado',  targetType: 'ally'  },
  druid:     { name: 'ENREDAR',          description: 'Saltar turno enemigo',  targetType: 'enemy' },
  monk:      { name: 'LLUVIA_DE_GOLPES', description: '2 golpes 1d4+FUE',      targetType: 'enemy' },
  bard:      { name: 'INSPIRAR',         description: '+1d6 proximo ataque',   targetType: 'ally'  },
  sorcerer:  { name: 'ORBE_CROMATICO',   description: '3d8 fuerza a enemigo',  targetType: 'enemy' },
  warlock:   { name: 'EXPLOSION_OSCURA', description: '1d10 poder oscuro',     targetType: 'enemy' },
};

export type LivePartyMember = {
  /** Canonical character identifier (NI-09). Never use `name` as semantic key. */
  characterId: string;
  name: string;
  charClass: string;
  baseStats: CharacterSave['baseStats'];
  maxHp: number;
  hpBefore: number;
  currentHp: number;
  abilityUsed: boolean;
  rageActive: boolean;
  /** Bonus die sides for next attack roll (bard INSPIRE) */
  inspiredBonus: number;
  /** RI-07: true when this character was revived this turn (Fénix essence).
   *  Blocks active ability usage to prevent Fénix+Tiempo combo exploit. */
  justRevived: boolean;
  /** UI-01: true when player chose ESQUIVAR this turn — enemy attacks with disadvantage. */
  dodging: boolean;
  /** UI-01: true when any standard action (ESQUIVAR/AVANZAR/AYUDAR) was used this turn. */
  standardActionUsed: boolean;
};

export type LiveEnemy = MonsterStats & {
  instanceId: number;
  currentHp: number;
  defeated: boolean;
  skipsNextTurn: boolean;
};

export type TurnActor =
  | { type: 'party'; idx: number; initiative: number }
  | { type: 'enemy'; idx: number; initiative: number };

export type LiveCombatState = {
  round: number;
  turnOrder: TurnActor[];
  currentTurnIdx: number;
  partyState: LivePartyMember[];
  enemyState: LiveEnemy[];
  log: string[];
  outcome: 'VICTORY' | 'DEFEAT' | null;
  damageDone: Record<string, number>;
};

// ─── Interactive Combat — Engine ──────────────────────────────────────────────

type RNG = PRNG;

export function createCombatRNG(seed: string): RNG {
  return makePRNG(seed);
}

export function initCombat(
  party: CharacterSave[],
  enemies: MonsterStats[],
  rng: RNG,
): LiveCombatState {
  const partyState: LivePartyMember[] = party
    .filter(c => c.alive)
    .map(c => ({
      characterId: c.characterId,
      name: c.name,
      charClass: c.charClass,
      baseStats: c.baseStats,
      maxHp: c.maxHp,
      hpBefore: c.hp,
      currentHp: c.hp,
      abilityUsed: false,
      rageActive: false,
      inspiredBonus: 0,
      justRevived: false,
      dodging: false,
      standardActionUsed: false,
    }));

  const enemyState: LiveEnemy[] = enemies.map((e, i) => ({
    ...e,
    instanceId: i,
    currentHp: e.hp,
    defeated: false,
    skipsNextTurn: false,
  }));

  const log: string[] = ['INICIATIVA:'];
  const turnOrder: TurnActor[] = [
    ...partyState.map((c, i) => {
      const roll = Math.floor((c.baseStats.DEX - 10) / 2) + rng.next(1, 20);
      log.push(`  ${c.name.toUpperCase()} (${roll})`);
      return { type: 'party' as const, idx: i, initiative: roll };
    }),
    ...enemyState.map((e, i) => {
      const roll = rng.next(1, 20);
      log.push(`  ${e.displayName.toUpperCase().replace(/ /g, '_')} (${roll})`);
      return { type: 'enemy' as const, idx: i, initiative: roll };
    }),
  ];
  turnOrder.sort((a, b) => b.initiative - a.initiative);

  return {
    round: 1,
    turnOrder,
    currentTurnIdx: 0,
    partyState,
    enemyState,
    log,
    outcome: null,
    damageDone: {},
  };
}

export function checkCombatOutcome(state: LiveCombatState): 'VICTORY' | 'DEFEAT' | null {
  if (state.partyState.every(c => c.currentHp <= 0)) return 'DEFEAT';
  if (state.enemyState.every(e => e.defeated)) return 'VICTORY';
  return null;
}

/** Advance to the next alive actor in turn order. Increments round on wrap. */
export function advanceTurnLive(state: LiveCombatState): LiveCombatState {
  const len = state.turnOrder.length;
  const log = [...state.log];
  let newRound = state.round;
  let wrappedOnce = false;

  for (let i = 1; i <= len; i++) {
    const raw = state.currentTurnIdx + i;
    if (raw >= len && !wrappedOnce) {
      wrappedOnce = true;
      newRound += 1;
      log.push(`── ROUND ${newRound} ──`);
    }
    const nextIdx = raw % len;
    const actor = state.turnOrder[nextIdx];
    const isAlive =
      actor.type === 'party'
        ? state.partyState[actor.idx].currentHp > 0
        : !state.enemyState[actor.idx].defeated;
    if (isAlive) {
      // RI-07/UI-01: clear justRevived, dodging and standardActionUsed when this actor's new turn begins
      let partyState = state.partyState;
      if (actor.type === 'party') {
        partyState = state.partyState.map((m, idx) =>
          idx === actor.idx
            ? { ...m, justRevived: false, dodging: false, standardActionUsed: false }
            : m,
        );
      }
      return { ...state, partyState, currentTurnIdx: nextIdx, round: newRound, log };
    }
  }
  return state;
}

/** Find the next UI phase without mutating state (pure). Skips dead/defeated actors. */
export function findNextLiveTurn(
  state: LiveCombatState,
): { state: LiveCombatState; phase: 'PLAYER_ACTION' | 'ENEMY_AUTO' } {
  let s = state;
  for (let safety = 0; safety < s.turnOrder.length * 2 + 2; safety++) {
    const actor = s.turnOrder[s.currentTurnIdx];
    if (!actor) break;
    if (actor.type === 'party') {
      const member = s.partyState[actor.idx];
      if (member.currentHp > 0) return { state: s, phase: 'PLAYER_ACTION' };
    } else {
      const enemy = s.enemyState[actor.idx];
      if (!enemy.defeated) return { state: s, phase: 'ENEMY_AUTO' };
    }
    s = advanceTurnLive(s);
  }
  // Fallback — should not happen if outcome is checked first
  return { state: s, phase: 'PLAYER_ACTION' };
}

export function resolvePlayerAttack(
  state: LiveCombatState,
  actorPartyIdx: number,
  targetEnemyIdx: number,
  rng: RNG,
): LiveCombatState {
  const attacker = state.partyState[actorPartyIdx];
  if (!attacker || attacker.currentHp <= 0) return state;
  const enemyState = state.enemyState.map(e => ({ ...e }));
  const tgt = enemyState[targetEnemyIdx];
  if (!tgt || tgt.defeated) return state;

  // Determine attack stat by class
  const atkStatKey = (() => {
    const cl = attacker.charClass.toLowerCase();
    if (['wizard', 'sorcerer', 'warlock', 'bard'].includes(cl)) return 'INT' as const;
    if (['cleric', 'druid', 'ranger'].includes(cl)) return 'WIS' as const;
    if (['rogue', 'monk'].includes(cl)) return 'DEX' as const;
    return 'STR' as const;
  })();
  const atkMod = Math.floor((attacker.baseStats[atkStatKey] - 10) / 2);
  const inspireBon = attacker.inspiredBonus > 0 ? rng.next(1, attacker.inspiredBonus) : 0;
  const d20 = rng.next(1, 20);
  const roll = d20 + atkMod + 2 /* PROF */ + inspireBon;
  const isCrit = d20 === 20;
  const isFumble = d20 === 1;
  const targetLabel = tgt.displayName.toUpperCase().replace(/ /g, '_');
  const log = [...state.log];
  const damageDone = { ...state.damageDone };

  const partyState = state.partyState.map((p, i) =>
    i === actorPartyIdx ? { ...p, inspiredBonus: 0 } : p,
  );

  const CLASS_WEAPON_DICE_LOCAL: Record<string, string> = {
    barbarian: '1d12', fighter: '1d8', paladin: '1d6', ranger: '1d8',
    rogue: '1d6', wizard: '1d6', cleric: '1d6', druid: '1d4',
    monk: '1d6', bard: '1d6', sorcerer: '1d8', warlock: '1d10',
  };

  function rollDiceLocal(notation: string): number {
    const m = notation.match(/^(\d+)d(\d+)([+-]\d+)?$/);
    if (!m) return 1;
    const count = parseInt(m[1], 10);
    const sides = parseInt(m[2], 10);
    const bonus = m[3] ? parseInt(m[3], 10) : 0;
    let total = bonus;
    for (let i = 0; i < count; i++) total += rng.next(1, sides);
    return Math.max(1, total);
  }

  if (isFumble) {
    log.push(`  ${attacker.name.toUpperCase()} \u25b6 ${targetLabel} \u2014 FALLO (nat 1)`);
  } else if (isCrit || roll >= tgt.ac) {
    const weaponDice = CLASS_WEAPON_DICE_LOCAL[attacker.charClass.toLowerCase()] ?? '1d6';
    const baseDmg = rollDiceLocal(weaponDice);
    const rageBon = attacker.rageActive ? 4 : 0;
    const dmg = Math.max(1, baseDmg + atkMod + rageBon + (isCrit ? baseDmg : 0));
    tgt.currentHp = Math.max(0, tgt.currentHp - dmg);
    damageDone[attacker.name] = (damageDone[attacker.name] ?? 0) + dmg;
    const hitTag = isCrit ? 'CRIT!' : 'HIT';
    log.push(`  ${attacker.name.toUpperCase()} \u25b6 ${targetLabel} [${hitTag}] \u2212${dmg} HP`);
    if (tgt.currentHp <= 0) {
      tgt.defeated = true;
      log.push(`  \u2713 ${targetLabel} DERROTADO`);
    }
  } else {
    log.push(`  ${attacker.name.toUpperCase()} \u25b6 ${targetLabel} \u2014 FALLO (${roll} vs CA ${tgt.ac})`);
  }

  return { ...state, partyState, enemyState, log, damageDone };
}

export function resolvePlayerAbility(
  state: LiveCombatState,
  actorPartyIdx: number,
  targetIdx: number,
  rng: RNG,
): LiveCombatState {
  const partyState = state.partyState.map(p => ({ ...p }));
  const enemyState = state.enemyState.map(e => ({ ...e }));
  const attacker = partyState[actorPartyIdx];
  if (!attacker || attacker.abilityUsed) return state;
  // RI-07: a character who was just revived this turn cannot use active abilities
  if (attacker.justRevived) return state;

  const charClass = attacker.charClass.toLowerCase();
  const log = [...state.log];
  const damageDone = { ...state.damageDone };

  attacker.abilityUsed = true;

  function rollDiceLocal(notation: string): number {
    const m = notation.match(/^(\d+)d(\d+)([+-]\d+)?$/);
    if (!m) return 1;
    const count = parseInt(m[1], 10);
    const sides = parseInt(m[2], 10);
    const bonus = m[3] ? parseInt(m[3], 10) : 0;
    let total = bonus;
    for (let i = 0; i < count; i++) total += rng.next(1, sides);
    return Math.max(1, total);
  }

  function dealDmgToEnemy(dice: string, label: string, idx: number) {
    const tgt = enemyState[idx];
    if (!tgt || tgt.defeated) return;
    const dmg = rollDiceLocal(dice);
    tgt.currentHp = Math.max(0, tgt.currentHp - dmg);
    damageDone[attacker.name] = (damageDone[attacker.name] ?? 0) + dmg;
    log.push(`  ${attacker.name.toUpperCase()} ${label} \u25b6 ${tgt.displayName.toUpperCase().replace(/ /g, '_')} \u2212${dmg} HP`);
    if (tgt.currentHp <= 0) { tgt.defeated = true; log.push(`  \u2713 ${tgt.displayName.toUpperCase().replace(/ /g, '_')} DERROTADO`); }
  }

  switch (charClass) {
    case 'barbarian':
      attacker.rageActive = true;
      log.push(`  ${attacker.name.toUpperCase()} ENTRA EN FURIA (+4 DMG)`);
      break;
    case 'fighter': {
      const heal = rollDiceLocal('1d10') + 2;
      attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + heal);
      log.push(`  ${attacker.name.toUpperCase()} SEGUNDO_ALIENTO +${heal} HP`);
      break;
    }
    case 'paladin':
      dealDmgToEnemy('2d8', 'GOLPE_DIVINO', targetIdx);
      break;
    case 'ranger':
      dealDmgToEnemy('1d6', 'MARCA_CAZADOR', targetIdx);
      break;
    case 'rogue':
      dealDmgToEnemy('3d6', 'ATAQUE_FURTIVO', targetIdx);
      break;
    case 'wizard': {
      const d1 = rollDiceLocal('1d4') + 1;
      const d2 = rollDiceLocal('1d4') + 1;
      const d3 = rollDiceLocal('1d4') + 1;
      const totalDmg = d1 + d2 + d3;
      const tgt = enemyState[targetIdx];
      if (tgt && !tgt.defeated) {
        tgt.currentHp = Math.max(0, tgt.currentHp - totalDmg);
        damageDone[attacker.name] = (damageDone[attacker.name] ?? 0) + totalDmg;
        log.push(`  ${attacker.name.toUpperCase()} MISIL_MAGICO \u25b6 ${tgt.displayName.toUpperCase().replace(/ /g, '_')} \u2212${totalDmg} HP (sin falla)`);
        if (tgt.currentHp <= 0) { tgt.defeated = true; log.push(`  \u2713 ${tgt.displayName.toUpperCase().replace(/ /g, '_')} DERROTADO`); }
      }
      break;
    }
    case 'cleric': {
      const ally = partyState[targetIdx] ?? attacker;
      const wisMod = Math.floor((attacker.baseStats.WIS - 10) / 2);
      const heal = rollDiceLocal('1d4') + Math.max(0, wisMod);
      ally.currentHp = Math.min(ally.maxHp, ally.currentHp + heal);
      log.push(`  ${attacker.name.toUpperCase()} PALABRA_CURATIVA \u25b6 ${ally.name.toUpperCase()} +${heal} HP`);
      break;
    }
    case 'druid': {
      const tgt = enemyState[targetIdx];
      if (tgt && !tgt.defeated) {
        tgt.skipsNextTurn = true;
        log.push(`  ${attacker.name.toUpperCase()} ENREDAR \u25b6 ${tgt.displayName.toUpperCase().replace(/ /g, '_')} INMOVILIZADO`);
      }
      break;
    }
    case 'monk': {
      const tgt = enemyState[targetIdx];
      if (tgt && !tgt.defeated) {
        let total = 0;
        const strMod = Math.floor((attacker.baseStats.STR - 10) / 2);
        for (let k = 0; k < 2; k++) {
          const dmg = Math.max(1, rollDiceLocal('1d4') + strMod);
          total += dmg;
          tgt.currentHp = Math.max(0, tgt.currentHp - dmg);
        }
        damageDone[attacker.name] = (damageDone[attacker.name] ?? 0) + total;
        log.push(`  ${attacker.name.toUpperCase()} LLUVIA_DE_GOLPES \u25b6 ${tgt.displayName.toUpperCase().replace(/ /g, '_')} \u2212${total} HP`);
        if (tgt.currentHp <= 0) { tgt.defeated = true; log.push(`  \u2713 ${tgt.displayName.toUpperCase().replace(/ /g, '_')} DERROTADO`); }
      }
      break;
    }
    case 'bard': {
      const ally = partyState[targetIdx] ?? attacker;
      ally.inspiredBonus = 6;
      log.push(`  ${attacker.name.toUpperCase()} INSPIRAR \u25b6 ${ally.name.toUpperCase()} +1d6 proximo atq`);
      break;
    }
    case 'sorcerer':
      dealDmgToEnemy('3d8', 'ORBE_CROMATICO', targetIdx);
      break;
    case 'warlock':
      dealDmgToEnemy('1d10', 'EXPLOSION_OSCURA', targetIdx);
      break;
    default:
      break;
  }

  return { ...state, partyState, enemyState, log, damageDone };
}

export function resolveEnemyTurn(
  state: LiveCombatState,
  actorEnemyIdx: number,
  rng: RNG,
): LiveCombatState {
  const attacker = state.enemyState[actorEnemyIdx];
  if (!attacker || attacker.defeated) return state;

  const partyState = state.partyState.map(p => ({ ...p }));
  const enemyState = state.enemyState.map(e => ({ ...e }));
  const log = [...state.log];
  const atkLabel = attacker.displayName.toUpperCase().replace(/ /g, '_');

  // Handle stun (druid ENTANGLE)
  if (enemyState[actorEnemyIdx].skipsNextTurn) {
    enemyState[actorEnemyIdx].skipsNextTurn = false;
    log.push(`  ${atkLabel} INMOVILIZADO \u2014 pierde turno`);
    return { ...state, partyState, enemyState, log };
  }

  const aliveTargets = partyState.filter(c => c.currentHp > 0);
  if (aliveTargets.length === 0) return state;

  const targetMember = aliveTargets[rng.next(0, aliveTargets.length - 1)];
  const targetInParty = partyState.findIndex(p => p.name === targetMember.name);
  const target = partyState[targetInParty];

  function rollDiceLocal(notation: string): number {
    const m = notation.match(/^(\d+)d(\d+)([+-]\d+)?$/);
    if (!m) return 1;
    const count = parseInt(m[1], 10);
    const sides = parseInt(m[2], 10);
    const bonus = m[3] ? parseInt(m[3], 10) : 0;
    let total = bonus;
    for (let i = 0; i < count; i++) total += rng.next(1, sides);
    return Math.max(1, total);
  }

  const targetAC = 10 + Math.floor((target.baseStats.DEX - 10) / 2);
  // UI-01: if target is dodging, enemy rolls with disadvantage (take lower of two d20s)
  let d20 = rng.next(1, 20);
  if (target.dodging) {
    const d20b = rng.next(1, 20);
    d20 = Math.min(d20, d20b);
  }
  const roll = d20 + attacker.attackBonus;
  const isCrit = d20 === 20;
  const isFumble = d20 === 1;

  if (isFumble) {
    log.push(`  ${atkLabel} \u25b6 ${target.name.toUpperCase()} \u2014 FALLO (nat 1)`);
  } else if (isCrit || roll >= targetAC) {
    const baseDmg = rollDiceLocal(attacker.damage);
    const dmg = Math.max(1, isCrit ? baseDmg * 2 : baseDmg);
    target.currentHp = Math.max(0, target.currentHp - dmg);
    const hitTag = isCrit ? 'CRIT!' : 'HIT';
    log.push(`  ${atkLabel} \u25b6 ${target.name.toUpperCase()} [${hitTag}] \u2212${dmg} HP`);
    if (target.currentHp <= 0) {
      log.push(`  \u2717 ${target.name.toUpperCase()} CA\u00cdDO`);
    }
  } else {
    log.push(`  ${atkLabel} \u25b6 ${target.name.toUpperCase()} \u2014 FALLO (${roll} vs CA ${targetAC})`);
  }

  return { ...state, partyState, enemyState, log };
}

/** UI-01: Player chooses ESQUIVAR — sets dodging=true, ends turn. */
export function resolvePlayerDodge(
  state: LiveCombatState,
  actorPartyIdx: number,
): LiveCombatState {
  const log = [...state.log];
  const partyState = state.partyState.map((m, idx) =>
    idx === actorPartyIdx
      ? { ...m, dodging: true, standardActionUsed: true }
      : m,
  );
  const actor = partyState[actorPartyIdx];
  log.push(`  ${actor.name.toUpperCase()} — ESQUIVA (ventaja defensiva hasta próximo turno)`);
  return { ...state, partyState, log };
}

/** UI-01: Player chooses AVANZAR — +10ft movement flavour, ends turn. */
export function resolvePlayerDash(
  state: LiveCombatState,
  actorPartyIdx: number,
): LiveCombatState {
  const log = [...state.log];
  const partyState = state.partyState.map((m, idx) =>
    idx === actorPartyIdx ? { ...m, standardActionUsed: true } : m,
  );
  const actor = partyState[actorPartyIdx];
  log.push(`  ${actor.name.toUpperCase()} — AVANZA (acción de carrera)`);
  return { ...state, partyState, log };
}

/** UI-01: Player chooses AYUDAR — grants advantage to next ally attack (inspiredBonus flag). */
export function resolvePlayerHelp(
  state: LiveCombatState,
  actorPartyIdx: number,
  targetPartyIdx: number,
): LiveCombatState {
  const log = [...state.log];
  const partyState = state.partyState.map((m, idx) => {
    if (idx === actorPartyIdx) return { ...m, standardActionUsed: true };
    // Grant a d4 inspired bonus to the helped ally
    if (idx === targetPartyIdx) return { ...m, inspiredBonus: 4 };
    return m;
  });
  const actor = partyState[actorPartyIdx];
  const helped = partyState[targetPartyIdx];
  log.push(`  ${actor.name.toUpperCase()} AYUDA a ${helped.name.toUpperCase()} (próximo ataque con ventaja)`);
  return { ...state, partyState, log };
}

export function buildCombatResultFromLive(
  state: LiveCombatState,
  killRecords: KillRecord[],
  rng: RNG,
): CombatResult {
  const LOOT: string[] = [
    'GOLD_COINS x5', 'IRON_DAGGER', 'HEALTH_POTION',
    'SHADOW_ESSENCE x2', 'TORCH x3', 'OLD_MAP',
    'BONE_FRAGMENT', 'TATTERED_SCROLL',
  ];

  const defeatedEnemies: CombatEnemy[] = state.enemyState
    .filter(e => e.defeated)
    .map(e => {
      const prevKills = killRecords.find(k => k.monsterType === e.name)?.killCount ?? 0;
      const xpEarned = calculateXP(e, prevKills);
      const lootRoll = rng.next(0, 2);
      const loot = lootRoll > 0 ? LOOT[rng.next(0, LOOT.length - 1)] : null;
      return { name: e.displayName.toUpperCase().replace(/ /g, '_'), xpEarned, loot };
    });

  const totalXp = defeatedEnemies.reduce((s, e) => s + e.xpEarned, 0);
  const goldEarned = Math.round(totalXp * GOLD_PER_XP) + rng.next(5, 25);

  const partyAfter: CombatPartyMember[] = state.partyState.map(c => ({
    characterId: c.characterId,
    name: c.name,
    charClass: c.charClass,
    hpBefore: c.hpBefore,
    hpAfter: Math.max(0, c.currentHp),
    alive: c.currentHp > 0,
  }));

  // ── Derive typed events from final state ─────────────────
  const events: CombatEvent[] = [];

  // Fallen party members
  state.partyState
    .filter(m => m.currentHp <= 0 && m.hpBefore > 0)
    .forEach(m => events.push({ type: 'ALLY_DOWN', actorName: m.name, turn: state.round }));

  // Critical HP states
  state.partyState
    .filter(m => m.currentHp > 0)
    .forEach(m => {
      const pct = m.currentHp / m.maxHp;
      if (pct < 0.10) {
        events.push({ type: 'VERY_LOW_HEALTH', actorName: m.name, value: Math.round(pct * 100), turn: state.round });
      } else if (pct < 0.25) {
        events.push({ type: 'LOW_HEALTH', actorName: m.name, value: Math.round(pct * 100), turn: state.round });
      }
    });

  // Parse log for crits and fumbles
  state.log.forEach((line, i) => {
    if (line.includes('CRIT!')) {
      const isPartyAttack = state.partyState.some(m => line.startsWith(`  ${m.name.toUpperCase()}`));
      const actorName = state.partyState.find(m => line.startsWith(`  ${m.name.toUpperCase()}`))?.name
        ?? state.enemyState.find(e => line.startsWith(`  ${e.displayName.toUpperCase().replace(/ /g, '_')}`))?.displayName
        ?? 'unknown';
      events.push({
        type: isPartyAttack ? 'CRIT_DEALT' : 'CRIT_RECEIVED',
        actorName,
        turn: Math.floor(i / Math.max(1, state.turnOrder.length)) + 1,
      });
    }
    if (line.includes('nat 1')) {
      const actorName = state.partyState.find(m => line.includes(m.name.toUpperCase()))?.name ?? 'unknown';
      events.push({ type: 'NAT_ONE', actorName, turn: state.round });
    }
  });

  // Abilities used (parse from log markers)
  const ABILITY_MARKERS = [
    'FURIA', 'SEGUNDO_ALIENTO', 'GOLPE_DIVINO', 'MARCA_CAZADOR',
    'ATAQUE_FURTIVO', 'MISIL_MAGICO', 'PALABRA_CURATIVA', 'ENREDAR',
    'LLUVIA_DE_GOLPES', 'INSPIRAR', 'ORBE_CROMATICO', 'EXPLOSION_OSCURA',
  ];
  state.log.forEach(line => {
    const marker = ABILITY_MARKERS.find(m => line.includes(m));
    if (marker) {
      const actorName = state.partyState.find(m => line.includes(m.name.toUpperCase()))?.name ?? 'unknown';
      events.push({ type: 'ABILITY_USED', actorName, turn: state.round });
    }
  });

  // Defeated enemies
  defeatedEnemies.forEach(e => {
    events.push({ type: 'ENEMY_DEFEATED', actorName: e.name, turn: state.round });
  });

  // Final outcome
  events.push({
    type: state.outcome === 'VICTORY' ? 'VICTORY' : 'DEFEAT',
    actorName: 'party',
    turn: state.round,
  });

  return {
    outcome: state.outcome ?? 'DEFEAT',
    roundsElapsed: state.round,
    partyAfter,
    enemiesDefeated: defeatedEnemies,
    totalXp,
    goldEarned,
    damageDone: state.damageDone,
    log: state.log,
    events,
  };
}
