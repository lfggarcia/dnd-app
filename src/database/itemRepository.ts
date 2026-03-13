/**
 * itemRepository.ts
 * CRUD for the `items` table (DB migration v8).
 * Items are D&D loot entities: weapons, armor, consumables, materials, boss_loot.
 *
 * All functions are synchronous (op-sqlite executeSync).
 */

import { getDB } from './connection';

// ─── Types ────────────────────────────────────────────────

export type ItemType = 'weapon' | 'armor' | 'consumable' | 'material' | 'boss_loot';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'unique';

export type Item = {
  id: string;
  seedHash: string;
  ownerGameId: string | null;
  ownerCharName: string | null;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  isEquipped: boolean;
  isUnique: boolean;
  obtainedCycle: number;
  floorObtained: number;
  goldValue: number;
  /** Extra stats/effects as a parsed object */
  data: Record<string, unknown>;
  claimed: boolean;
  createdAt: string;
};

type ItemRow = {
  id: string;
  seed_hash: string;
  owner_game_id: string | null;
  owner_char_name: string | null;
  name: string;
  type: string;
  rarity: string;
  is_equipped: number;
  is_unique: number;
  obtained_cycle: number;
  floor_obtained: number;
  gold_value: number;
  data: string;
  claimed: number;
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `item-${ts}-${rand}`;
}

function rowToItem(row: ItemRow): Item {
  return {
    id: row.id,
    seedHash: row.seed_hash,
    ownerGameId: row.owner_game_id,
    ownerCharName: row.owner_char_name,
    name: row.name,
    type: row.type as ItemType,
    rarity: row.rarity as ItemRarity,
    isEquipped: row.is_equipped === 1,
    isUnique: row.is_unique === 1,
    obtainedCycle: row.obtained_cycle,
    floorObtained: row.floor_obtained,
    goldValue: row.gold_value,
    data: JSON.parse(row.data || '{}'),
    claimed: row.claimed === 1,
    createdAt: row.created_at,
  };
}

// ─── Create ───────────────────────────────────────────────

export type CreateItemInput = Omit<Item, 'id' | 'createdAt'>;

export function createItem(input: CreateItemInput): Item {
  const db = getDB();
  const id = input.isUnique ? input.name : generateId();
  const createdAt = new Date().toISOString();

  db.executeSync(
    `INSERT INTO items
       (id, seed_hash, owner_game_id, owner_char_name, name, type, rarity,
        is_equipped, is_unique, obtained_cycle, floor_obtained, gold_value,
        data, claimed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.seedHash,
      input.ownerGameId,
      input.ownerCharName,
      input.name,
      input.type,
      input.rarity,
      input.isEquipped ? 1 : 0,
      input.isUnique ? 1 : 0,
      input.obtainedCycle,
      input.floorObtained,
      input.goldValue,
      JSON.stringify(input.data),
      input.claimed ? 1 : 0,
      createdAt,
    ],
  );

  return { ...input, id, createdAt };
}

// ─── Read ─────────────────────────────────────────────────

export function getItemById(id: string): Item | null {
  const db = getDB();
  const result = db.executeSync('SELECT * FROM items WHERE id = ?', [id]);
  const row = result.rows?.[0] as ItemRow | undefined;
  return row ? rowToItem(row) : null;
}

export function getItemsByGame(gameId: string): Item[] {
  const db = getDB();
  const result = db.executeSync(
    'SELECT * FROM items WHERE owner_game_id = ? ORDER BY floor_obtained DESC',
    [gameId],
  );
  return (result.rows ?? []).map(r => rowToItem(r as ItemRow));
}

export function getItemsByCharacter(gameId: string, charName: string): Item[] {
  const db = getDB();
  const result = db.executeSync(
    'SELECT * FROM items WHERE owner_game_id = ? AND owner_char_name = ?',
    [gameId, charName],
  );
  return (result.rows ?? []).map(r => rowToItem(r as ItemRow));
}

export function isBossLootClaimed(seedHash: string, bossId: string): boolean {
  const db = getDB();
  const result = db.executeSync(
    'SELECT id FROM items WHERE seed_hash = ? AND name LIKE ? AND claimed = 1',
    [seedHash, `BOSS_${bossId}_%`],
  );
  return (result.rows?.length ?? 0) > 0;
}

// ─── Update ───────────────────────────────────────────────

export function equipItem(id: string, charName: string): void {
  const db = getDB();
  db.executeSync(
    'UPDATE items SET is_equipped = 1, owner_char_name = ? WHERE id = ?',
    [charName, id],
  );
}

export function unequipItem(id: string): void {
  const db = getDB();
  db.executeSync('UPDATE items SET is_equipped = 0 WHERE id = ?', [id]);
}

export function claimItem(id: string): void {
  const db = getDB();
  db.executeSync('UPDATE items SET claimed = 1 WHERE id = ?', [id]);
}

export function assignItemToGame(id: string, gameId: string): void {
  const db = getDB();
  db.executeSync('UPDATE items SET owner_game_id = ? WHERE id = ?', [gameId, id]);
}

// ─── Delete ───────────────────────────────────────────────

export function deleteItem(id: string): void {
  const db = getDB();
  db.executeSync('DELETE FROM items WHERE id = ?', [id]);
}

export function deleteItemsByGame(gameId: string): void {
  const db = getDB();
  db.executeSync('DELETE FROM items WHERE owner_game_id = ?', [gameId]);
}

/** Returns items obtained in the last session (since `sinceCycle`), capped at 50. */
export function getRecentItems(gameId: string, sinceCycle: number): Item[] {
  const db = getDB();
  const result = db.executeSync(
    'SELECT * FROM items WHERE owner_game_id = ? AND obtained_cycle >= ? ORDER BY obtained_cycle DESC LIMIT 50',
    [gameId, sinceCycle],
  );
  return (result.rows ?? []).map(rowToItem);
}
