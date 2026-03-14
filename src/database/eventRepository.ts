/**
 * eventRepository.ts
 * CRUD for `events` (world events, DB v9) and `bounties` (DB v9) tables.
 *
 * World events: party kills, boss defeats, floor advances — feed the WorldLogScreen.
 * Bounties: guild-issued contracts on dangerous parties.
 *
 * All functions are synchronous (op-sqlite executeSync).
 */

import { getDB } from './connection';

// ─── Types — World Events ─────────────────────────────────

export type WorldEventType =
  | 'PARTY_KILL'
  | 'BOSS_DEFEATED'
  | 'FLOOR_ADVANCE'
  | 'PARTY_DIED'
  | 'PARTY_SPAWNED'
  | 'BOUNTY_CLAIMED'
  | 'ALLIANCE_FORMED'
  | 'ALLIANCE_BROKEN';

export type WorldEvent = {
  id: string;
  seedHash: string;
  type: WorldEventType;
  floor: number;
  cycle: number;
  partyName: string;
  targetName: string | null;
  data: Record<string, unknown>;
  createdAt: string;
};

type WorldEventRow = {
  id: string;
  seed_hash: string;
  type: string;
  floor: number;
  cycle: number;
  party_name: string;
  target_name: string | null;
  data: string;
  created_at: string;
};

// ─── Types — Bounties ─────────────────────────────────────

export type Bounty = {
  id: string;
  seedHash: string;
  targetGameId: string;
  issuedBy: string;
  rewardAmount: number;
  bountyLevel: number;
  isActive: boolean;
  killCount: number;
  createdAt: string;
  updatedAt: string;
};

type BountyRow = {
  id: string;
  seed_hash: string;
  target_game_id: string;
  issued_by: string;
  reward_amount: number;
  bounty_level: number;
  is_active: number;
  kill_count: number;
  created_at: string;
  updated_at: string;
};

// ─── Helpers ──────────────────────────────────────────────

function generateId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${ts}-${rand}`;
}

function rowToWorldEvent(row: WorldEventRow): WorldEvent {
  return {
    id: row.id,
    seedHash: row.seed_hash,
    type: row.type as WorldEventType,
    floor: row.floor,
    cycle: row.cycle,
    partyName: row.party_name,
    targetName: row.target_name,
    data: (() => { try { return JSON.parse(row.data || '{}'); } catch { return {}; } })(),
    createdAt: row.created_at,
  };
}

function rowToBounty(row: BountyRow): Bounty {
  return {
    id: row.id,
    seedHash: row.seed_hash,
    targetGameId: row.target_game_id,
    issuedBy: row.issued_by,
    rewardAmount: row.reward_amount,
    bountyLevel: row.bounty_level,
    isActive: row.is_active === 1,
    killCount: row.kill_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── World Events — Create ────────────────────────────────

export type CreateWorldEventInput = Omit<WorldEvent, 'id' | 'createdAt'>;

export function createWorldEvent(input: CreateWorldEventInput): WorldEvent {
  const db = getDB();
  const id = generateId('evt');
  const createdAt = new Date().toISOString();

  db.executeSync(
    `INSERT INTO events
       (id, seed_hash, type, floor, cycle, party_name, target_name, data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.seedHash,
      input.type,
      input.floor,
      input.cycle,
      input.partyName,
      input.targetName,
      JSON.stringify(input.data),
      createdAt,
    ],
  );

  return { ...input, id, createdAt };
}

// ─── World Events — Read ──────────────────────────────────

export function getWorldEventsBySeed(seedHash: string, limit = 50): WorldEvent[] {
  const db = getDB();
  const result = db.executeSync(
    'SELECT * FROM events WHERE seed_hash = ? ORDER BY cycle DESC LIMIT ?',
    [seedHash, limit],
  );
  return (result.rows ?? []).map(r => rowToWorldEvent(r as WorldEventRow));
}

export function getWorldEventsByType(seedHash: string, type: WorldEventType): WorldEvent[] {
  const db = getDB();
  const result = db.executeSync(
    'SELECT * FROM events WHERE seed_hash = ? AND type = ? ORDER BY cycle DESC',
    [seedHash, type],
  );
  return (result.rows ?? []).map(r => rowToWorldEvent(r as WorldEventRow));
}

export function countPartyKills(seedHash: string, partyName: string): number {
  const db = getDB();
  const result = db.executeSync(
    'SELECT COUNT(*) as cnt FROM events WHERE seed_hash = ? AND type = ? AND party_name = ?',
    [seedHash, 'PARTY_KILL', partyName],
  );
  return (result.rows?.[0] as { cnt: number } | undefined)?.cnt ?? 0;
}

// ─── Bounties — Create ────────────────────────────────────

export type CreateBountyInput = {
  seedHash: string;
  targetGameId: string;
  issuedBy?: string;
  rewardAmount: number;
  bountyLevel?: number;
};

export function createBounty(input: CreateBountyInput): Bounty {
  const db = getDB();
  const id = generateId('bty');
  const now = new Date().toISOString();

  const bounty: Bounty = {
    id,
    seedHash: input.seedHash,
    targetGameId: input.targetGameId,
    issuedBy: input.issuedBy ?? 'GUILD',
    rewardAmount: input.rewardAmount,
    bountyLevel: input.bountyLevel ?? 1,
    isActive: true,
    killCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  db.executeSync(
    `INSERT INTO bounties
       (id, seed_hash, target_game_id, issued_by, reward_amount, bounty_level,
        is_active, kill_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
    [
      bounty.id,
      bounty.seedHash,
      bounty.targetGameId,
      bounty.issuedBy,
      bounty.rewardAmount,
      bounty.bountyLevel,
      now,
      now,
    ],
  );

  return bounty;
}

// ─── Bounties — Read ──────────────────────────────────────

export function getActiveBounties(seedHash: string): Bounty[] {
  const db = getDB();
  const result = db.executeSync(
    'SELECT * FROM bounties WHERE seed_hash = ? AND is_active = 1 ORDER BY bounty_level DESC',
    [seedHash],
  );
  return (result.rows ?? []).map(r => rowToBounty(r as BountyRow));
}

export function getBountyForTarget(seedHash: string, targetGameId: string): Bounty | null {
  const db = getDB();
  const result = db.executeSync(
    'SELECT * FROM bounties WHERE seed_hash = ? AND target_game_id = ? AND is_active = 1',
    [seedHash, targetGameId],
  );
  const row = result.rows?.[0] as BountyRow | undefined;
  return row ? rowToBounty(row) : null;
}

// ─── Bounties — Update ────────────────────────────────────

export function deactivateBounty(id: string): void {
  const db = getDB();
  db.executeSync(
    'UPDATE bounties SET is_active = 0, updated_at = ? WHERE id = ?',
    [new Date().toISOString(), id],
  );
}

export function escalateBounty(id: string, newReward: number, newLevel: number): void {
  const db = getDB();
  db.executeSync(
    'UPDATE bounties SET reward_amount = ?, bounty_level = ?, kill_count = kill_count + 1, updated_at = ? WHERE id = ?',
    [newReward, newLevel, new Date().toISOString(), id],
  );
}
