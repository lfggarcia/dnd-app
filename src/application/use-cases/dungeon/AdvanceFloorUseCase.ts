import type { IGameRepository } from '../../domain/repositories/IGameRepository';

/**
 * AdvanceFloorUseCase — increments the dungeon floor counter.
 */
export class AdvanceFloorUseCase {
  constructor(private readonly gameRepo: IGameRepository) {}

  execute(gameId: string, currentFloor: number): number {
    const newFloor = currentFloor + 1;
    this.gameRepo.update(gameId, { floor: newFloor });
    return newFloor;
  }
}
