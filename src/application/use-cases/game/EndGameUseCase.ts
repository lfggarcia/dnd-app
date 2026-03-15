import type { IGameRepository } from '../../domain/repositories/IGameRepository';

/**
 * EndGameUseCase — marks a game as completed or dead, or deletes it.
 */
export class EndGameUseCase {
  constructor(private readonly gameRepo: IGameRepository) {}

  markCompleted(id: string): void {
    this.gameRepo.update(id, { status: 'completed' });
  }

  markDead(id: string): void {
    this.gameRepo.update(id, { status: 'dead' });
  }

  deleteGame(id: string): void {
    this.gameRepo.delete(id);
  }
}
