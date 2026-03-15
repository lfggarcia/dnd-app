import type { IEventRepository } from '../../domain/repositories/IEventRepository';
import type { IGameRepository } from '../../domain/repositories/IGameRepository';
import { BountyContract } from '../../domain/entities/BountyContract';
import { GameStateError } from '../../domain/errors/DomainError';

/**
 * IssueBountyUseCase — records a new kill and escalates/creates the bounty.
 * SYSTEMS.MD: "El historial de violencia es PERMANENTE."
 */
export class IssueBountyUseCase {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly gameRepo: IGameRepository,
  ) {}

  execute(
    gameId: string,
    seedHash: string,
    newKillCount: number,
  ): BountyContract {
    const existing = this.eventRepo.getBounty(gameId, seedHash);
    let contract: BountyContract;

    if (existing) {
      contract = BountyContract.fromProps({
        ...existing,
        bountyLevel: existing.bountyLevel as import('../../domain/entities/BountyContract').BountyLevel,
      }).recordKill();
    } else {
      contract = BountyContract.fromProps({
        id: `${seedHash}_bounty_${gameId}`,
        seedHash,
        targetGameId: gameId,
        rewardAmount: 0,
        bountyLevel: 0,
        isActive: false,
        killCount: 0,
      }).recordKill();
    }

    this.eventRepo.upsertBounty({
      id: contract.id,
      seedHash,
      targetGameId: contract.targetGameId,
      issuedBy: 'SYSTEM',
      rewardAmount: contract.rewardAmount,
      bountyLevel: contract.bountyLevel,
      isActive: contract.isActive,
      killCount: contract.killCount,
      createdAt: new Date().toISOString(),
    });

    return contract;
  }
}
