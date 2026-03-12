/**
 * aiProfileEngine.ts
 * Profile strategy engine for AI parties — Sprint 7 (doc 09).
 *
 * Extracted from worldSimulator.ts so the profile logic is shareable
 * and can integrate with aiMemoryService for adaptive behaviour.
 *
 * SYSTEMS.MD: "Perfil base generado al inicio. Evolución cultural cada 15 ciclos."
 */

import { makePRNG } from '../utils/prng';
import type { AIMemoryState } from './aiMemoryService';
import {
  getAdaptiveWeights,
  MUTATION_INTERVAL,
  evaluateCulturalAdoption,
} from './aiMemoryService';

// ─── Types ────────────────────────────────────────────────

export type AIProfile =
  | 'AGGRESSIVE'
  | 'DEFENSIVE'
  | 'OPPORTUNISTIC'
  | 'EXPANSIONIST'
  | 'SURVIVALIST';

export type AIAction =
  | 'explore'
  | 'fightMonster'
  | 'huntParty'
  | 'avoidCombat'
  | 'rest'
  | 'advanceFloor';

// ─── Perfil base (seed-based, sin memoria) ───────────────────

/**
 * Derives a deterministic base profile from the party name + seed.
 * Result is the same every call for the same inputs (PRNG-stable).
 */
export function deriveBaseProfile(partyName: string, seedHash: string): AIProfile {
  const rng = makePRNG(`${seedHash}_profile_${partyName}`);
  const profiles: AIProfile[] = [
    'AGGRESSIVE',
    'DEFENSIVE',
    'OPPORTUNISTIC',
    'EXPANSIONIST',
    'SURVIVALIST',
  ];
  return profiles[Math.floor(rng.float() * profiles.length)];
}

// ─── Pesos base por perfil ────────────────────────────────

const BASE_WEIGHTS: Record<AIAction, number> = {
  explore:      0.30,
  fightMonster: 0.25,
  huntParty:    0.10,
  avoidCombat:  0.15,
  rest:         0.10,
  advanceFloor: 0.10,
};

function getBaseWeights(profile: AIProfile): Record<AIAction, number> {
  switch (profile) {
    case 'AGGRESSIVE':
      return {
        ...BASE_WEIGHTS,
        huntParty:    0.25,
        rest:         0.05,
        fightMonster: 0.35,
        avoidCombat:  0.05,
      };
    case 'DEFENSIVE':
      return {
        ...BASE_WEIGHTS,
        rest:         0.20,
        avoidCombat:  0.25,
        huntParty:    0.02,
        explore:      0.25,
      };
    case 'OPPORTUNISTIC':
      return {
        ...BASE_WEIGHTS,
        huntParty:    0.15,
        fightMonster: 0.30,
        advanceFloor: 0.20,
      };
    case 'EXPANSIONIST':
      return {
        ...BASE_WEIGHTS,
        advanceFloor: 0.30,
        explore:      0.25,
        huntParty:    0.05,
        rest:         0.05,
      };
    case 'SURVIVALIST':
      return {
        ...BASE_WEIGHTS,
        rest:         0.25,
        avoidCombat:  0.30,
        huntParty:    0.00,
        explore:      0.20,
      };
    default:
      return { ...BASE_WEIGHTS };
  }
}

/**
 * Returns action weights for a profile, optionally modulated by memory.
 * When memory is provided the adaptive weight deltas from aiMemoryService
 * are merged on top of the profile's base weights.
 */
export function getActionWeights(
  profile: AIProfile,
  memory: AIMemoryState | null,
): Record<AIAction, number> {
  const base = getBaseWeights(profile);
  if (!memory) return base;

  const adaptive = getAdaptiveWeights(memory);
  const merged: Record<AIAction, number> = { ...base };

  for (const key of Object.keys(merged) as AIAction[]) {
    merged[key] = Math.max(0, merged[key] + (adaptive[key] ?? 0));
  }

  return merged;
}

// ─── Mutación cultural ────────────────────────────────────

/**
 * Every MUTATION_INTERVAL cycles a party may adopt a neighbour profile.
 * Uses evaluateCulturalAdoption from aiMemoryService to decide.
 *
 * Returns the (possibly mutated) profile for this cycle.
 */
export function maybeMutateProfile(
  currentProfile: AIProfile,
  memory: AIMemoryState,
  cycle: number,
  seedHash: string,
  neighborProfiles: AIProfile[],
  neighborMemories: AIMemoryState[],
): AIProfile {
  if (cycle % MUTATION_INTERVAL !== 0) return currentProfile;

  const { shouldAdopt, adoptFrom } = evaluateCulturalAdoption(
    memory,
    neighborMemories,
    cycle,
    seedHash,
  );

  if (!shouldAdopt || !adoptFrom) return currentProfile;

  const idx = neighborMemories.findIndex(m => m.partyName === adoptFrom);
  if (idx >= 0 && idx < neighborProfiles.length) {
    if (__DEV__) {
      console.log(
        `[aiProfileEngine] ${memory.partyName} adopts ${neighborProfiles[idx]} from ${adoptFrom} at cycle ${cycle}`,
      );
    }
    return neighborProfiles[idx];
  }

  return currentProfile;
}
