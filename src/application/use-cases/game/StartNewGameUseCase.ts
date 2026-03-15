import type { IGameRepository, SavedGameSnapshot } from '../../domain/repositories/IGameRepository';
import type { CharacterProps } from '../../domain/entities/Character';

/**
 * StartNewGameUseCase — creates a new SavedGame from a seed and party.
 */
export class StartNewGameUseCase {
  constructor(private readonly gameRepo: IGameRepository) {}

  execute(
    seed: string,
    seedHash: string,
    party: CharacterProps[],
    partyName?: string | null,
  ): SavedGameSnapshot {
    return this.gameRepo.create(seed, seedHash, party, partyName);
  }
}
