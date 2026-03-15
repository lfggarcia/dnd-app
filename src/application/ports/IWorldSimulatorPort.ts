/**
 * IWorldSimulatorPort — port for the AI world simulation engine.
 * The infrastructure adapter wraps worldSimulator.ts.
 */

export type SimulationEventType =
  | 'AI_COMBAT_WIN' | 'AI_COMBAT_LOSS' | 'AI_FLOOR_ADVANCE'
  | 'AI_REST' | 'AI_ELIMINATED' | 'AI_PARTY_SPAWNED'
  | 'BOSS_KILLED' | 'ALLIANCE_FORMED' | 'BOUNTY_ISSUED';

export type SimulationEvent = {
  type: SimulationEventType;
  cycle: number;
  floor: number;
  partyName: string;
  targetName?: string;
  summary: string;
  summary_en: string;
  rivalAge?: number;
};

export type SimulationResult = {
  events: SimulationEvent[];
  updatedRivalData: Array<{ name: string; floor: number; rep: number }>;
};

export interface IWorldSimulatorPort {
  simulate(
    seedHash: string,
    targetCycle: number,
    playerFloor: number,
    playerKillCount: number,
  ): Promise<SimulationResult>;
}
