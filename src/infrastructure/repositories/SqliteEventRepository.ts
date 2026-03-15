/**
 * SqliteEventRepository — concrete implementation of IEventRepository.
 * Delegates to src/database/eventRepository.ts.
 */

import {
  createWorldEvent as dbCreateWorldEvent,
  getWorldEventsBySeed,
  getBountyForTarget,
  createBounty,
  escalateBounty,
  deactivateBounty as dbDeactivateBounty,
  type WorldEvent as DbWorldEvent,
  type Bounty as DbBounty,
} from '../../database/eventRepository';
import type { IEventRepository, WorldEventRow, BountyRow } from '../../domain/repositories/IEventRepository';

export class SqliteEventRepository implements IEventRepository {
  createWorldEvent(event: Omit<WorldEventRow, 'id' | 'createdAt'>): void {
    dbCreateWorldEvent({
      seedHash: event.seedHash,
      type: event.type as DbWorldEvent['type'],
      floor: event.floor,
      cycle: event.cycle,
      partyName: event.partyName,
      targetName: event.targetName ?? null,
      data: event.data,
    });
  }

  getWorldEvents(seedHash: string, limit?: number): WorldEventRow[] {
    const events = getWorldEventsBySeed(seedHash, limit);
    return events.map(e => ({
      id: e.id,
      seedHash: e.seedHash,
      type: e.type,
      floor: e.floor,
      cycle: e.cycle,
      partyName: e.partyName,
      targetName: e.targetName,
      data: e.data,
      createdAt: e.createdAt,
    }));
  }

  getBounty(seedHash: string, targetGameId: string): BountyRow | null {
    const bounty = getBountyForTarget(seedHash, targetGameId);
    if (!bounty) return null;
    return {
      id: bounty.id,
      seedHash: bounty.seedHash,
      targetGameId: bounty.targetGameId,
      issuedBy: bounty.issuedBy,
      rewardAmount: bounty.rewardAmount,
      bountyLevel: bounty.bountyLevel,
      isActive: bounty.isActive,
      killCount: bounty.killCount,
      createdAt: bounty.createdAt,
    };
  }

  upsertBounty(bounty: Omit<BountyRow, 'createdAt'> & { createdAt?: string }): void {
    const existing = getBountyForTarget(bounty.seedHash, bounty.targetGameId);
    if (existing) {
      escalateBounty(existing.id, bounty.rewardAmount, bounty.bountyLevel);
    } else {
      createBounty({
        seedHash: bounty.seedHash,
        targetGameId: bounty.targetGameId,
        issuedBy: bounty.issuedBy,
        rewardAmount: bounty.rewardAmount,
        bountyLevel: bounty.bountyLevel,
      });
    }
  }

  deactivateBounty(bountyId: string): void {
    dbDeactivateBounty(bountyId);
  }
}
