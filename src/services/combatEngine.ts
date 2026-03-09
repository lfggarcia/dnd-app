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

// ─── Public types ─────────────────────────────────────────────────────────────

export type CombatPartyMember = {
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
};

// ─── PRNG (djb2 + LCG — matches dungeonGraphService.ts) ──────────────────────

function makePRNG(seed: string) {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(h, 33) ^ seed.charCodeAt(i)) >>> 0;
  }
  let s = h >>> 0;
  return {
    next(min = 0, max = 1): number {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      const f = s / 0x100000000;
      if (min === 0 && max === 1) return f;
      return Math.floor(min + f * (max - min + 1));
    },
  };
}

// ─── Dice parser ──────────────────────────────────────────────────────────────

function rollDice(notation: string, rng: ReturnType<typeof makePRNG>): number {
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
  const partyState = party
    .filter(c => c.alive)
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
  const goldEarned = Math.round(totalXp * 0.15) + rng.next(5, 25);

  const partyAfter: CombatPartyMember[] = partyState.map(c => ({
    name:     c.name,
    charClass: c.charClass,
    hpBefore: c.hpBefore,
    hpAfter:  Math.max(0, c.currentHp),
    alive:    c.currentHp > 0,
  }));

  return { outcome, roundsElapsed: round, partyAfter, enemiesDefeated: defeatedEnemies, totalXp, goldEarned, damageDone, log };
}
