# 08 · ARQUITECTURA DE DATOS
> **Estado actual:** ~22% — `saved_games` cubre seeds+parties+chars de forma simplificada. Faltan: items, events, alliances, bounties
> **Sprint objetivo:** 5-6 (progresivo con cada sistema)
> **Archivos a crear/modificar:** `migrations.ts`, nuevo `src/database/itemRepository.ts`, nuevo `src/database/eventRepository.ts`, nuevo `src/database/essenceRepository.ts`, actualizar `gameRepository.ts`, nuevo `src/utils/prng.ts`
> **Cambios v2:** añadidas migrations v11–v13; tipo `CharacterSave` canónico completo; utilitario `prng.ts` compartido

---

## Schema Completo Objetivo

| Tabla | Schema actual | Migración | Sprint |
|-------|---------------|-----------|--------|
| `saved_games` | ✅ v6 | v7: `cycle_raw`, `last_action_at`, `last_sim_events` | 5 |
| `items` | ❌ | v8: tabla completa | 6 |
| `events` | ❌ | v9: tabla completa | 6 |
| `bounties` | ❌ | v9: tabla completa | 6 |
| `alliances` | ❌ | v10: tabla completa | 6 |
| `saved_games` | v7 | v11: `in_safe_zone`, `safe_zone_room_id` | 6 |
| `saved_games` | v11 | v12: `party_origin`, `predecessor_game_id`, `created_by_player`, `elimination_reason` | 6 |
| `essences` | ❌ | v13: tabla completa | 7 |
| `monster_kills` | ❌ | v13: tabla completa | 7 |

---

## Utilitario PRNG compartido (NI-03)

Crear `src/utils/prng.ts` **antes de cualquier servicio** — es la base de todo el determinismo:

```typescript
/**
 * prng.ts — Utilitario PRNG compartido para todo el proyecto Torre.
 *
 * Algoritmo: djb2 hash + LCG (Linear Congruential Generator)
 * Mismo algoritmo en combatEngine, dungeonGraphService, worldSimulator,
 * moralSystem, encounterService, essenceService, etc.
 *
 * NUNCA definir makePRNG inline en ningún servicio — siempre importar desde aquí.
 */

export type PRNG = {
  float(): number;          // 0.0 – 1.0 exclusivo
  next(min: number, max: number): number;  // entero [min, max] inclusivo
};

/**
 * Crea un generador determinístico con semilla de texto.
 * El mismo string de semilla siempre produce la misma secuencia.
 *
 * @example
 * const rng = makePRNG('myworld_essence_drop_room_42');
 * const chance = rng.float(); // siempre el mismo valor para esa semilla
 */
export function makePRNG(seed: string): PRNG {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(h, 33) ^ seed.charCodeAt(i)) >>> 0;
  }
  let s = h >>> 0;

  const advance = (): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s;
  };

  return {
    float(): number {
      return advance() / 0x100000000;
    },
    next(min: number, max: number): number {
      return Math.floor(this.float() * (max - min + 1)) + min;
    },
  };
}
```

---

## CharacterSave — Tipo Canónico Completo (NI-02)

Esta es la fuente de verdad. Todos los docs que definen campos parciales apuntan aquí.

```typescript
// src/database/gameRepository.ts

import type { AscensionPath } from '../services/essenceService';

export type Stats = {
  STR: number; DEX: number; CON: number;
  INT: number; WIS: number; CHA: number;
};

/**
 * CharacterSave — tipo completo con todos los campos de todos los sistemas.
 *
 * Campos por sistema:
 *   Core (siempre existente): name, race, charClass, subclass, background,
 *     alignment, baseStats, statMethod, featureChoices, hp, maxHp, alive, portrait
 *
 *   Doc 05 (Moral): morale, killCount
 *   Doc 06 (Progresión): level, xp, deathCount, pendingLevelUps
 *   Doc 13 (Esencias): isAscended, ascensionPath, unlockedAbilities
 */
export type CharacterSave = {
  // ── CORE ────────────────────────────────────────────────
  name:           string;
  race:           string;
  charClass:      string;
  subclass:       string;
  background:     string;
  alignment:      string;
  baseStats:      Stats;
  statMethod:     'standard' | 'rolled';
  featureChoices: Record<string, string | string[]>;
  hp:             number;
  maxHp:          number;
  alive:          boolean;
  portrait?:      string;

  // ── PROGRESIÓN (Doc 06) ──────────────────────────────────
  level:          number;    // inicia en 1; cap MVP = 10, full = 20
  xp:             number;    // XP acumulada
  deathCount:     number;    // veces muerto (afecta costo de revivir)
  pendingLevelUps: number;   // niveles ganados en combate, se confirman en CampScreen

  // ── MORAL (Doc 05) ───────────────────────────────────────
  morale:         number;    // 0–100, inicia en 80
  killCount:      number;    // parties IA eliminadas (afecta moral y bounty)

  // ── ASCENSIÓN + ESENCIAS (Doc 13) ───────────────────────
  isAscended:     boolean;                // false por defecto
  ascensionPath?: AscensionPath;          // 'TITAN' | 'ARCHMAGE' | 'AVATAR_OF_WAR'
  unlockedAbilities: string[];            // IDs de habilidades: clase + subclase + esencia
};

// Valores por defecto al crear un personaje nuevo:
export const CHARACTER_SAVE_DEFAULTS: Omit<CharacterSave, 'name' | 'race' | 'charClass' | 'subclass' | 'background' | 'alignment' | 'baseStats' | 'statMethod' | 'featureChoices' | 'hp' | 'maxHp' | 'portrait'> = {
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
```

---

## Migration v7 — Ciclo fraccionario

```typescript
7: [
  `ALTER TABLE saved_games ADD COLUMN cycle_raw REAL NOT NULL DEFAULT 1.0`,
  `ALTER TABLE saved_games ADD COLUMN last_action_at TEXT`,
  `ALTER TABLE saved_games ADD COLUMN last_sim_events TEXT`,
],
```

---

## Migration v8 — Items

```typescript
8: [
  `CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    seed_hash TEXT NOT NULL,
    owner_game_id TEXT,
    owner_char_name TEXT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('weapon','armor','consumable','material','boss_loot')),
    rarity TEXT NOT NULL CHECK(rarity IN ('common','uncommon','rare','unique')),
    is_equipped INTEGER NOT NULL DEFAULT 0,
    is_unique INTEGER NOT NULL DEFAULT 0,
    obtained_cycle INTEGER NOT NULL DEFAULT 1,
    floor_obtained INTEGER NOT NULL DEFAULT 1,
    gold_value INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL DEFAULT '{}',
    claimed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_items_game ON items(owner_game_id)`,
  `CREATE INDEX IF NOT EXISTS idx_items_seed ON items(seed_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_items_type ON items(type)`,
  `CREATE INDEX IF NOT EXISTS idx_items_floor ON items(floor_obtained)`,
],
```

---

## Migration v9 — Events y Bounties

```typescript
9: [
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    seed_hash TEXT NOT NULL,
    type TEXT NOT NULL,
    floor INTEGER NOT NULL,
    cycle INTEGER NOT NULL,
    party_name TEXT NOT NULL,
    target_name TEXT,
    data TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_events_seed ON events(seed_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_events_cycle ON events(cycle DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)`,

  `CREATE TABLE IF NOT EXISTS bounties (
    id TEXT PRIMARY KEY,
    seed_hash TEXT NOT NULL,
    target_game_id TEXT NOT NULL,
    issued_by TEXT NOT NULL DEFAULT 'GUILD',
    reward_amount INTEGER NOT NULL DEFAULT 0,
    bounty_level INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    kill_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bounties_seed ON bounties(seed_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_bounties_active ON bounties(is_active)`,
],
```

---

## Migration v10 — Alliances

```typescript
10: [
  `CREATE TABLE IF NOT EXISTS alliances (
    id TEXT PRIMARY KEY,
    seed_hash TEXT NOT NULL,
    party_a TEXT NOT NULL,
    party_b TEXT NOT NULL,
    protection_fee INTEGER NOT NULL DEFAULT 0,
    expires_at_cycle INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','terminated')),
    created_at TEXT NOT NULL,
    created_cycle INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_alliances_seed ON alliances(seed_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_alliances_party_a ON alliances(party_a)`,
  `CREATE INDEX IF NOT EXISTS idx_alliances_status ON alliances(status)`,
],
```

---

## Migration v11 — Zona Segura (Doc 11)

```typescript
11: [
  // Permite saber si el jugador está en una zona segura al guardar/cerrar
  `ALTER TABLE saved_games ADD COLUMN in_safe_zone INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE saved_games ADD COLUMN safe_zone_room_id TEXT`,
],
```

---

## Migration v12 — Lifecycle de Parties (Doc 12)

```typescript
12: [
  // Origen de la party (creada por el jugador vs generada por el sistema)
  `ALTER TABLE saved_games ADD COLUMN party_origin TEXT NOT NULL DEFAULT 'PLAYER'`,
  // CHECK: 'PLAYER' | 'IA_INHERITED' | 'SYSTEM'

  // ID de la partida anterior si es heredada
  `ALTER TABLE saved_games ADD COLUMN predecessor_game_id TEXT`,

  // Si fue creada por el jugador (vs spawn automático del sistema)
  `ALTER TABLE saved_games ADD COLUMN created_by_player INTEGER NOT NULL DEFAULT 1`,

  // Razón de eliminación (si aplica)
  `ALTER TABLE saved_games ADD COLUMN elimination_reason TEXT`,
  // 'PURGED' | 'BANKRUPT' | 'DEFEATED' | null
],
```

---

## Migration v13 — Esencias (Doc 13)

```typescript
13: [
  `CREATE TABLE IF NOT EXISTS essences (
    id TEXT PRIMARY KEY,
    seed_hash TEXT NOT NULL,
    owner_game_id TEXT NOT NULL,
    owner_char_name TEXT,
    definition_id TEXT NOT NULL,
    rank INTEGER NOT NULL CHECK(rank BETWEEN 1 AND 5),
    evolution_level INTEGER NOT NULL DEFAULT 1 CHECK(evolution_level BETWEEN 1 AND 3),
    kills_on_source_type INTEGER NOT NULL DEFAULT 1,
    equipped_slot INTEGER,
    obtained_cycle INTEGER NOT NULL DEFAULT 1,
    obtained_floor INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_essences_game ON essences(owner_game_id)`,
  `CREATE INDEX IF NOT EXISTS idx_essences_char ON essences(owner_char_name)`,
  `CREATE INDEX IF NOT EXISTS idx_essences_seed ON essences(seed_hash)`,

  `CREATE TABLE IF NOT EXISTS monster_kills (
    id TEXT PRIMARY KEY,
    owner_game_id TEXT NOT NULL,
    owner_char_name TEXT NOT NULL,
    monster_type TEXT NOT NULL,
    kill_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_kills_unique
   ON monster_kills(owner_game_id, owner_char_name, monster_type)`,
],
```

---

## itemRepository.ts — CRUD de items

Crear `src/database/itemRepository.ts`:

```typescript
import { getDB } from './connection';
import type { LootDrop } from '../services/lootService';

export type ItemRow = {
  id: string; seedHash: string; ownerGameId: string | null;
  ownerCharName: string | null; name: string;
  type: 'weapon' | 'armor' | 'consumable' | 'material' | 'boss_loot';
  rarity: 'common' | 'uncommon' | 'rare' | 'unique';
  isEquipped: boolean; isUnique: boolean; obtainedCycle: number;
  floorObtained: number; goldValue: number;
  data: Record<string, unknown>; claimed: boolean;
};

export function saveItems(drops: LootDrop[], gameId: string, seedHash: string, cycle: number, floor: number): void {
  const db = getDB();
  db.executeSync('BEGIN TRANSACTION');
  try {
    for (const drop of drops) {
      db.executeSync(
        `INSERT OR IGNORE INTO items
          (id, seed_hash, owner_game_id, name, type, rarity, is_unique, obtained_cycle,
           floor_obtained, gold_value, data, claimed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`,
        [drop.id, seedHash, gameId, drop.name, drop.type, drop.rarity,
         drop.rarity === 'unique' ? 1 : 0, cycle, floor, drop.goldValue, JSON.stringify(drop.data)],
      );
    }
    const bossLoot = drops.filter(d => d.type === 'boss_loot');
    for (const item of bossLoot) {
      db.executeSync(`UPDATE items SET claimed = 1 WHERE id = ?`, [item.id]);
    }
    db.executeSync('COMMIT');
  } catch (e) { db.executeSync('ROLLBACK'); throw e; }
}

export function getInventory(gameId: string): ItemRow[] {
  const db = getDB();
  const result = db.executeSync(
    `SELECT * FROM items WHERE owner_game_id = ? ORDER BY floor_obtained DESC, rarity DESC`,
    [gameId],
  );
  return (result.rows ?? []).map(rowToItem);
}

export function equipItem(itemId: string, charName: string): void {
  getDB().executeSync(`UPDATE items SET is_equipped = 1, owner_char_name = ? WHERE id = ?`, [charName, itemId]);
}
export function unequipItem(itemId: string): void {
  getDB().executeSync(`UPDATE items SET is_equipped = 0, owner_char_name = NULL WHERE id = ?`, [itemId]);
}
export function sellItem(itemId: string, gameId: string): number {
  const db = getDB();
  const res = db.executeSync(`SELECT gold_value FROM items WHERE id = ? AND owner_game_id = ?`, [itemId, gameId]);
  if (!res.rows?.length) return 0;
  const value = Math.floor((res.rows[0].gold_value as number) * 0.6);
  db.executeSync(`DELETE FROM items WHERE id = ?`, [itemId]);
  return value;
}
function rowToItem(row: Record<string, unknown>): ItemRow {
  return {
    id: row.id as string, seedHash: row.seed_hash as string,
    ownerGameId: row.owner_game_id as string | null,
    ownerCharName: row.owner_char_name as string | null,
    name: row.name as string, type: row.type as ItemRow['type'],
    rarity: row.rarity as ItemRow['rarity'], isEquipped: Boolean(row.is_equipped),
    isUnique: Boolean(row.is_unique), obtainedCycle: row.obtained_cycle as number,
    floorObtained: row.floor_obtained as number, goldValue: row.gold_value as number,
    data: JSON.parse(row.data as string ?? '{}'), claimed: Boolean(row.claimed),
  };
}
```

---

## eventRepository.ts — Historial permanente

Crear `src/database/eventRepository.ts`:

```typescript
import { getDB } from './connection';
import type { SimulationEvent } from '../services/worldSimulator';

export function saveSimulationEvents(events: SimulationEvent[], seedHash: string): void {
  const db = getDB();
  db.executeSync('BEGIN TRANSACTION');
  try {
    for (const event of events) {
      const id = `${seedHash}_${event.type}_${event.cycle}_${event.partyName}`;
      db.executeSync(
        `INSERT OR IGNORE INTO events (id, seed_hash, type, floor, cycle, party_name, target_name, data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, '{}', datetime('now'))`,
        [id, seedHash, event.type, event.floor, event.cycle, event.partyName, event.targetName ?? null],
      );
    }
    db.executeSync('COMMIT');
  } catch (e) { db.executeSync('ROLLBACK'); }
}

export function getRecentEvents(seedHash: string, limit = 50) {
  const db = getDB();
  const result = db.executeSync(
    `SELECT * FROM events WHERE seed_hash = ? ORDER BY cycle DESC LIMIT ?`,
    [seedHash, limit],
  );
  return result.rows ?? [];
}

export function countPartyKills(seedHash: string): number {
  const db = getDB();
  const result = db.executeSync(
    `SELECT COUNT(*) as count FROM events WHERE seed_hash = ? AND type = 'PARTY_KILL' AND party_name = 'PLAYER'`,
    [seedHash],
  );
  return (result.rows?.[0]?.count as number) ?? 0;
}
```

---

## Diagrama de relaciones completo

```
saved_games (1) ──── (N) items              owner_game_id
     │
     ├── (1) ──── (N) bounties              target_game_id
     │
     ├── (1) ──── (N) alliances             party_a
     │
     ├── (1) ──── (N) essences              owner_game_id
     │
     ├── (1) ──── (N) monster_kills         owner_game_id
     │
     └── seed_hash ── (N) events            seed_hash
```

---

## Checklist de implementación

- [ ] Crear `src/utils/prng.ts` — utilitario compartido, PRIMERO antes de cualquier servicio (NI-03)
- [ ] Migrations v7–v10 (Sprint 5-6)
- [ ] Migrations v11–v12 (Sprint 6)
- [ ] Migration v13 (Sprint 7)
- [ ] Crear `src/database/itemRepository.ts`
- [ ] Crear `src/database/eventRepository.ts`
- [ ] Crear `src/database/essenceRepository.ts` (ver doc 13 Paso 6)
- [ ] Actualizar `gameRepository.ts` con `CharacterSave` canónico completo
- [ ] Actualizar `gameRepository.ts` con nuevos campos de `SavedGame` (v7: cycleRaw, lastActionAt, lastSimEvents; v11: inSafeZone; v12: partyOrigin, predecessorGameId)
- [ ] Añadir barrel exports en `src/database/index.ts`
- [ ] Reemplazar todos los `makePRNG` inline en servicios con import desde `src/utils/prng.ts`
- [ ] Test: migración backward-compatible desde v6 a v13
