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

/**
 * CR-BS-04: Batch version — wraps all inserts in a single transaction
 * to avoid per-row overhead when persisting multiple essence drops at once.
 */
export function saveEssenceDropsBatch(inputs: EssenceSaveInput[]): void {
  if (inputs.length === 0) return;
  const db = getDB();
  const now = new Date().toISOString();
  db.executeSync('BEGIN TRANSACTION');
  try {
    for (const input of inputs) {
      const id = `${input.seedHash}_essence_${input.definitionId}_${input.obtainedCycle}_${input.obtainedFloor}`;
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
    db.executeSync('COMMIT');
  } catch (e) {
    db.executeSync('ROLLBACK');
    throw e;
  }
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

// ─── Unification Essence Cap (RI-01) ─────────────────────

/**
 * RI-01: When a new game starts via seed unification, enforce the cap:
 * at most 1 essence of rank ≤ 3 per character from the previous game.
 * Higher-ranked essences (rank 4–5) are kept without limit.
 *
 * Call this after the new game is created, passing the previous game ID.
 */
export function capEssencesOnUnification(previousGameId: string): void {
  const db = getDB();
  const result = db.executeSync(
    'SELECT DISTINCT owner_char_name FROM essences WHERE owner_game_id = ?',
    [previousGameId],
  );
  const charNames = (result.rows ?? []).map(r => r.owner_char_name as string);

  for (const charName of charNames) {
    // Get all low-rank essences ordered oldest first
    const lowRank = db.executeSync(
      `SELECT id FROM essences
       WHERE owner_game_id = ? AND owner_char_name = ? AND rank <= 3
       ORDER BY obtained_cycle ASC, obtained_floor ASC`,
      [previousGameId, charName],
    );
    const ids = (lowRank.rows ?? []).map(r => r.id as string);
    // Keep only the first one (lowest cycle/floor = oldest); delete the rest
    const toDelete = ids.slice(1);
    for (const id of toDelete) {
      db.executeSync('DELETE FROM essences WHERE id = ?', [id]);
    }
  }
}
