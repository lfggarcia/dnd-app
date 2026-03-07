import { getDB } from './connection';

// ─── Types ────────────────────────────────────────────────

export type SavedGameRow = {
  id: string;
  seed: string;
  seed_hash: string;
  party_data: string;
  floor: number;
  cycle: number;
  phase: string;
  gold: number;
  status: string;
  location: string;
  map_state: string | null;
  party_portrait: string | null;
  portraits_json: string | null;
  expressions_json: string | null;
  created_at: string;
  updated_at: string;
};

export type SavedGame = {
  id: string;
  seed: string;
  seedHash: string;
  partyData: CharacterSave[];
  floor: number;
  cycle: number;
  phase: 'DAY' | 'NIGHT';
  gold: number;
  status: 'active' | 'completed' | 'dead';
  location: 'village' | 'map';
  mapState: string | null;
  partyPortrait: string | null;
  /** Map of character index → base64 portrait data URI, separate from party_data to keep it lean */
  portraitsJson: Record<string, string> | null;
  /** Map of character index → { expression key → base64 data URI } generated via img2img */
  expressionsJson: Record<string, Record<string, string>> | null;
  createdAt: string;
  updatedAt: string;
};

export type Stats = {
  STR: number;
  DEX: number;
  CON: number;
  INT: number;
  WIS: number;
  CHA: number;
};

export type CharacterSave = {
  name: string;
  race: string;
  charClass: string;
  subclass: string;
  background: string;
  alignment: string;
  baseStats: Stats;
  statMethod: 'standard' | 'rolled';
  featureChoices: Record<string, string | string[]>;
  hp: number;
  maxHp: number;
  alive: boolean;
  portrait?: string;
};

// ─── Helpers ──────────────────────────────────────────────

function rowToSavedGame(row: SavedGameRow): SavedGame {
  let portraitsJson: Record<string, string> | null = null;
  if (row.portraits_json) {
    try { portraitsJson = JSON.parse(row.portraits_json) as Record<string, string>; } catch { /* ignore */ }
  }
  let expressionsJson: Record<string, Record<string, string>> | null = null;
  if (row.expressions_json) {
    try { expressionsJson = JSON.parse(row.expressions_json) as Record<string, Record<string, string>>; } catch { /* ignore */ }
  }
  return {
    id: row.id,
    seed: row.seed,
    seedHash: row.seed_hash,
    partyData: JSON.parse(row.party_data) as CharacterSave[],
    floor: row.floor,
    cycle: row.cycle,
    phase: row.phase as 'DAY' | 'NIGHT',
    gold: row.gold,
    status: row.status as 'active' | 'completed' | 'dead',
    location: (row.location ?? 'village') as 'village' | 'map',
    mapState: row.map_state ?? null,
    partyPortrait: row.party_portrait ?? null,
    portraitsJson,
    expressionsJson,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${ts}-${rand}`;
}

// ─── CRUD ─────────────────────────────────────────────────

export function createSavedGame(
  seed: string,
  seedHash: string,
  partyData: CharacterSave[],
): SavedGame {
  const db = getDB();
  const id = generateId();
  const now = new Date().toISOString();

  db.executeSync(
    `INSERT INTO saved_games (id, seed, seed_hash, party_data, floor, cycle, phase, gold, status, location, map_state, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, 1, 'DAY', 0, 'active', 'village', NULL, ?, ?)`,
    [id, seed, seedHash, JSON.stringify(partyData), now, now],
  );

  return {
    id, seed, seedHash, partyData,
    floor: 1, cycle: 1, phase: 'DAY', gold: 0, status: 'active',
    location: 'village', mapState: null, partyPortrait: null, portraitsJson: null, expressionsJson: null,
    createdAt: now, updatedAt: now,
  };
}

export function updateSavedGame(
  id: string,
  updates: Partial<Pick<SavedGame, 'partyData' | 'floor' | 'cycle' | 'phase' | 'gold' | 'status' | 'location' | 'mapState' | 'partyPortrait' | 'portraitsJson' | 'expressionsJson'>>,
): void {
  const db = getDB();
  const sets: string[] = [];
  const values: (string | number)[] = [];

  if (updates.partyData !== undefined) {
    sets.push('party_data = ?');
    values.push(JSON.stringify(updates.partyData));
  }
  if (updates.floor !== undefined) {
    sets.push('floor = ?');
    values.push(updates.floor);
  }
  if (updates.cycle !== undefined) {
    sets.push('cycle = ?');
    values.push(updates.cycle);
  }
  if (updates.phase !== undefined) {
    sets.push('phase = ?');
    values.push(updates.phase);
  }
  if (updates.gold !== undefined) {
    sets.push('gold = ?');
    values.push(updates.gold);
  }
  if (updates.status !== undefined) {
    sets.push('status = ?');
    values.push(updates.status);
  }
  if (updates.location !== undefined) {
    sets.push('location = ?');
    values.push(updates.location);
  }
  if (updates.mapState !== undefined) {
    sets.push('map_state = ?');
    values.push(updates.mapState ?? null as unknown as string);
  }
  if (updates.partyPortrait !== undefined) {
    sets.push('party_portrait = ?');
    values.push(updates.partyPortrait ?? null as unknown as string);
  }
  if (updates.portraitsJson !== undefined) {
    sets.push('portraits_json = ?');
    values.push(updates.portraitsJson ? JSON.stringify(updates.portraitsJson) : null as unknown as string);
  }
  if (updates.expressionsJson !== undefined) {
    sets.push('expressions_json = ?');
    values.push(updates.expressionsJson ? JSON.stringify(updates.expressionsJson) : null as unknown as string);
  }

  if (sets.length === 0) return;

  sets.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id);

  db.executeSync(
    `UPDATE saved_games SET ${sets.join(', ')} WHERE id = ?`,
    values,
  );
}

export function getSavedGame(id: string): SavedGame | null {
  const db = getDB();
  const result = db.executeSync(
    'SELECT * FROM saved_games WHERE id = ?',
    [id],
  );
  const row = result.rows?.[0] as SavedGameRow | undefined;
  return row ? rowToSavedGame(row) : null;
}

export function getActiveSavedGame(): SavedGame | null {
  const db = getDB();
  const result = db.executeSync(
    "SELECT * FROM saved_games WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1",
  );
  const row = result.rows?.[0] as SavedGameRow | undefined;
  return row ? rowToSavedGame(row) : null;
}

export function getAllSavedGames(): SavedGame[] {
  const db = getDB();
  const result = db.executeSync(
    'SELECT * FROM saved_games ORDER BY updated_at DESC',
  );
  return (result.rows as SavedGameRow[] ?? []).map(rowToSavedGame);
}

export function deleteSavedGame(id: string): void {
  const db = getDB();
  db.executeSync('DELETE FROM saved_games WHERE id = ?', [id]);
}
