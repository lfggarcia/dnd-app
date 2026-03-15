import type { IEventRepository } from '../../domain/repositories/IEventRepository';
import type { IGameRepository } from '../../domain/repositories/IGameRepository';
import { GameStateError } from '../../domain/errors/DomainError';

/**
 * ClaimBountyUseCase — allows a party to collect the reward for an active bounty target.
 */
export class ClaimBountyUseCase {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly gameRepo: IGameRepository,
  ) {}

  execute(
    claimerGameId: string,
    targetGameId: string,
    seedHash: string,
    currentGold: number,
  ): number {
    const bounty = this.eventRepo.getBounty(targetGameId, seedHash);
    if (!bounty || !bounty.isActive) {
      throw new GameStateError(`No active bounty found for target ${targetGameId}`);
    }

    const newGold = currentGold + bounty.rewardAmount;
    this.gameRepo.update(claimerGameId, { gold: newGold });
    this.eventRepo.deactivateBounty(targetGameId);

    return newGold;
  }
}
