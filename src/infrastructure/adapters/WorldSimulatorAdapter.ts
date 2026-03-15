/**
 * WorldSimulatorAdapter — implements IWorldSimulatorPort.
 * Wraps src/services/worldSimulator.ts simulateWorld().
 *
 * The port interface uses (seedHash, targetCycle, playerFloor, playerKillCount)
 * while the underlying simulateWorld() expects a full SavedGame object.
 * This adapter constructs the minimal stub required.
 */

import { simulateWorld } from '../../services/worldSimulator';
import type { IWorldSimulatorPort, SimulationResult, SimulationEvent } from '../../application/ports/IWorldSimulatorPort';
import type { SimulationResult as ServiceResult } from '../../services/worldSimulator';

export class WorldSimulatorAdapter implements IWorldSimulatorPort {
  async simulate(
    seedHash: string,
    targetCycle: number,
    playerFloor: number,
    _playerKillCount: number,
  ): Promise<SimulationResult> {
    // Construct the minimal SavedGame stub simulateWorld() needs.
    const activeGameStub = {
      id: `sim_${seedHash}`,
      seed: seedHash,
      seedHash,
      partyName: null,
      partyData: [],
      floor: playerFloor,
      cycle: targetCycle,
      cycleRaw: targetCycle,
      lastActionAt: null,
      lastSimEvents: null,
      phase: 'DAY' as const,
      gold: 0,
      status: 'active' as const,
      location: 'map' as const,
      mapState: null,
      partyPortrait: null,
      portraitsJson: null,
      expressionsJson: null,
      inSafeZone: false,
      safeZoneRoomId: null,
      partyOrigin: 'PLAYER' as const,
      predecessorGameId: null,
      createdByPlayer: true,
      eliminationReason: null,
      killRecords: [],
      combatRoomId: null,
      combatRoomType: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result: ServiceResult = await simulateWorld(seedHash, targetCycle, activeGameStub as any);

    // Map the internal SimulationResult → port SimulationResult
    const events: SimulationEvent[] = result.events.map(e => ({
      type: e.type,
      cycle: e.cycle,
      floor: e.floor,
      partyName: e.partyName,
      targetName: e.targetName,
      summary: e.summary,
      summary_en: e.summary_en,
      rivalAge: e.rivalAge,
    }));

    return {
      events,
      updatedRivalData: result.updatedRivals.map(r => ({
        name: r.name,
        floor: r.floor,
        rep: r.rep ?? 0,
      })),
    };
  }
}
