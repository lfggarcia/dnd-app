import type { IGameRepository, SavedGameSnapshot } from '../../domain/repositories/IGameRepository';

/**
 * SaveGameUseCase — persists game state updates.
 */
export class SaveGameUseCase {
  constructor(private readonly gameRepo: IGameRepository) {}

  execute(id: string, updates: Partial<SavedGameSnapshot>): void {
    this.gameRepo.update(id, updates);
  }
}
