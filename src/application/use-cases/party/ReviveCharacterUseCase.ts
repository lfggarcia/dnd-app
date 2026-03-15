import { Character, CharacterProps } from '../../../domain/entities/Character';
import { Party } from '../../../domain/entities/Party';
import type { IGameRepository } from '../../../domain/repositories/IGameRepository';
import { GameStateError } from '../../../domain/errors/DomainError';

/**
 * ReviveCharacterUseCase — revives a dead character for a gold cost.
 * SYSTEMS.MD: revive cost = 200 × 2^deathCount
 */
export class ReviveCharacterUseCase {
  constructor(private readonly gameRepo: IGameRepository) {}

  getReviveCost(character: CharacterProps): number {
    return 200 * Math.pow(2, character.deathCount);
  }

  execute(
    gameId: string,
    party: CharacterProps[],
    characterId: string,
    currentGold: number,
  ): { updatedParty: CharacterProps[]; goldSpent: number } {
    const index = party.findIndex(c => c.characterId === characterId);
    if (index === -1) throw new GameStateError(`Character ${characterId} not found in party`);

    const char = Character.fromProps(party[index]);
    if (char.isAlive) throw new GameStateError(`Character ${char.name} is already alive`);

    const cost = this.getReviveCost(party[index]);
    if (currentGold < cost) {
      throw new GameStateError(`Insufficient gold: need ${cost}, have ${currentGold}`);
    }

    const revived = char.revive();
    const updatedParty = party.map((c, i) => i === index ? revived.toProps() : c);
    const newGold = currentGold - cost;

    this.gameRepo.update(gameId, { partyData: updatedParty, gold: newGold });
    return { updatedParty, goldSpent: cost };
  }
}
