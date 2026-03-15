import { CombatSession } from '../../domain/entities/CombatSession';
import { CombatDomainService } from '../../domain/services/CombatDomainService';
import { ProgressionDomainService } from '../../domain/services/ProgressionDomainService';
import { Character, CharacterProps } from '../../domain/entities/Character';
import { Party } from '../../domain/entities/Party';
import { Monster } from '../../domain/entities/Monster';
import type { IGameRepository } from '../../domain/repositories/IGameRepository';
import type { CombatResult } from './types';

/**
 * ResolveCombatUseCase — orchestrates a full combat resolution.
 * Applies XP/gold rewards and persists updated party state.
 */
export class ResolveCombatUseCase {
  private readonly combatService = new CombatDomainService();
  private readonly progressionService = new ProgressionDomainService();

  constructor(private readonly gameRepo: IGameRepository) {}

  execute(
    gameId: string,
    roomId: string,
    party: CharacterProps[],
    enemies: Monster[],
    currentGold: number,
    seedHash: string,
  ): CombatResult {
    const characters = party.map(Character.fromProps);
    const session = CombatSession.create(roomId, characters, enemies);
    const { session: resolved, totalXP, goldEarned, damageDone } = this.combatService.resolve(session, seedHash);

    // Distribute XP among alive party members
    const partyEntity = new Party({ members: resolved.partyMembers, partyName: null, origin: 'PLAYER' });
    const xpParty = this.progressionService.distributePartyXP(partyEntity, totalXP);
    const updatedParty = xpParty.members.map(c => c.toProps());
    const newGold = currentGold + goldEarned;

    this.gameRepo.update(gameId, {
      partyData: updatedParty,
      gold: newGold,
    });

    return {
      outcome: resolved.outcome as 'VICTORY' | 'DEFEAT',
      roundsElapsed: resolved.currentRound,
      partyAfter: updatedParty,
      totalXp: totalXP,
      goldEarned,
      log: resolved.log,
      damageDone,
    };
  }
}
