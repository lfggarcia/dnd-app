/**
 * culturalEvolution.ts
 * Evolutionary Game Theory utilities for TORRE AI parties — Sprint 7 (doc 09).
 *
 * SYSTEMS.MD: "Las parties vecinas se observan y copian estrategias exitosas."
 * Implements fitness scoring and best-profile selection.
 */

import type { AIMemoryState } from './aiMemoryService';
import type { AIProfile } from './aiProfileEngine';

// ─── Fitness scoring ──────────────────────────────────────

/**
 * FitnessScore = (wins × 2 - losses × 1.5 + gold × 0.01) / max(1, totalCombats)
 *
 * A higher score means a party is more successful and worth copying.
 */
export function calculateFitnessScore(memory: AIMemoryState): number {
  const totalCombats = memory.totalWins + memory.totalLosses;
  if (totalCombats === 0) return 0;

  // Aggregate gold from combat reward history
  const totalGold = memory.recentCombats.reduce((sum, c) => sum + c.reward, 0);

  return (
    (memory.totalWins * 2
      - memory.totalLosses * 1.5
      + totalGold * 0.01)
    / Math.max(1, totalCombats)
  );
}

// ─── Best-neighbour selection ─────────────────────────────

/**
 * Returns the AI profile of the neighbour with the highest fitness score,
 * or null if no neighbour is significantly better (threshold: > 0.25 ahead).
 */
export function selectBestNeighborProfile(
  neighborMemories: AIMemoryState[],
  neighborProfiles: AIProfile[],
): AIProfile | null {
  if (neighborMemories.length === 0) return null;

  let bestScore = 0.25; // minimum advantage threshold
  let bestProfile: AIProfile | null = null;

  for (let i = 0; i < neighborMemories.length; i++) {
    const score = calculateFitnessScore(neighborMemories[i]);
    if (score > bestScore) {
      bestScore = score;
      bestProfile = neighborProfiles[i] ?? null;
    }
  }

  return bestProfile;
}

// ─── Population-level fitness summary ────────────────────

/**
 * Returns a sorted summary of all parties' fitness scores.
 * Useful for logging and benchmarks.
 */
export function rankPartiesByFitness(
  memories: AIMemoryState[],
  profiles: AIProfile[],
): Array<{ partyName: string; profile: AIProfile; fitness: number }> {
  return memories
    .map((m, i) => ({
      partyName: m.partyName,
      profile: profiles[i] ?? 'OPPORTUNISTIC',
      fitness: calculateFitnessScore(m),
    }))
    .sort((a, b) => b.fitness - a.fitness);
}
