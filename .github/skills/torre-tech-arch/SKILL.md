---
name: torre-tech-arch
description: TORRE technical and data architecture — React Native stack, Zustand state, SQLite schema, seed-based data model, GameState structure, offline-first design, and performance strategy. Use when designing new systems, adding entities, debugging persistence, or optimizing state management. Keywords: arquitectura, architecture, SQLite, Zustand, state, GameState, seed, offline, database schema, persistencia.
argument-hint: [topic: "GameState structure" | "SQLite schema" | "seed model" | "offline persistence" | "Zustand store"]
---

# TORRE — Arquitectura Técnica y de Datos

---

## Stack Tecnológico

| Layer | Tecnología |
|---|---|
| Framework | React Native CLI |
| Language | TypeScript (strict) |
| Navigation | React Navigation |
| State | Zustand |
| Database | SQLite (offline-first) |
| Styling | NativeWind (Tailwind CSS) |
| Backend | **Ninguno en MVP** — 100% local |

El juego funciona **completamente offline**. Sin servidor.

---

## Principio Central: Seed

- **Todo** está ligado a una Seed.
- Cada Seed es un ecosistema independiente.
- Los datos **no comparten progreso** entre seeds.
- Todo cálculo debe ser **determinístico** — mismo seed = mismo resultado.

```typescript
// SIEMPRE usar seed como fuente de aleatoriedad
function deterministicRandom(seed: string, context: string): number {
  // hash estable, sin Date.now(), sin Math.random()
}
```

---

## GameState — Estructura Global

```typescript
interface GameState {
  currentSeed: string;
  currentCycle: number;
  parties: Party[];        // incluye player + AI
  events: GameEvent[];
  activeCombat: CombatState | null;
  worldLog: GuildEvent[];
  bounties: Bounty[];
  alliances: Alliance[];
}
```

Este estado:
1. Se construye desde SQLite al cargar.
2. El motor de simulación lo actualiza.
3. Se persiste después de cada acción crítica.

---

## Entidades Principales

```typescript
// Entidades del juego
Seeds, Parties, Characters, Items, Events, Alliances, Bounties
// Cada entidad tiene: id, seedId, y estado actual
```

---

## Esquema SQLite (Completo)

### Seeds
```sql
CREATE TABLE Seeds (
  id TEXT PRIMARY KEY,
  createdAt TEXT,
  difficulty TEXT,
  status TEXT CHECK(status IN ('active','locked','finished')),
  maxParties INTEGER DEFAULT 10,
  currentCycle INTEGER,
  isLocked INTEGER  -- boolean
);
CREATE INDEX idx_seeds_status ON Seeds(status);
```

### Parties
```sql
CREATE TABLE Parties (
  id TEXT PRIMARY KEY,
  seedId TEXT NOT NULL REFERENCES Seeds(id),
  ownerType TEXT CHECK(ownerType IN ('player','ai')),
  ownerId TEXT,
  name TEXT,
  levelAvg REAL,
  goldBalance REAL,
  moralScore REAL,
  bountyLevel INTEGER DEFAULT 0,
  status TEXT CHECK(status IN ('active','eliminated','retired')),
  currentFloor INTEGER,
  currentZone TEXT,
  cycleProgress INTEGER,
  createdAt TEXT
);
CREATE INDEX idx_parties_seed ON Parties(seedId);
CREATE INDEX idx_parties_owner ON Parties(ownerType);
CREATE INDEX idx_parties_status ON Parties(status);
```

### Characters
```sql
CREATE TABLE Characters (
  id TEXT PRIMARY KEY,
  partyId TEXT NOT NULL REFERENCES Parties(id),
  name TEXT,
  race TEXT,
  class TEXT,
  level INTEGER,
  xp INTEGER,
  stats TEXT,  -- JSON: {STR,DEX,CON,INT,WIS,CHA}
  alignment TEXT,
  morale REAL,
  isAlive INTEGER,  -- boolean
  deathCount INTEGER DEFAULT 0,
  createdAt TEXT
);
CREATE INDEX idx_chars_party ON Characters(partyId);
CREATE INDEX idx_chars_level ON Characters(level);
```

### Items
```sql
CREATE TABLE Items (
  id TEXT PRIMARY KEY,
  seedId TEXT NOT NULL REFERENCES Seeds(id),
  ownerPartyId TEXT REFERENCES Parties(id),
  equippedBy TEXT,  -- characterId nullable
  name TEXT,
  type TEXT,
  rarity TEXT CHECK(rarity IN ('common','uncommon','rare','legendary')),
  isUnique INTEGER,
  obtainedCycle INTEGER,
  isEquipped INTEGER,
  createdAt TEXT
);
```

### Events
```sql
CREATE TABLE Events (
  id TEXT PRIMARY KEY,
  seedId TEXT NOT NULL REFERENCES Seeds(id),
  type TEXT,  -- Combat | BossKilled | PartyEliminated | ...
  floor INTEGER,
  zone TEXT,
  cycle INTEGER,
  involvedParties TEXT,  -- JSON array de ids
  result TEXT,           -- JSON con detalles
  createdAt TEXT
);
CREATE INDEX idx_events_seed_cycle ON Events(seedId, cycle);
```

### Alliances
```sql
CREATE TABLE Alliances (
  id TEXT PRIMARY KEY,
  seedId TEXT NOT NULL REFERENCES Seeds(id),
  partyA TEXT,
  partyB TEXT,
  protectionFee REAL,
  expiresAtCycle INTEGER,
  status TEXT CHECK(status IN ('active','expired','broken')),
  createdAt TEXT
);
```

### Bounties
```sql
CREATE TABLE Bounties (
  id TEXT PRIMARY KEY,
  seedId TEXT NOT NULL REFERENCES Seeds(id),
  targetPartyId TEXT,
  issuedBy TEXT,
  rewardAmount REAL,
  level INTEGER,
  isActive INTEGER,  -- boolean
  createdAt TEXT
);
```

---

## Carga de una Seed

```typescript
async function loadSeed(seedId: string): Promise<GameState> {
  const seed = await db.getSeed(seedId);
  const parties = await db.getParties(seedId);
  const characters = await Promise.all(parties.map(p => db.getCharacters(p.id)));
  const events = await db.getEvents(seedId);
  return buildGameState(seed, parties, characters, events);
}
```

---

## Cuándo Persistir

Guardar estado después de:
- Fin de ciclo.
- Combate.
- Muerte de personaje.
- Formación/ruptura de alianza.
- Pago/transacción de oro.

Usar **transacciones SQLite** cuando haya múltiples cambios simultáneos.

---

## Render y Performance

```typescript
// ✅ CORRECTO — selectores específicos
const currentParty = useGameStore(s => s.currentParty);

// ❌ INCORRECTO — suscripción total
const store = useGameStore();
```

Para 10 parties + 60 ciclos:
- Simulación por lotes (no en tiempo real).
- Cálculos matemáticos ligeros.
- Sin loops infinitos ni procesado por individuo innecesario.

---

## Archivos Relacionados

| Archivo | Propósito |
|---|---|
| `src/database/connection.ts` | Conexión SQLite |
| `src/database/migrations.ts` | Migraciones del esquema |
| `src/database/gameRepository.ts` | CRUD de todas las entidades |
| `src/stores/gameStore.ts` | Zustand store global |
| `src/services/simulationEngine.ts` | Motor de simulación |

---

## Anti-Patrones a Evitar

- ❌ No usar `Math.random()` para lógica de juego.
- ❌ No guardar GameState completo en memoria sin origen SQLite.
- ❌ No hacer joins pesados en runtime — filtrar por seedId.
- ❌ No agregar columnas sin migración.
- ❌ No usar `useGameStore()` sin selector.
