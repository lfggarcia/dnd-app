import type { WorldEventProps } from '../entities/WorldEvent';

/**
 * IEventRepository — port for world event and bounty persistence.
 */

export type WorldEventRow = {
  id: string;
  seedHash: string;
  type: string;
  floor: number;
  cycle: number;
  partyName: string;
  targetName: string | null;
  data: Record<string, unknown>;
  createdAt: string;
};

export type BountyRow = {
  id: string;
  seedHash: string;
  targetGameId: string;
  issuedBy: string;
  rewardAmount: number;
  bountyLevel: number;
  isActive: boolean;
  killCount: number;
  createdAt: string;
};

export interface IEventRepository {
  createWorldEvent(event: Omit<WorldEventRow, 'id' | 'createdAt'>): void;
  getWorldEvents(seedHash: string, limit?: number): WorldEventRow[];
  // Bounty operations — seedHash is always the first arg
  getBounty(seedHash: string, targetGameId: string): BountyRow | null;
  upsertBounty(bounty: Omit<BountyRow, 'createdAt'>): void;
  /** @param bountyId — the bounty record's own ID, not the targetGameId */
  deactivateBounty(bountyId: string): void;
}
