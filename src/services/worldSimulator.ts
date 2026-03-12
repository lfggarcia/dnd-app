/**
 * worldSimulator.ts
 * Motor de simulación determinístico del mundo — Sprint 5C.
 *
 * Simula todas las parties IA desde el ciclo actual hasta targetCycle.
 * Cada llamada es determinística: el mismo seedHash + targetCycle siempre
 * produce los mismos eventos.
 *
 * SYSTEMS.MD: "simulateWorld(playerCycle): procesa todas las parties IA hasta el ciclo actual"
 */

import { makePRNG } from '../utils/prng';
import { deriveBaseProfile, getActionWeights, maybeMutateProfile } from './aiProfileEngine';
import type { AIProfile, AIAction } from './aiProfileEngine';
import { createMemory, recordDecision, recordCombat, MUTATION_INTERVAL } from './aiMemoryService';
import type { AIMemoryState } from './aiMemoryService';
import type { RivalEntry } from './rivalGenerator';
import type { SavedGame } from '../database/gameRepository';

// ─── Tipos públicos ────────────────────────────────────────

export type SimulationEventType =
  | 'AI_COMBAT_WIN'
  | 'AI_COMBAT_LOSS'
  | 'AI_FLOOR_ADVANCE'
  | 'AI_REST'
  | 'AI_ELIMINATED'
  | 'AI_PARTY_SPAWNED'
  | 'BOSS_KILLED'
  | 'ALLIANCE_FORMED'
  | 'BOUNTY_ISSUED';

export type SimulationEvent = {
  type: SimulationEventType;
  cycle: number;
  floor: number;
  partyName: string;
  targetName?: string;
  summary: string;
  summary_en: string;
  /** UI-GAP-02: cycles this rival has been alive (for veteran badge in WorldLogScreen) */
  rivalAge?: number;
  /** UI-GAP-02: AI profile of the rival at time of event */
  rivalProfile?: import('./aiProfileEngine').AIProfile;
};

export type SimulationResult = {
  updatedRivals: RivalEntry[];
  events: SimulationEvent[];
};

// ─── Estado interno por party IA ──────────────────────────

type AIPartyState = {
  entry: RivalEntry;
  cycleProgress: number;
  hp: number;           // porcentaje 0–100 (simplificado)
  gold: number;
  consecutiveLosses: number;
  profile: AIProfile;
  memory: AIMemoryState;
  /** RI-02: cycles remaining where this party is forced into DEFENSIVE mode after a PvP kill */
  forcedDefensiveCycles: number;
};

/**
 * SYSTEMS.MD: "UtilityScore = (ExpectedReward × WeightReward) - (ExpectedRisk × WeightRisk)"
 * Decide la próxima acción para este ciclo usando pesos ponderados + ruido.
 * Now uses aiProfileEngine.getActionWeights() which integrates memory adaptation.
 */
function decideAction(
  state: AIPartyState,
  nearbyRivals: AIPartyState[],
  rng: ReturnType<typeof makePRNG>,
): AIAction {
  const weights = getActionWeights(state.profile, state.memory);
  const adjusted = { ...weights };

  // RI-02: after a PvP elimination, forced into DEFENSIVE for 5 cycles
  if (state.forcedDefensiveCycles > 0) {
    adjusted.huntParty = 0;
    adjusted.fightMonster = Math.max(0, adjusted.fightMonster - 0.30);
    adjusted.rest += 0.30;
    adjusted.avoidCombat += 0.20;
  }

  // HP baja → priorizar descanso, evitar combate
  if (state.hp < 30) {
    adjusted.rest += 0.30;
    adjusted.huntParty = 0;
    adjusted.fightMonster = Math.max(0, adjusted.fightMonster - 0.15);
  }

  // Sin rivales cercanos → no puede cazar parties
  if (nearbyRivals.length === 0) {
    adjusted.huntParty = 0;
  }

  // Piso alto + HP buena → tentar avance de piso
  if (state.entry.floor > 20 && state.hp > 70) {
    adjusted.advanceFloor += 0.10;
  }

  // Ruido controlado por seed (SYSTEMS.MD: "StrategyNoise = Random × 0.1")
  const noise = (rng.float() - 0.5) * 0.1;
  for (const key of Object.keys(adjusted) as AIAction[]) {
    adjusted[key] = Math.max(0, adjusted[key] + noise);
  }

  // Normalizar pesos
  const total = Object.values(adjusted).reduce((s, v) => s + v, 0);
  const normalized = Object.fromEntries(
    Object.entries(adjusted).map(([k, v]) => [k, v / total]),
  ) as Record<AIAction, number>;

  // Ruleta ponderada
  const roll = rng.float();
  let cumulative = 0;
  for (const [action, weight] of Object.entries(normalized)) {
    cumulative += weight;
    if (roll <= cumulative) return action as AIAction;
  }

  return 'explore';
}

// ─── Resolver cada acción ─────────────────────────────────

function executeAction(
  state: AIPartyState,
  action: AIAction,
  nearbyRivals: AIPartyState[],
  rng: ReturnType<typeof makePRNG>,
  cycle: number,
  events: SimulationEvent[],
): AIPartyState {
  const updated: AIPartyState = {
    ...state,
    entry: { ...state.entry },
  };

  switch (action) {
    case 'explore':
      updated.hp = Math.min(100, updated.hp + 5);
      break;

    case 'fightMonster': {
      // SYSTEMS.MD: "ProbabilidadVictoria = PartyPower / (PartyPower + EnemyPower × RiskFactor)"
      const partyPower = updated.entry.floor * 1.5 + updated.hp * 0.1;
      const enemyPower = updated.entry.floor * 1.2;
      const riskFactor = 1 + updated.entry.floor * 0.02;
      const winChance = partyPower / (partyPower + enemyPower * riskFactor);

      if (rng.bool(winChance)) {
        updated.hp = Math.max(20, updated.hp - 15);
        updated.gold += updated.entry.floor * 10;
        updated.consecutiveLosses = 0;
        events.push({
          type: 'AI_COMBAT_WIN',
          cycle,
          floor: updated.entry.floor,
          partyName: updated.entry.name,
          summary: `${updated.entry.name} venció monstruos en Piso ${updated.entry.floor}`,
          summary_en: `${updated.entry.name} defeated monsters on Floor ${updated.entry.floor}`,
        });
      } else {
        updated.hp = Math.max(5, updated.hp - 35);
        updated.consecutiveLosses++;
        events.push({
          type: 'AI_COMBAT_LOSS',
          cycle,
          floor: updated.entry.floor,
          partyName: updated.entry.name,
          summary: `${updated.entry.name} fue derrotada en Piso ${updated.entry.floor}`,
          summary_en: `${updated.entry.name} was defeated on Floor ${updated.entry.floor}`,
        });
      }
      break;
    }

    case 'huntParty': {
      if (nearbyRivals.length === 0) break;
      const targetIdx = Math.floor(rng.float() * nearbyRivals.length);
      const target = nearbyRivals[targetIdx];

      const attackerPower = updated.entry.floor * 1.5 + updated.hp * 0.1;
      const defenderPower = target.entry.floor * 1.5 + target.hp * 0.1;
      const winChance = attackerPower / (attackerPower + defenderPower);

      if (rng.bool(winChance)) {
        updated.hp = Math.max(30, updated.hp - 20);
        updated.gold += Math.floor(target.gold * 0.3);
        // RI-02: 5 cycles of forced DEFENSIVE after eliminating another party
        updated.forcedDefensiveCycles = 5;
        events.push({
          type: 'AI_COMBAT_WIN',
          cycle,
          floor: updated.entry.floor,
          partyName: updated.entry.name,
          targetName: target.entry.name,
          summary: `${updated.entry.name} eliminó a ${target.entry.name} en Piso ${updated.entry.floor}`,
          summary_en: `${updated.entry.name} eliminated ${target.entry.name} on Floor ${updated.entry.floor}`,
          rivalAge: cycle - Math.max(1, updated.entry.floor - 1),
          rivalProfile: updated.profile,
        });
      } else {
        updated.hp = Math.max(5, updated.hp - 40);
        updated.consecutiveLosses++;
      }
      break;
    }

    case 'rest': {
      const restCost = 50 * Math.max(1, Math.floor(updated.entry.floor / 10));
      if (updated.gold >= restCost) {
        updated.hp = Math.min(100, updated.hp + 40);
        updated.gold -= restCost;
      } else {
        updated.hp = Math.min(100, updated.hp + 15);
      }
      events.push({
        type: 'AI_REST',
        cycle,
        floor: updated.entry.floor,
        partyName: updated.entry.name,
        summary: `${updated.entry.name} descansó en Piso ${updated.entry.floor}`,
        summary_en: `${updated.entry.name} rested on Floor ${updated.entry.floor}`,
      });
      break;
    }

    case 'advanceFloor': {
      if (updated.hp >= 50) {
        updated.entry.floor++;
        events.push({
          type: 'AI_FLOOR_ADVANCE',
          cycle,
          floor: updated.entry.floor,
          partyName: updated.entry.name,
          summary: `${updated.entry.name} avanzó al Piso ${updated.entry.floor}`,
          summary_en: `${updated.entry.name} advanced to Floor ${updated.entry.floor}`,
          rivalAge: cycle - Math.max(1, updated.entry.floor - 1),
          rivalProfile: updated.profile,
        });
      }
      break;
    }

    case 'avoidCombat':
      // Conservar recursos — no action
      break;
  }

  // Verificar eliminación
  if (updated.hp <= 0) {
    updated.entry.status = 'defeated';
    events.push({
      type: 'AI_ELIMINATED',
      cycle,
      floor: updated.entry.floor,
      partyName: updated.entry.name,
      summary: `${updated.entry.name} fue eliminada`,
      summary_en: `${updated.entry.name} was eliminated`,
    });
  }

  return updated;
}

// ─── Función principal ────────────────────────────────────

/**
 * ENTRY POINT — llamar desde gameStore.advanceCycle()
 *
 * Simula todas las parties IA desde ciclo 1 hasta targetCycle.
 * SYSTEMS.MD: "simulateWorld(playerCycle): procesa todas las parties IA hasta el ciclo actual"
 *
 * Es síncrona en la práctica pero declarada async para compatibilidad con
 * el gameStore que usa import() dinámico.
 */
export async function simulateWorld(
  seedHash: string,
  targetCycle: number,
  activeGame: SavedGame,
  fromCycle?: number,
): Promise<SimulationResult> {
  const { generateRivals } = await import('./rivalGenerator');
  const rivals = generateRivals(activeGame.seedHash, activeGame.floor ?? 1, activeGame.cycle ?? 1);

  const events: SimulationEvent[] = [];

  // RT-01: time-limit guard to prevent blocking JS thread on low-end devices
  const MAX_TOTAL_TIME_MS = 100;
  const simStartTime = Date.now();

  // Inicializar estado de cada party IA
  const aiStates: AIPartyState[] = rivals.map(rival => ({
    entry: { ...rival },
    cycleProgress: Math.max(1, rival.floor - 1),
    hp: Math.max(10, 100 - rival.floor * 2),
    gold: rival.floor * 50,
    consecutiveLosses: 0,
    profile: deriveBaseProfile(rival.name, seedHash),
    memory: createMemory(rival.name),
    forcedDefensiveCycles: 0,
  }));

  // Simular ciclo por ciclo — comenzar desde fromCycle si se especifica
  const startCycle = fromCycle ?? 1;
  for (let cycle = startCycle; cycle <= targetCycle; cycle++) {
    if (Date.now() - simStartTime > MAX_TOTAL_TIME_MS) break;
    const rng = makePRNG(`${seedHash}_world_${cycle}`);

    // RI-02: decrement forced defensive timers
    for (let i = 0; i < aiStates.length; i++) {
      if (aiStates[i].forcedDefensiveCycles > 0) {
        aiStates[i] = { ...aiStates[i], forcedDefensiveCycles: aiStates[i].forcedDefensiveCycles - 1 };
      }
    }

    // RI-02: if fewer than 3 active parties, spawn a SYSTEM party
    const activeCount = aiStates.filter(s => s.entry.status !== 'defeated').length;
    if (activeCount < 3) {
      const systemName = `SYSTEM_${seedHash.slice(0, 4)}_${cycle}`;
      const spawnFloor = Math.max(1, Math.floor(activeCount + 1));
      aiStates.push({
        entry: { name: systemName, floor: spawnFloor, status: 'active', rep: 0 },
        cycleProgress: 0,
        hp: 80,
        gold: spawnFloor * 30,
        consecutiveLosses: 0,
        profile: 'SURVIVALIST',
        memory: createMemory(systemName),
        forcedDefensiveCycles: 0,
      });
      events.push({
        type: 'AI_PARTY_SPAWNED',
        cycle,
        floor: spawnFloor,
        partyName: systemName,
        summary: `Nueva party de sistema ${systemName} en Piso ${spawnFloor}`,
        summary_en: `System party ${systemName} spawned on Floor ${spawnFloor}`,
      });
    }

    for (let i = 0; i < aiStates.length; i++) {
      const state = aiStates[i];
      if (state.entry.status === 'defeated') continue;

      // Parties en pisos cercanos (±3)
      const nearbyRivals = aiStates.filter((other, j) =>
        j !== i &&
        other.entry.status !== 'defeated' &&
        Math.abs(other.entry.floor - state.entry.floor) <= 3,
      );

      const action = decideAction(state, nearbyRivals, rng);
      const prevHp = aiStates[i].hp;
      aiStates[i] = executeAction(state, action, nearbyRivals, rng, cycle, events);
      const hpLost = Math.max(0, prevHp - aiStates[i].hp);

      // Record decision + combat outcome into memory
      const reward = aiStates[i].gold - state.gold;
      aiStates[i].memory = recordDecision(
        aiStates[i].memory,
        action,
        Math.max(0, reward),
        hpLost,
        cycle,
      );
      if (action === 'fightMonster' || action === 'huntParty') {
        const outcome = hpLost < 30 ? 'WIN' : 'LOSS';
        aiStates[i].memory = recordCombat(
          aiStates[i].memory,
          cycle,
          state.entry.floor,
          outcome,
          hpLost,
          Math.max(0, reward),
        );
      }

      // Cultural mutation every MUTATION_INTERVAL cycles
      if (cycle % MUTATION_INTERVAL === 0 && nearbyRivals.length > 0) {
        aiStates[i].profile = maybeMutateProfile(
          aiStates[i].profile,
          aiStates[i].memory,
          cycle,
          seedHash,
          nearbyRivals.map(r => r.profile),
          nearbyRivals.map(r => r.memory),
        );
      }
    }
  }

  const updatedRivals: RivalEntry[] = aiStates.map(s => ({
    ...s.entry,
    floor: s.entry.floor,
    rep: Math.min(100, (s.entry.rep ?? 0) + s.consecutiveLosses * 5),
  }));

  // Máximo 20 eventos más recientes para la UI
  const relevantEvents = events.slice(-20);

  return { updatedRivals, events: relevantEvents };
}

/**
 * Calcula el poder de una party para comparaciones en encuentros.
 * SYSTEMS.MD: "PartyPower = Σ(level × avgStat/10 × ascensionMult)"
 */
export function calculatePartyPower(party: import('../database/gameRepository').CharacterSave[]): number {
  return party
    .filter(c => c.alive)
    .reduce((total, c) => {
      const avgStat =
        (c.baseStats.STR + c.baseStats.DEX + c.baseStats.CON +
         c.baseStats.INT + c.baseStats.WIS + c.baseStats.CHA) / 6;
      const level = c.level ?? 1;
      const statMult = avgStat / 10;
      const ascensionMult = c.isAscended ? 1.15 : 1.0;
      return total + level * statMult * ascensionMult;
    }, 0);
}
