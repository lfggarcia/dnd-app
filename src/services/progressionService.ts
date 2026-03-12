/**
 * progressionService.ts
 * XP, level-ups y progresión de personajes — Sprint 6 (doc 06).
 *
 * SYSTEMS.MD: "MAX_LEVEL MVP = 10. Sube al confirmar en CampScreen."
 * Las fórmulas de XP están en rulesConfig.ts (XP_TABLE, getLevelForXP).
 */

import type { CharacterSave } from '../database/gameRepository';
import { getLevelForXP, getXPToNextLevel } from './rulesConfig';

// ─── Constantes ───────────────────────────────────────────

export const MAX_LEVEL_MVP = 10;

/** XP por tipo de objetivo. */
export const XP_REWARDS = {
  MONSTER:       25,   // monstruo normal
  ELITE_MONSTER: 75,   // elite / mini-boss
  BOSS:          300,  // jefe de piso
  RIVAL_PARTY:   150,  // party IA eliminada (dividido entre sobrevivientes)
  FLOOR_CLEAR:   50,   // completar todos los cuartos del piso
} as const;

// ─── Types ────────────────────────────────────────────────

export type XPRewardSource = keyof typeof XP_REWARDS;

export type LevelUpResult = {
  char: CharacterSave;
  levelsGained: number;
  hpGained: number;
};

// ─── XP ───────────────────────────────────────────────────

/**
 * Genera los updates de XP para todos los personajes vivos de la party.
 * El XP se reparte equitativamente entre los vivos.
 */
export function awardXP(
  party: CharacterSave[],
  source: XPRewardSource,
  count = 1,
): CharacterSave[] {
  const totalXP = XP_REWARDS[source] * count;
  const aliveCount = party.filter(c => c.alive).length;
  if (aliveCount === 0) return party;

  const xpPerChar = Math.floor(totalXP / aliveCount);

  return party.map(char => {
    if (!char.alive) return char;
    const newXP = (char.xp ?? 0) + xpPerChar;
    const newLevel = Math.min(MAX_LEVEL_MVP, getLevelForXP(newXP));
    const pendingGained = Math.max(0, newLevel - (char.level ?? 1));
    return {
      ...char,
      xp: newXP,
      pendingLevelUps: (char.pendingLevelUps ?? 0) + pendingGained,
    };
  });
}

/**
 * Confirma todos los pendingLevelUps para un personaje (llamar desde CampScreen).
 * SYSTEMS.MD: "Level-ups se confirman en CampScreen, no en combate."
 */
export function confirmLevelUps(char: CharacterSave): LevelUpResult {
  const pending = char.pendingLevelUps ?? 0;
  if (pending === 0) {
    return { char, levelsGained: 0, hpGained: 0 };
  }

  const newLevel = Math.min(MAX_LEVEL_MVP, (char.level ?? 1) + pending);
  const actualGained = newLevel - (char.level ?? 1);

  // HP por nivel: basado en hit die de la clase (simplificado — promedio del dado + CON mod)
  const conMod = Math.floor(((char.baseStats?.CON ?? 10) - 10) / 2);
  const hpPerLevel = Math.max(4, 5 + conMod);  // mínimo 4 HP por nivel
  const hpGained = actualGained * hpPerLevel;

  const updated: CharacterSave = {
    ...char,
    level: newLevel,
    maxHp: (char.maxHp ?? 10) + hpGained,
    hp: (char.hp ?? 10) + hpGained,  // subir de nivel restaura los HP ganados
    pendingLevelUps: 0,
  };

  return { char: updated, levelsGained: actualGained, hpGained };
}

/**
 * Texto de progreso de XP para mostrar en UI.
 * ej: "750 / 1200 XP (nv 3)"
 */
export function formatXPProgress(char: CharacterSave): string {
  const level = char.level ?? 1;
  const xp = char.xp ?? 0;
  if (level >= MAX_LEVEL_MVP) return `MAX (nv${level})`;
  const nextLevelXP = getXPToNextLevel(level);
  return `${xp} / ${nextLevelXP} XP (nv ${level})`;
}

/**
 * SYSTEMS.MD §6C: When a player starts a new party on an existing seed,
 * the new party starts at the average level of the previous party's survivors.
 * Minimum starting level is 1, maximum is the highest previous level.
 */
export function getInheritedLevel(previousParty: CharacterSave[]): number {
  const survivors = previousParty.filter(c => c.alive);
  if (survivors.length === 0) {
    // All dead — inherit from the highest-leveled character
    const maxLevel = Math.max(1, ...previousParty.map(c => c.level ?? 1));
    return Math.max(1, Math.floor(maxLevel * 0.5)); // penalty for full-wipe
  }
  const avgLevel = survivors.reduce((sum, c) => sum + (c.level ?? 1), 0) / survivors.length;
  return Math.max(1, Math.floor(avgLevel));
}
