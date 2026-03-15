import { Party } from '../../domain/entities/Party';
import { Character, CharacterProps } from '../../domain/entities/Character';
import { ProgressionDomainService } from '../../domain/services/ProgressionDomainService';
import type { IGameRepository } from '../../domain/repositories/IGameRepository';
import { GameStateError } from '../../domain/errors/DomainError';

/**
 * ConfirmLevelUpsUseCase — confirms all pendingLevelUps for characters.
 * Called from CampScreen after dungeon run.
 */
export class ConfirmLevelUpsUseCase {
  private readonly progression = new ProgressionDomainService();

  constructor(private readonly gameRepo: IGameRepository) {}

  execute(
    gameId: string,
    party: CharacterProps[],
  ): CharacterProps[] {
    const updated = party.map(props => {
      const character = Character.fromProps(props);
      const result = this.progression.confirmLevelUps(character);
      return result.character.toProps();
    });

    this.gameRepo.update(gameId, { partyData: updated });
    return updated;
  }
}
