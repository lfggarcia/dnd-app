import { getDB } from './connection';

// ─── Types ────────────────────────────────────────────────

export type SavedGameRow = {
  id: string;
  seed: string;
  seed_hash: string;
  party_data: string;
  floor: number;
  cycle: number;
  cycle_raw: number | null;
  last_action_at: string | null;
  last_sim_events: string | null;
  phase: string;
  gold: number;
  status: string;
  location: string;
  map_state: string | null;
  party_portrait: string | null;
  portraits_json: string | null;
  expressions_json: string | null;
  // v11 — safe zones
  in_safe_zone: number | null;
  safe_zone_room_id: string | null;
  // v12 — party origin
  party_origin: string | null;
  predecessor_game_id: string | null;
  created_by_player: number | null;
  elimination_reason: string | null;
  // v15 — kill records for secret boss evaluation
  kill_records: string | null;
  // v16 — combat crash recovery
  combat_room_id: string | null;
  combat_room_type: string | null;
  // v17 — party name visible in rankings
  party_name: string | null;
  created_at: string;
  updated_at: string;
};

export type SavedGame = {
  id: string;
  seed: string;
  seedHash: string;
  /** Visible party name shown in rankings. Set in PartyScreen. (NI-10) */
  partyName: string | null;
  partyData: CharacterSave[];
  floor: number;
  /** Integer cycle (1–60). Use cycleRaw for fractional precision. */
  cycle: number;
  /** Fractional cycle for sub-cycle time tracking (e.g. 1.5 = cycle 1 + half a rest) */
  cycleRaw: number;
  lastActionAt: string | null;
  lastSimEvents: string | null;
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
  // v11 — safe zones
  inSafeZone: boolean;
  safeZoneRoomId: string | null;
  // v12 — party lifecycle
  partyOrigin: 'PLAYER' | 'IA_INHERITED' | 'SYSTEM';
  predecessorGameId: string | null;
  createdByPlayer: boolean;
  eliminationReason: 'PURGED' | 'BANKRUPT' | 'DEFEATED' | null;
  // v15 — kill records for secret boss evaluation
  killRecords: import('../services/monsterEvolutionService').KillRecord[];
  // v16 — combat crash recovery
  /** ID of the room where combat is in progress. null = no active combat. */
  combatRoomId: string | null;
  /** type of the room where combat is in progress (NORMAL, ELITE, BOSS). */
  combatRoomType: string | null;
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

/** Ascension path for Sprint 7 (essenceService). Defined here to avoid circular deps. */
export type AscensionPath = 'TITAN' | 'ARCHMAGE' | 'AVATAR_OF_WAR';

/**
 * CharacterSave — canonical type with all fields from all systems.
 *
 * Fields by system:
 *   Core: name, race, charClass, subclass, background, alignment,
 *         baseStats, statMethod, featureChoices, hp, maxHp, alive, portrait
 *   Doc 05 (Moral): morale, killCount
 *   Doc 06 (Progression): level, xp, deathCount, pendingLevelUps
 *   Doc 13 (Essences): isAscended, ascensionPath, unlockedAbilities
 */
export type CharacterSave = {
  // ── CORE ────────────────────────────────────────────────
  /** UUID unique to this character. Canonical identifier — never use `name` as key. (NI-09) */
  characterId:     string;
  name:            string;
  race:            string;
  charClass:       string;
  subclass:        string;
  background:      string;
  alignment:       string;
  baseStats:       Stats;
  statMethod:      'standard' | 'rolled';
  featureChoices:  Record<string, string | string[]>;
  hp:              number;
  maxHp:           number;
  alive:           boolean;
  portrait?:       string;

  // ── PROGRESSION (Doc 06) ────────────────────────────────
  level:           number;   // starts at 1; MVP cap = 10, full = 20
  xp:              number;   // accumulated XP
  deathCount:      number;   // times died (affects revive cost)
  pendingLevelUps: number;   // level-ups earned in combat, confirmed at CampScreen

  // ── MORAL (Doc 05) ──────────────────────────────────────
  morale:          number;   // 0–100, starts at 80
  killCount:       number;   // AI parties eliminated (affects moral and bounty)

  // ── ASCENSION + ESSENCES (Doc 13) ───────────────────────
  isAscended:        boolean;
  ascensionPath?:    AscensionPath;
  unlockedAbilities: string[];  // ability IDs: class + subclass + essence
};

/** Default values when creating a new character. */
export const CHARACTER_SAVE_DEFAULTS: Omit<
  CharacterSave,
  'characterId' | 'name' | 'race' | 'charClass' | 'subclass' | 'background' | 'alignment' |
  'baseStats' | 'statMethod' | 'featureChoices' | 'hp' | 'maxHp' | 'portrait'
> = {
  alive:             true,
  level:             1,
  xp:                0,
  deathCount:        0,
  pendingLevelUps:   0,
  morale:            80,
  killCount:         0,
  isAscended:        false,
  ascensionPath:     undefined,
  unlockedAbilities: [],
};

// ─── Helpers ──────────────────────────────────────────────

/** Strip the inline `portrait` field before persisting — portraits live in portraits_json */
function leanParty(chars: CharacterSave[]): Omit<CharacterSave, 'portrait'>[] {
  return chars.map(({ portrait: _p, ...rest }) => rest);
}

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
    partyName: (row.party_name as string | null) ?? null,
    partyData: (() => {
      try {
        const parsed = JSON.parse(row.party_data) as CharacterSave[];
        // Retrocompat: ensure every character has a characterId (NI-09)
        return parsed.map(c => c.characterId ? c : { ...c, characterId: generateId() });
      } catch {
        return []; // corrupted save — treat as empty to avoid crash on store hydrate
      }
    })(),
    floor: row.floor,
    cycle: row.cycle,
    cycleRaw: row.cycle_raw ?? row.cycle,
    lastActionAt: row.last_action_at ?? null,
    lastSimEvents: row.last_sim_events ?? null,
    phase: row.phase as 'DAY' | 'NIGHT',
    gold: row.gold,
    status: row.status as 'active' | 'completed' | 'dead',
    location: (row.location ?? 'village') as 'village' | 'map',
    mapState: row.map_state ?? null,
    partyPortrait: row.party_portrait ?? null,
    portraitsJson,
    expressionsJson,
    inSafeZone: Boolean(row.in_safe_zone),
    safeZoneRoomId: row.safe_zone_room_id ?? null,
    partyOrigin: (row.party_origin ?? 'PLAYER') as SavedGame['partyOrigin'],
    predecessorGameId: row.predecessor_game_id ?? null,
    createdByPlayer: (row.created_by_player ?? 1) !== 0,
    eliminationReason: (row.elimination_reason ?? null) as SavedGame['eliminationReason'],
    killRecords: (() => {
      try { return row.kill_records ? JSON.parse(row.kill_records) : []; } catch { return []; }
    })(),
    combatRoomId: row.combat_room_id ?? null,
    combatRoomType: row.combat_room_type ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${ts}-${rand}`;
}

/**
 * One-time migration: strip embedded `portrait` fields from `party_data` rows.
 * Older code (Sprint 4B) wrote base64 portraits into `party_data`, bloating rows
 * to ~1 MB and causing SQLITE_NOMEM on any subsequent UPDATE via journaling.
 * We temporarily disable the journal for this targeted UPDATE so SQLite can
 * write the lean value without needing to copy the large page into the journal.
 */
export function migrateStripPartyPortraits(): void {
  const db = getDB();
  const result = db.executeSync('SELECT id, party_data FROM saved_games');
  const rows = (result.rows ?? []) as { id: string; party_data: string }[];

  const dirty = rows.filter(row => {
    try {
      const party = JSON.parse(row.party_data) as CharacterSave[];
      return party.some(c => 'portrait' in c && (c as CharacterSave).portrait);
    } catch { return false; }
  });

  if (dirty.length === 0) return;

  db.executeSync('PRAGMA journal_mode=OFF');
  try {
    for (const row of dirty) {
      try {
        const party = JSON.parse(row.party_data) as CharacterSave[];
        db.executeSync(
          'UPDATE saved_games SET party_data = ?, updated_at = ? WHERE id = ?',
          [JSON.stringify(leanParty(party)), new Date().toISOString(), row.id],
        );
      } catch { /* skip row on failure */ }
    }
  } finally {
    db.executeSync('PRAGMA journal_mode=DELETE');
  }
}

// ─── CRUD ─────────────────────────────────────────────────

export function createSavedGame(
  seed: string,
  seedHash: string,
  partyData: CharacterSave[],
  partyName: string | null = null,
): SavedGame {
  const db = getDB();
  const id = generateId();
  const now = new Date().toISOString();

  db.executeSync(
    `INSERT INTO saved_games (id, seed, seed_hash, party_data, party_name, floor, cycle, cycle_raw, phase, gold, status, location, map_state, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, 1, 1.0, 'DAY', 0, 'active', 'village', NULL, ?, ?)`,
    [id, seed, seedHash, JSON.stringify(leanParty(partyData)), partyName, now, now],
  );

  return {
    id, seed, seedHash, partyData,
    partyName,
    floor: 1, cycle: 1, cycleRaw: 1.0, lastActionAt: null, lastSimEvents: null,
    phase: 'DAY', gold: 0, status: 'active',
    location: 'village', mapState: null, partyPortrait: null, portraitsJson: null, expressionsJson: null,
    inSafeZone: false, safeZoneRoomId: null,
    combatRoomId: null, combatRoomType: null,
    partyOrigin: 'PLAYER', predecessorGameId: null, createdByPlayer: true, eliminationReason: null,
    killRecords: [],
    createdAt: now, updatedAt: now,
  };
}

export function updateSavedGame(
  id: string,
  updates: Partial<Pick<SavedGame,
    | 'partyData' | 'floor' | 'cycle' | 'cycleRaw'
    | 'phase' | 'gold' | 'status' | 'location' | 'mapState'
    | 'partyPortrait' | 'portraitsJson' | 'expressionsJson'
    | 'inSafeZone' | 'safeZoneRoomId'
    | 'lastActionAt' | 'lastSimEvents'
    | 'partyOrigin' | 'killRecords'
    | 'combatRoomId' | 'combatRoomType'
    | 'partyName'
  >>,
): void {
  const db = getDB();
  const sets: string[] = [];
  const values: (string | number)[] = [];

  if (updates.partyData !== undefined) {
    sets.push('party_data = ?');
    values.push(JSON.stringify(leanParty(updates.partyData)));
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
  if (updates.inSafeZone !== undefined) {
    sets.push('in_safe_zone = ?');
    values.push(updates.inSafeZone ? 1 : 0);
  }
  if (updates.safeZoneRoomId !== undefined) {
    sets.push('safe_zone_room_id = ?');
    values.push(updates.safeZoneRoomId ?? null as unknown as string);
  }
  if (updates.cycleRaw !== undefined) {
    sets.push('cycle_raw = ?');
    values.push(updates.cycleRaw);
  }
  if (updates.lastActionAt !== undefined) {
    sets.push('last_action_at = ?');
    values.push(updates.lastActionAt ?? null as unknown as string);
  }
  if (updates.lastSimEvents !== undefined) {
    sets.push('last_sim_events = ?');
    values.push(updates.lastSimEvents ?? null as unknown as string);
  }
  if (updates.partyOrigin !== undefined) {
    sets.push('party_origin = ?');
    values.push(updates.partyOrigin);
  }
  if (updates.killRecords !== undefined) {
    sets.push('kill_records = ?');
    values.push(JSON.stringify(updates.killRecords));
  }
  if (updates.combatRoomId !== undefined) {
    sets.push('combat_room_id = ?');
    values.push(updates.combatRoomId ?? null as unknown as string);
  }
  if (updates.combatRoomType !== undefined) {
    sets.push('combat_room_type = ?');
    values.push(updates.combatRoomType ?? null as unknown as string);
  }
  if (updates.partyName !== undefined) {
    sets.push('party_name = ?');
    values.push(updates.partyName ?? null as unknown as string);
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

export function getLatestGameBySeedHash(seedHash: string): SavedGame | null {
  const db = getDB();
  const result = db.executeSync(
    "SELECT * FROM saved_games WHERE seed_hash = ? ORDER BY updated_at DESC LIMIT 1",
    [seedHash],
  );
  const row = result.rows?.[0] as SavedGameRow | undefined;
  return row ? rowToSavedGame(row) : null;
}
