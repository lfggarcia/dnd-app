/**
 * Monster Evolution, XP, and Secret Boss System
 *
 * Implements:
 * - Substitutive monster evolution by cycle (not quantity increase)
 * - XP decay: 100% → 30% → 10% → 0% on repeated kills
 * - Secret boss trigger conditions
 *
 * Based on: "Sistema de Evolución de Monstruos y Balance de Progresión"
 */

import type { EnemyType } from './enemySpriteService';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MonsterStats {
  name: string;
  displayName: string;
  hp: number;
  ac: number;
  attackBonus: number;
  damage: string; // dice notation e.g. "1d6+2"
  xpReward: number;
  cr: number;     // Challenge Rating
  stealth: number;
  type: EnemyType;
}

export interface KillRecord {
  /** Monster index key (e.g. "skeleton", "goblin_veteran") */
  monsterType: string;
  killCount: number;
}

export interface SecretBossCondition {
  id: string;
  name: string;
  description: string;
  check: (kills: KillRecord[], floor: number, cycle: number, flags: string[]) => boolean;
}

// ─── Evolution tiers ─────────────────────────────────────────────────────────

/**
 * Calculate the evolution tier based on cycle and floor.
 * evolutionTier = floor(cycle / 5), capped by floor / 10
 */
export function getEvolutionTier(cycle: number, floorNumber: number): number {
  const tier = Math.floor(cycle / 5);
  const cap = Math.floor(floorNumber / 10);
  return Math.min(tier, cap);
}

// ─── Monster stat tables ──────────────────────────────────────────────────────

const MONSTER_STATS: Record<string, MonsterStats> = {
  // Skeletons (tier 0–3)
  skeleton: {
    name: 'skeleton', displayName: 'Skeleton',
    hp: 13, ac: 13, attackBonus: 4, damage: '1d6+2', xpReward: 50, cr: 0.25, stealth: 12,
    type: 'skeleton',
  },
  skeleton_archer: {
    name: 'skeleton_archer', displayName: 'Skeleton Archer',
    hp: 15, ac: 13, attackBonus: 4, damage: '2d6+2', xpReward: 75, cr: 0.5, stealth: 13,
    type: 'skeleton_archer',
  },
  skeleton_knight: {
    name: 'skeleton_knight', displayName: 'Skeleton Knight',
    hp: 26, ac: 16, attackBonus: 5, damage: '1d8+3', xpReward: 100, cr: 1, stealth: 10,
    type: 'skeleton_knight',
  },
  skeleton_mage: {
    name: 'skeleton_mage', displayName: 'Skeleton Mage',
    hp: 22, ac: 11, attackBonus: 5, damage: '2d8+3', xpReward: 200, cr: 2, stealth: 11,
    type: 'skeleton_mage',
  },

  // Goblins (tier 0–3)
  goblin: {
    name: 'goblin', displayName: 'Goblin',
    hp: 7, ac: 15, attackBonus: 4, damage: '1d6+2', xpReward: 50, cr: 0.25, stealth: 14,
    type: 'goblin',
  },
  goblin_veteran: {
    name: 'goblin_veteran', displayName: 'Goblin Veterans',
    hp: 13, ac: 15, attackBonus: 5, damage: '1d6+3', xpReward: 100, cr: 0.5, stealth: 15,
    type: 'goblin_veteran',
  },
  goblin_raider: {
    name: 'goblin_raider', displayName: 'Goblin Raider',
    hp: 18, ac: 14, attackBonus: 5, damage: '2d6+3', xpReward: 150, cr: 1, stealth: 14,
    type: 'goblin_raider',
  },
  goblin_champion: {
    name: 'goblin_champion', displayName: 'Goblin Champion',
    hp: 27, ac: 16, attackBonus: 6, damage: '2d8+3', xpReward: 450, cr: 2, stealth: 12,
    type: 'goblin_champion',
  },

  // Rats (tier 0–2)
  rat: {
    name: 'rat', displayName: 'Giant Rat',
    hp: 7, ac: 12, attackBonus: 4, damage: '2d4', xpReward: 25, cr: 0.125, stealth: 12,
    type: 'rat',
  },
  dire_rat: {
    name: 'dire_rat', displayName: 'Dire Rat',
    hp: 16, ac: 12, attackBonus: 6, damage: '2d6+3', xpReward: 100, cr: 0.5, stealth: 11,
    type: 'dire_rat',
  },

  // Cultists / Knights
  cultist: {
    name: 'cultist', displayName: 'Dark Cultist',
    hp: 9, ac: 12, attackBonus: 3, damage: '2d6', xpReward: 50, cr: 0.125, stealth: 11,
    type: 'cultist',
  },
  knight: {
    name: 'knight', displayName: 'Corrupted Knight',
    hp: 52, ac: 18, attackBonus: 5, damage: '2d8+3', xpReward: 700, cr: 3, stealth: 10,
    type: 'knight',
  },

  // Demons
  demon: {
    name: 'demon', displayName: 'Imp Demon',
    hp: 10, ac: 13, attackBonus: 5, damage: '2d4+3', xpReward: 200, cr: 1, stealth: 15,
    type: 'demon',
  },

  // Lich (boss)
  lich: {
    name: 'lich', displayName: 'Ancient Lich',
    hp: 135, ac: 17, attackBonus: 10, damage: '4d8+6', xpReward: 10000, cr: 21, stealth: 13,
    type: 'lich',
  },
};

// ─── Evolution chains ─────────────────────────────────────────────────────────

const EVOLUTION_CHAINS: Record<string, string[]> = {
  skeleton:  ['skeleton', 'skeleton_archer', 'skeleton_knight', 'skeleton_mage'],
  goblin:    ['goblin', 'goblin_veteran', 'goblin_raider', 'goblin_champion'],
  rat:       ['rat', 'rat', 'dire_rat', 'dire_rat'],
  cultist:   ['cultist', 'cultist', 'knight', 'knight'],
  demon:     ['demon', 'demon', 'demon', 'demon'],
};

/**
 * Get the evolved monster type for a base enemy at a given cycle + floor.
 */
export function getEvolvedMonster(
  baseType: string,
  cycle: number,
  floorNumber: number,
): MonsterStats {
  const tier = getEvolutionTier(cycle, floorNumber);
  const chain = EVOLUTION_CHAINS[baseType];
  const evolved = chain ? chain[Math.min(tier, chain.length - 1)] : baseType;
  return MONSTER_STATS[evolved] ?? MONSTER_STATS[baseType] ?? MONSTER_STATS.goblin;
}

/**
 * Get monster stats by exact key.
 */
export function getMonsterStats(key: string): MonsterStats {
  return MONSTER_STATS[key] ?? MONSTER_STATS.goblin;
}

// ─── XP System ───────────────────────────────────────────────────────────────

const XP_MULTIPLIERS = [1.0, 0.3, 0.1, 0];

/**
 * Calculate XP earned for killing a monster, given how many times this
 * monster type has been killed before.
 * 1st kill = 100%, 2nd = 30%, 3rd = 10%, 4th+ = 0%
 */
export function calculateXP(
  monster: MonsterStats,
  previousKillCount: number,
): number {
  const idx = Math.min(previousKillCount, XP_MULTIPLIERS.length - 1);
  return Math.round(monster.xpReward * XP_MULTIPLIERS[idx]);
}

/**
 * Update kill records after defeating a monster.
 */
export function recordKill(records: KillRecord[], monsterType: string): KillRecord[] {
  const existing = records.find(r => r.monsterType === monsterType);
  if (existing) {
    return records.map(r =>
      r.monsterType === monsterType ? { ...r, killCount: r.killCount + 1 } : r,
    );
  }
  return [...records, { monsterType, killCount: 1 }];
}

/**
 * Get the kill count for a monster type.
 */
export function getKillCount(records: KillRecord[], monsterType: string): number {
  return records.find(r => r.monsterType === monsterType)?.killCount ?? 0;
}

// ─── Secret Bosses ───────────────────────────────────────────────────────────

export const SECRET_BOSS_CONDITIONS: SecretBossCondition[] = [
  {
    id: 'forgotten_lich',
    name: 'The Forgotten Lich',
    description: 'An ancient lich awakened by mass skeleton slaughter.',
    check: (kills, floor, _cycle, flags) => {
      const skeletonKills =
        (kills.find(k => k.monsterType === 'skeleton')?.killCount ?? 0) +
        (kills.find(k => k.monsterType === 'skeleton_knight')?.killCount ?? 0) +
        (kills.find(k => k.monsterType === 'skeleton_mage')?.killCount ?? 0);
      return skeletonKills >= 30 && floor >= 20 && !flags.includes('no_fire_on_undead');
    },
  },
  {
    id: 'goblin_emperor',
    name: 'Goblin Emperor',
    description: 'The Goblin Emperor rises after the goblins unite.',
    check: (kills, _floor, cycle, _flags) => {
      const goblinKingKilled = kills.some(k => k.monsterType === 'goblin_champion' && k.killCount >= 1);
      const goblinFamilyKilled = kills.some(k => k.monsterType === 'goblin_raider' && k.killCount >= 1);
      return goblinKingKilled && goblinFamilyKilled && cycle >= 3;
    },
  },
];

/**
 * Check if any secret boss conditions are met.
 * Returns the IDs of triggered bosses.
 */
export function checkSecretBossTriggers(
  kills: KillRecord[],
  floor: number,
  cycle: number,
  flags: string[],
): string[] {
  return SECRET_BOSS_CONDITIONS
    .filter(c => c.check(kills, floor, cycle, flags))
    .map(c => c.id);
}
