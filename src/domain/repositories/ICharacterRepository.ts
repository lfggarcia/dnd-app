import type { CharacterProps } from '../entities/Character';

/**
 * ICharacterRepository — port for character persistence within a game.
 * Characters are stored inside SavedGame.partyData, so this is a projection
 * over the game repository. The concrete adapter extracts party data.
 */
export interface ICharacterRepository {
  findAllInGame(gameId: string): CharacterProps[];
  findById(gameId: string, characterId: string): CharacterProps | null;
  updateInGame(gameId: string, updated: CharacterProps): void;
  updateParty(gameId: string, party: CharacterProps[]): void;
}
