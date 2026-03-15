import type { IGameRepository, SavedGameSnapshot } from '../../../domain/repositories/IGameRepository';

/**
 * LoadGameUseCase — retrieves a saved game by id, or the active game.
 */
export class LoadGameUseCase {
  constructor(private readonly gameRepo: IGameRepository) {}

  execute(id: string): SavedGameSnapshot | null {
    return this.gameRepo.findById(id);
  }

  loadActive(): SavedGameSnapshot | null {
    return this.gameRepo.findActive();
  }

  loadAll(): SavedGameSnapshot[] {
    return this.gameRepo.findAll();
  }
}
