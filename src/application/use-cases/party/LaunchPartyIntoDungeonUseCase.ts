import { Character, CharacterProps } from '../../domain/entities/Character';
import { Party } from '../../domain/entities/Party';
import type { IGameRepository } from '../../domain/repositories/IGameRepository';

/**
 * LaunchPartyIntoDungeonUseCase — transitions party from village to dungeon map.
 * Sets location to 'map' and validates party viability.
 */
export class LaunchPartyIntoDungeonUseCase {
  constructor(private readonly gameRepo: IGameRepository) {}

  execute(gameId: string, party: CharacterProps[]): void {
    const characters = party.map(Character.fromProps);
    const partyEntity = new Party({
      members: characters,
      partyName: null,
      origin: 'PLAYER',
    });

    if (!partyEntity.isViable) {
      throw new Error('Cannot launch: party has no alive members');
    }

    this.gameRepo.update(gameId, { location: 'map' });
  }
}
