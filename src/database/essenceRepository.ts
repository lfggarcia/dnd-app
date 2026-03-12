/**
 * essenceRepository.ts
 * SQLite persistence for the essence system — Sprint 7 (doc 13).
 * Tables: essences, monster_kills (migration v13)
 */

import { getDB } from './connection';
import type { EssenceRank } from '../services/essenceService';

// ─── Types ────────────────────────────────────────────────

export type SavedEssence = {
  id: string;
  seedHash: string;
  ownerGameId: string;
  ownerCharName: string;
  definitionId: string;
  rank: EssenceRank;
  evolutionLevel: 1 | 2 | 3;
  killsOnType: number;
  equipped: boolean;
  obtainedCycle: number;
  obtainedFloor: number;
  createdAt: string;
};

export type EssenceSaveInput = {
  definitionId: string;
  rank: EssenceRank;
  evolutionLevel: 1 | 2 | 3;
  killsOnThisType: number;
  ownerGameId: string;
  ownerCharName: string;
  obtainedCycle: number;
  obtainedFloor: number;
  seedHash: string;
};

// ─── Essence CRUD ────────────────────────────────────────

/**
 * Persist an essence drop — idempotent (RT-09).
 * ID format: `${seedHash}_essence_${definitionId}_${cycle}_${floor}`
 */
export function saveEssenceDrop(input: EssenceSaveInput): void {
  const db = getDB();
  const id = `${input.seedHash}_essence_${input.definitionId}_${input.obtainedCycle}_${input.obtainedFloor}`;
  const now = new Date().toISOString();
  db.executeSync(
    `INSERT OR IGNORE INTO essences (
      id, seed_hash, owner_game_id, owner_char_name, definition_id,
      rank, evolution_level, kills_on_type, equipped,
      obtained_cycle, obtained_floor, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [
      id,
      input.seedHash,
      input.ownerGameId,
      input.ownerCharName,
      input.definitionId,
      input.rank,
      input.evolutionLevel,
      input.killsOnThisType,
      input.obtainedCycle,
      input.obtainedFloor,
      now,
    ],
  );
}

export function getEssencesByChar(gameId: string, charName: string): SavedEssence[] {
  const db = getDB();
  const result = db.executeSync(
    'SELECT * FROM essences WHERE owner_game_id = ? AND owner_char_name = ? ORDER BY obtained_cycle DESC',
    [gameId, charName],
  );
  return (result.rows ?? []).map(row => ({
    id: row.id as string,
    seedHash: row.seed_hash as string,
    ownerGameId: row.owner_game_id as string,
    ownerCharName: row.owner_char_name as string,
    definitionId: row.definition_id as string,
    rank: row.rank as EssenceRank,
    evolutionLevel: (row.evolution_level ?? 1) as 1 | 2 | 3,
    killsOnType: (row.kills_on_type ?? 0) as number,
    equipped: Boolean(row.equipped),
    obtainedCycle: row.obtained_cycle as number,
    obtainedFloor: row.obtained_floor as number,
    createdAt: row.created_at as string,
  }));
}

export function getEquippedCount(gameId: string, charName: string): number {
  const db = getDB();
  const result = db.executeSync(
    'SELECT COUNT(*) as cnt FROM essences WHERE owner_game_id = ? AND owner_char_name = ? AND equipped = 1',
    [gameId, charName],
  );
  return (result.rows?.[0]?.cnt ?? 0) as number;
}

/**
 * Equip an essence. Does NOT validate slots — caller must check via
 * getEssenceSlots() before calling this.
 */
export function equipEssence(essenceId: string, charName: string, gameId: string): void {
  const db = getDB();
  db.executeSync(
    'UPDATE essences SET equipped = 1 WHERE id = ? AND owner_char_name = ? AND owner_game_id = ?',
    [essenceId, charName, gameId],
  );
}

export function unequipEssence(essenceId: string): void {
  const db = getDB();
  db.executeSync('UPDATE essences SET equipped = 0 WHERE id = ?', [essenceId]);
}

// ─── Monster Kill Tracking ────────────────────────────────

/**
 * Upsert kill count for (gameId, charName, monsterKey).
 * Uses INSERT OR REPLACE — UNIQUE constraint ensures no duplicates.
 */
export function incrementMonsterKills(
  gameId: string,
  charName: string,
  monsterKey: string,
  cycle: number,
  seedHash: string,
): void {
  const db = getDB();
  const id = `${gameId}_${charName}_${monsterKey}`;
  const now = new Date().toISOString();
  db.executeSync(
    `INSERT INTO monster_kills (id, seed_hash, game_id, char_name, monster_key, kill_count, last_kill_cycle, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(game_id, char_name, monster_key)
     DO UPDATE SET kill_count = kill_count + 1, last_kill_cycle = ?, updated_at = ?`,
    [id, seedHash, gameId, charName, monsterKey, cycle, now, cycle, now],
  );
}

export function getMonsterKills(gameId: string, charName: string, monsterKey: string): number {
  const db = getDB();
  const result = db.executeSync(
    'SELECT kill_count FROM monster_kills WHERE game_id = ? AND char_name = ? AND monster_key = ?',
    [gameId, charName, monsterKey],
  );
  return (result.rows?.[0]?.kill_count ?? 0) as number;
}
