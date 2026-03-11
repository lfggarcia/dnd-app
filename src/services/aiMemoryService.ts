/**
 * aiMemoryService.ts
 * Memoria adaptativa para parties IA — Sprint 7 (doc 09).
 *
 * SYSTEMS.MD: "Cada party IA guarda últimas 20 decisiones, últimos 10 combates,
 * historial de victorias/derrotas, tendencias de enemigos."
 * Prerequisito: worldSimulator.ts (Sprint 5C) completamente implementado.
 */

import { makePRNG } from '../utils/prng';

// ─── Types ────────────────────────────────────────────────

export type CombatMemory = {
  cycle: number;
  opponentFloor: number;
  outcome: 'WIN' | 'LOSS';
  hpLost: number;        // % HP perdido (0–100)
  reward: number;        // gold ganado
};

export type DecisionMemory = {
  cycle: number;
  action: string;        // AIAction de worldSimulator
  outcome: 'positive' | 'negative' | 'neutral';
  efficiencyScore: number;
};

export type AIMemoryState = {
  partyName: string;
  recentDecisions: DecisionMemory[];
  recentCombats: CombatMemory[];
  totalWins: number;
  totalLosses: number;
  winStreak: number;
  lossStreak: number;
  /** Acciones con mejor historial de eficiencia */
  preferredActions: Record<string, number>;
  /** Tipos de oponentes frecuentemente vencidos */
  enemyPatterns: Record<string, number>;
};

export type AIProfileType = 'AGGRESSIVE' | 'DEFENSIVE' | 'OPPORTUNISTIC' | 'EXPANSIONIST' | 'SURVIVALIST';

// ─── Constantes ───────────────────────────────────────────

const MAX_DECISIONS = 20;
const MAX_COMBATS   = 10;
/** Cada N ciclos la party puede mutar su perfil culturalmente */
export const MUTATION_INTERVAL = 15;

// ─── Crear memoria inicial ────────────────────────────────

export function createMemory(partyName: string): AIMemoryState {
  return {
    partyName,
    recentDecisions: [],
    recentCombats: [],
    totalWins: 0,
    totalLosses: 0,
    winStreak: 0,
    lossStreak: 0,
    preferredActions: {},
    enemyPatterns: {},
  };
}

// ─── Registro de decisiones ───────────────────────────────

/**
 * Registra una decisión y su resultado.
 * SYSTEMS.MD: "EfficiencyScore = Reward / RiskCost"
 */
export function recordDecision(
  memory: AIMemoryState,
  action: string,
  reward: number,
  riskCost: number,
  cycle: number,
): AIMemoryState {
  const efficiencyScore = riskCost > 0 ? reward / riskCost : reward;
  const outcome: DecisionMemory['outcome'] =
    efficiencyScore > 1.2 ? 'positive' : efficiencyScore < 0.5 ? 'negative' : 'neutral';

  const newDecision: DecisionMemory = { cycle, action, outcome, efficiencyScore };
  const updated = [newDecision, ...memory.recentDecisions].slice(0, MAX_DECISIONS);

  // Actualizar EMA de acción preferida (alpha 0.3)
  const currentAvg = memory.preferredActions[action] ?? 1.0;
  const newAvg = currentAvg * 0.7 + efficiencyScore * 0.3;

  return {
    ...memory,
    recentDecisions: updated,
    preferredActions: { ...memory.preferredActions, [action]: newAvg },
  };
}

// ─── Registro de combate ──────────────────────────────────

export function recordCombat(
  memory: AIMemoryState,
  cycle: number,
  opponentFloor: number,
  outcome: 'WIN' | 'LOSS',
  hpLost: number,
  reward: number,
): AIMemoryState {
  const newCombat: CombatMemory = { cycle, opponentFloor, outcome, hpLost, reward };
  const updatedCombats = [newCombat, ...memory.recentCombats].slice(0, MAX_COMBATS);
  const isWin = outcome === 'WIN';

  return {
    ...memory,
    recentCombats: updatedCombats,
    totalWins:   isWin ? memory.totalWins + 1 : memory.totalWins,
    totalLosses: !isWin ? memory.totalLosses + 1 : memory.totalLosses,
    winStreak:   isWin ? memory.winStreak + 1 : 0,
    lossStreak:  !isWin ? memory.lossStreak + 1 : 0,
  };
}

// ─── Pesos adaptativos ────────────────────────────────────

/**
 * Calcula deltas de peso basados en el historial de la party.
 * SYSTEMS.MD: "Si la IA pierde frecuentemente → Aumenta AvoidCombat/Rest.
 *              Si gana frecuentemente → Aumenta HuntParty/AggressiveAdvance."
 */
export function getAdaptiveWeights(memory: AIMemoryState): Record<string, number> {
  const recentWinRate =
    memory.recentCombats.length > 0
      ? memory.recentCombats.filter(c => c.outcome === 'WIN').length /
        memory.recentCombats.length
      : 0.5;

  const adaptations: Record<string, number> = {};

  if (recentWinRate > 0.7 || memory.winStreak >= 3) {
    adaptations.huntParty    = +0.15;
    adaptations.fightMonster = +0.10;
    adaptations.rest         = -0.10;
  }

  if (recentWinRate < 0.3 || memory.lossStreak >= 2) {
    adaptations.avoidCombat  = +0.20;
    adaptations.rest         = +0.15;
    adaptations.huntParty    = -0.15;
    adaptations.fightMonster = -0.10;
  }

  // Refuerzo de acciones históricamente rentables
  for (const [action, efficiency] of Object.entries(memory.preferredActions)) {
    if (efficiency > 1.5) adaptations[action] = (adaptations[action] ?? 0) + 0.08;
    if (efficiency < 0.5) adaptations[action] = (adaptations[action] ?? 0) - 0.08;
  }

  return adaptations;
}

// ─── Evolución cultural ───────────────────────────────────

/**
 * SYSTEMS.MD: "Copia la estrategia de parties exitosas cada 15 ciclos."
 * Una party puede adoptar parcialmente el perfil de un vecino exitoso.
 */
export function evaluateCulturalAdoption(
  memory: AIMemoryState,
  neighborMemories: AIMemoryState[],
  cycle: number,
  seedHash: string,
): { shouldAdopt: boolean; adoptFrom?: string } {
  // Solo evalúa en múltiplos del intervalo de mutación
  if (cycle % MUTATION_INTERVAL !== 0) return { shouldAdopt: false };

  const myWinRate =
    memory.totalWins + memory.totalLosses > 0
      ? memory.totalWins / (memory.totalWins + memory.totalLosses)
      : 0.5;

  const betterNeighbors = neighborMemories.filter(n => {
    const nWinRate =
      n.totalWins + n.totalLosses > 0
        ? n.totalWins / (n.totalWins + n.totalLosses)
        : 0.5;
    return nWinRate > myWinRate + 0.2; // significativamente mejor
  });

  if (betterNeighbors.length === 0) return { shouldAdopt: false };

  // Determinístico por seed + ciclo
  const rng = makePRNG(`${seedHash}_cultural_${memory.partyName}_${cycle}`);
  const adoptionChance = 0.3 + betterNeighbors.length * 0.1;

  if (rng.float() < adoptionChance) {
    const source = betterNeighbors[Math.floor(rng.float() * betterNeighbors.length)];
    return { shouldAdopt: true, adoptFrom: source.partyName };
  }

  return { shouldAdopt: false };
}

/**
 * SYSTEMS.MD: "La mutación de estrategia tiene un StrategyNoise = ±0.1"
 * Varía ligeramente los pesos preferidos de forma aleatoria.
 */
export function mutatePreferences(
  memory: AIMemoryState,
  seedHash: string,
  cycle: number,
): AIMemoryState {
  const rng = makePRNG(`${seedHash}_mutate_${memory.partyName}_${cycle}`);
  const mutated: Record<string, number> = {};

  for (const [action, efficiency] of Object.entries(memory.preferredActions)) {
    const noise = (rng.float() - 0.5) * 0.2; // ±0.1
    mutated[action] = Math.max(0.1, efficiency + noise);
  }

  return { ...memory, preferredActions: mutated };
}
