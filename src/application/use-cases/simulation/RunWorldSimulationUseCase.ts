import type { IWorldSimulatorPort, SimulationResult } from '../../ports/IWorldSimulatorPort';
import type { IGameRepository } from '../../../domain/repositories/IGameRepository';

/**
 * RunWorldSimulationUseCase — triggers AI world simulation for a cycle advance.
 */
export class RunWorldSimulationUseCase {
  constructor(
    private readonly worldSimulator: IWorldSimulatorPort,
    private readonly gameRepo: IGameRepository,
  ) {}

  async execute(
    gameId: string,
    seedHash: string,
    targetCycle: number,
    playerFloor: number,
    playerKillCount: number,
  ): Promise<SimulationResult> {
    const result = await this.worldSimulator.simulate(
      seedHash,
      targetCycle,
      playerFloor,
      playerKillCount,
    );
    return result;
  }
}
