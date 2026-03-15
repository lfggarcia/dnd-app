import { Party } from '../../domain/entities/Party';
import { Character, CharacterProps } from '../../domain/entities/Character';
import { ProgressionDomainService } from '../../domain/services/ProgressionDomainService';
import type { IGameRepository } from '../../domain/repositories/IGameRepository';

/**
 * CreatePartyUseCase — validates and persists a new party for a game.
 */
export class CreatePartyUseCase {
  private readonly progression = new ProgressionDomainService();

  constructor(private readonly gameRepo: IGameRepository) {}

  execute(
    gameId: string,
    members: CharacterProps[],
    previousParty?: Character[],
  ): Party {
    const characters = members.map(Character.fromProps);
    const party = new Party({
      members: characters,
      partyName: null,
      origin: previousParty ? 'IA_INHERITED' : 'PLAYER',
    });

    // Persist the party in the game's partyData
    this.gameRepo.update(gameId, { partyData: members });
    return party;
  }
}
