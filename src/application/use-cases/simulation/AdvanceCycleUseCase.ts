import type { IGameRepository } from '../../../domain/repositories/IGameRepository';
import type { IWorldSimulatorPort, SimulationResult } from '../../ports/IWorldSimulatorPort';
import { advanceTime, type TimeAction } from '../../../services/timeService';

/**
 * AdvanceCycleUseCase — advances the in-game cycle by a TimeAction cost.
 * Triggers world simulation if the cycle changes.
 *
 * NOTE: timeService is a utility module (no domain logic, no infra deps) and
 * is imported directly here. It will be moved to domain/ in a later cleanup pass.
 */
export class AdvanceCycleUseCase {
  constructor(
    private readonly gameRepo: IGameRepository,
    private readonly worldSimulator: IWorldSimulatorPort,
  ) {}

  async execute(
    gameId: string,
    seedHash: string,
    currentCycleRaw: number,
    currentCycle: number,
    playerFloor: number,
    playerKillCount: number,
    action: TimeAction,
  ): Promise<{
    newCycle: number;
    newCycleRaw: number;
    newPhase: 'DAY' | 'NIGHT';
    phaseChanged: boolean;
    simResult: SimulationResult;
  }> {
    const { newCycleRaw, newCycle, newPhase, phaseChanged } = advanceTime(currentCycleRaw, action);

    let simResult: SimulationResult = { events: [], updatedRivalData: [] };
    if (newCycle > currentCycle) {
      simResult = await this.worldSimulator.simulate(seedHash, newCycle, playerFloor, playerKillCount);
    }

    this.gameRepo.update(gameId, {
      cycle: newCycle,
      phase: newPhase,
    });

    return { newCycle, newCycleRaw, newPhase, phaseChanged, simResult };
  }
}
