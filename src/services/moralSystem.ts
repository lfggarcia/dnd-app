/**
 * moralSystem.ts
 * Moral, abandono y reemplazo de personajes — Sprint 6 (doc 05).
 *
 * SYSTEMS.MD: "Si la party ataca frecuentemente otras parties → tensión moral → abandono"
 * El abandono es determinístico por seed + ciclo.
 */

import { makePRNG } from '../utils/prng';
import type { CharacterSave } from '../database/gameRepository';
import { generateId } from '../database/gameRepository';

// ─── Constantes ───────────────────────────────────────────

export const MORALE_INITIAL    = 80;
export const MORALE_MIN        = 0;
export const MORALE_MAX        = 100;
export const ABANDON_THRESHOLD = 20;

// ─── Tipos ────────────────────────────────────────────────

export type MoralEvent =
  | 'KILL_MONSTER'
  | 'KILL_RIVAL_PARTY'
  | 'PARTY_MEMBER_DIED'
  | 'BOSS_DEFEATED'
  | 'REST_LONG'
  | 'FLOOR_ADVANCE'
  | 'MEMBER_ABANDONED'
  | 'GOLD_REWARD'
  | 'DEFEAT_IN_COMBAT';

export type AbandonCheckResult = {
  abandoned: CharacterSave[];
  remained: CharacterSave[];
  log: string[];
};

// ─── Helpers de alineamiento ──────────────────────────────

export function isGoodOrLawful(alignment: string): boolean {
  const l = alignment.toLowerCase();
  return l.includes('good') || l.includes('lawful') ||
         l.includes('bueno') || l.includes('legal');
}

// ─── Deltas de moral por evento ───────────────────────────

const MORALE_DELTAS: Record<MoralEvent, (alignment: string) => number> = {
  KILL_MONSTER:      () => 1,
  KILL_RIVAL_PARTY:  (a) => isGoodOrLawful(a) ? -20 : -5,
  PARTY_MEMBER_DIED: () => -10,
  BOSS_DEFEATED:     () => 15,
  REST_LONG:         () => 5,
  FLOOR_ADVANCE:     () => 8,
  MEMBER_ABANDONED:  () => -15,
  GOLD_REWARD:       () => 3,
  DEFEAT_IN_COMBAT:  () => -15,
};

// ─── Aplicar evento moral ─────────────────────────────────

/**
 * Aplica un evento moral a todos los personajes vivos de la party.
 */
export function applyMoralEvent(
  party: CharacterSave[],
  event: MoralEvent,
): CharacterSave[] {
  return party.map(char => {
    if (!char.alive) return char;
    const delta = MORALE_DELTAS[event](char.alignment ?? 'True Neutral');
    const newMorale = Math.max(
      MORALE_MIN,
      Math.min(MORALE_MAX, (char.morale ?? MORALE_INITIAL) + delta),
    );
    return { ...char, morale: newMorale };
  });
}

// ─── Verificar abandono ───────────────────────────────────

/**
 * SYSTEMS.MD: "Si moral < 20 y alineamiento bueno/legal → puede abandonar"
 * Determinístico: el mismo seedHash + cycle siempre produce los mismos abandonos.
 */
export function checkForAbandonment(
  party: CharacterSave[],
  seedHash: string,
  cycle: number,
): AbandonCheckResult {
  const log: string[] = [];
  const abandoned: CharacterSave[] = [];
  const remained: CharacterSave[] = [];
  const rng = makePRNG(`${seedHash}_moral_${cycle}`);

  for (const char of party) {
    if (!char.alive) {
      remained.push(char);
      continue;
    }

    const morale = char.morale ?? MORALE_INITIAL;
    // CR-014: DnD 5e — Chaotic/Evil characters desert for self-interest; Lawful/Good stay loyal
    const atRisk = morale < ABANDON_THRESHOLD && !isGoodOrLawful(char.alignment ?? '');

    if (atRisk) {
      const abandonChance = (ABANDON_THRESHOLD - morale) / ABANDON_THRESHOLD;
      if (rng.bool(abandonChance)) {
        abandoned.push(char);
        log.push(
          `${char.name.toUpperCase()} ABANDONA LA PARTY — moral demasiado baja (${morale})`,
        );
        continue;
      }
    }

    remained.push(char);
  }

  return { abandoned, remained, log };
}

// ─── Reemplazo ────────────────────────────────────────────

/**
 * Genera un aventurero de reemplazo cuando un miembro abandona.
 * SYSTEMS.MD: "Se genera del pool exclusivo. Mismo nivel base."
 */
export function generateReplacementAdventurer(
  abandonedChar: CharacterSave,
  cycle: number,
): CharacterSave {
  return {
    ...abandonedChar,
    characterId: generateId(),
    name: `RECRUIT_${cycle}`,
    alignment: 'True Neutral',
    morale: 60,
    killCount: 0,
    deathCount: 0,
    hp: abandonedChar.maxHp,
    alive: true,
    baseStats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
  };
}

/**
 * Retorna el nivel de moral como texto para la UI.
 */
export function getMoraleLabel(morale: number): string {
  if (morale >= 80) return 'ALTA';
  if (morale >= 60) return 'BUENA';
  if (morale >= 40) return 'NORMAL';
  if (morale >= 20) return 'BAJA';
  return 'CRÍTICA';
}
