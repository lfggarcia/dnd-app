import type { IGameRepository } from '../../../domain/repositories/IGameRepository';

/**
 * ExtractFromDungeonUseCase — moves party back to the village.
 * Clears active combat state and sets location to 'village'.
 */
export class ExtractFromDungeonUseCase {
  constructor(private readonly gameRepo: IGameRepository) {}

  execute(gameId: string): void {
    this.gameRepo.update(gameId, {
      location: 'village',
      combatRoomId: null,
      combatRoomType: null,
    });
  }
}
