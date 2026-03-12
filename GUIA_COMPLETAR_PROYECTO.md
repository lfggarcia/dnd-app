# TORRE — Guía Completa de Implementación
> Auditoría v3.0 · 2026-03-11 · Basada en código real del zip entregado
> **Estado actual:** La mayoría de sprints 4C–7 están implementados. Quedan 4 gaps reales.

---

## ⚡ TL;DR para el equipo

La auditoría anterior (v2.0) identificó ~12 gaps. **El equipo cerró 10 de ellos.** Esta guía documenta los **4 que quedan abiertos** más los **riesgos de diseño** que necesitan mitigación antes del lanzamiento.

---

## Reglas de integridad (NO cambiar sin discusión de equipo)

| Código | Regla |
|--------|-------|
| NI-01 | `MAX_LEVEL_MVP = 10` en Sprint 6 → sube a 20 con esencias (Sprint 7). Ya implementado. |
| NI-02 | El tipo `CharacterSave` canónico vive en `gameRepository.ts`. Todo campo nuevo va ahí. |
| NI-03 | `makePRNG()` **nunca** se define inline. Siempre `import { makePRNG } from '../utils/prng'`. |
| NI-04 | `AIProfile` tiene exactamente 5 valores: `AGGRESSIVE \| DEFENSIVE \| OPPORTUNISTIC \| EXPANSIONIST \| SURVIVALIST`. |
| NI-05 | `SAFE_ZONE_WAIT` en `timeService.ts`. El costo real lo calcula `safeZoneService`. |
| NI-06 | `CombatResult.essenceDrops` en `combatEngine.ts` y `essenceService.ts` deben estar sincronizados. |

---

## Estado real de sprints (auditoría v3.0)

| Sprint | Estado | Detalle |
|--------|--------|---------|
| 4C — Narrativo emocional | ✅ Completo | `NarrativeMomentPanel` funcional |
| 5A — PRNG centralizado | ✅ Completo | `dungeonGraphService` ya importa de `utils/prng` (DT-01 cerrado) |
| 5B — Sistema temporal | ✅ Completo | `updateSavedGame` persiste `cycleRaw`, `lastActionAt`, `lastSimEvents` |
| 5C — worldSimulator | ⚠️ **GAP ABIERTO** | Motor listo pero `updatedRivals` no se persiste en DB (RT-04) |
| 6A — Migraciones v7–v13 + CharacterSave | ✅ Completo | `CURRENT_VERSION = 13` ✅ |
| 6B — Economía + Loot | ✅ Completo | |
| 6C — Progresión XP / niveles | ✅ Completo | `getInheritedLevel` existe en `progressionService` |
| 6D — Moral + Bounty | ⚠️ **GAP ABIERTO** | `recordPartyKill` ✅, pero `checkForAbandonment` nunca se llama |
| 6E — Combate expandido + Safe Zones | ✅ Completo | Tab INVENTORY en CampScreen ✅ |
| 6F — Alianzas | ✅ Completo | |
| 6G — Seeds + Fin de temporada | ✅ Completo | `seedUnificationService` existe, SeedScreen lo llama |
| 7 — IA Avanzada + Esencias | ⚠️ **GAP ABIERTO** | Servicios existen, pero `SECRET_BOSS_CONDITIONS` no se evalúa |
| Performance tasks | ✅ Completo | Todos los ALTA/MEDIA/BAJA marcados `[x]` |

---

## GAP-01 🔴 — worldSimulator no persiste updatedRivals (RT-04)

### ¿Por qué importa?
`simulateWorld()` genera rivals con memoria evolutiva (perfil de IA, historial de combate, reputación). Si esos datos no se guardan, cada simulación empieza de cero. Las parties IA nunca "aprenden" ni tienen continuidad entre temporadas. El WorldLog pierde coherencia narrativa.

### Dónde está el problema
**Archivo:** `src/stores/gameStore.ts` — función `advanceToVillage` (~línea 189)

```typescript
// ESTADO ACTUAL — updatedRivals se ignora completamente
const simResult = await simulateWorld(activeGame.seedHash, newCycle, activeGame);
const updates = {
  cycleRaw: newCycle,
  cycle: newCycle,
  lastSimEvents: JSON.stringify(simResult.events),
  lastActionAt: new Date().toISOString(),
};
// ❌ simResult.updatedRivals se descarta aquí
updateSavedGame(activeGame.id, updates);
```

### Qué falta en la DB
`rivals` no tiene tabla propia. Los rivals generados en `rivalGenerator.ts` son efímeros — se regeneran cada simulación desde el seed sin memoria.

### Pasos para resolverlo

**Paso 1 — Crear tabla `rival_states` en migrations**

En `src/database/migrations.ts`, dentro del bloque `14:`, agregar:

```sql
CREATE TABLE IF NOT EXISTS rival_states (
  id          TEXT PRIMARY KEY,          -- rivalEntry.id (nombre+seed)
  seed_hash   TEXT NOT NULL,             -- pertenece a este seed
  floor       INTEGER NOT NULL,
  rep         INTEGER DEFAULT 0,
  profile     TEXT NOT NULL,             -- JSON AIProfile serializado
  memory      TEXT NOT NULL,             -- JSON AIMemory serializado
  last_cycle  INTEGER NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rival_states_seed ON rival_states (seed_hash);
```

> **Por qué migration 14 y no modificar la 13:** La v13 ya está deployada en dispositivos de test. Siempre nueva versión para nuevos schemas — nunca modificar una migración existente.

**Paso 2 — Crear `rivalRepository.ts`**

Crear `src/database/rivalRepository.ts`:

```typescript
import { getDB } from './connection';
import type { RivalEntry } from '../services/rivalGenerator';
import type { AIProfile } from '../services/aiProfileEngine';
import type { AIMemory } from '../services/aiMemoryService';

export interface PersistedRival {
  id: string;
  seedHash: string;
  floor: number;
  rep: number;
  profile: AIProfile;
  memory: AIMemory;
  lastCycle: number;
}

export function saveRivals(seedHash: string, rivals: RivalEntry[], cycle: number): void {
  const db = getDB();
  const now = new Date().toISOString();
  for (const r of rivals) {
    db.execute(
      `INSERT OR REPLACE INTO rival_states
       (id, seed_hash, floor, rep, profile, memory, last_cycle, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `${seedHash}_${r.name}`,
        seedHash,
        r.floor,
        r.rep ?? 0,
        JSON.stringify(r.profile ?? {}),
        JSON.stringify(r.memory ?? {}),
        cycle,
        now,
      ],
    );
  }
}

export function loadRivals(seedHash: string): PersistedRival[] {
  const db = getDB();
  const rows = db.execute(
    'SELECT * FROM rival_states WHERE seed_hash = ? ORDER BY floor ASC',
    [seedHash],
  ).rows;
  return rows.map(r => ({
    id: r.id as string,
    seedHash: r.seed_hash as string,
    floor: r.floor as number,
    rep: r.rep as number,
    profile: JSON.parse(r.profile as string),
    memory: JSON.parse(r.memory as string),
    lastCycle: r.last_cycle as number,
  }));
}
```

**Paso 3 — Conectar en gameStore.ts**

```typescript
import { saveRivals } from '../database/rivalRepository';

advanceToVillage: async () => {
  // ... código existente ...
  const simResult = await simulateWorld(activeGame.seedHash, newCycle, activeGame);

  // ✅ NUEVO: persistir rivals con memoria actualizada
  saveRivals(activeGame.seedHash, simResult.updatedRivals, newCycle);

  const updates = { /* igual que antes */ };
  updateSavedGame(activeGame.id, updates);
},
```

**Paso 4 — Cargar rivals persistidos en simulateWorld**

En `worldSimulator.ts`, al inicio de `simulateWorld()`, intentar cargar rivales previos antes de generarlos:

```typescript
import { loadRivals } from '../database/rivalRepository';

export async function simulateWorld(...) {
  const { generateRivals } = await import('./rivalGenerator');
  
  // Intentar cargar estado previo; si no existe, generar frescos
  const persistedRivals = loadRivals(seedHash);
  const rivals = persistedRivals.length > 0
    ? persistedRivals.map(p => ({ ...p, name: p.id.replace(`${seedHash}_`, '') }))
    : generateRivals(seedHash, floor, cycle);
  
  // ... resto igual
}
```

**Checklist de verificación:**
- [ ] `CURRENT_VERSION` en migrations.ts subido a 14
- [ ] `rival_states` table aparece en SQLite inspector tras upgrade
- [ ] Tras `advanceToVillage`, `loadRivals(seedHash)` devuelve los mismos rivales que `simResult.updatedRivals`
- [ ] Segunda simulación usa los rivales guardados (perfil/memoria persistida)

---

## GAP-02 🔴 — checkForAbandonment nunca se llama

### ¿Por qué importa?
`moralSystem.ts` implementa un sistema completo: `applyMoralEvent` reduce la moral, y `checkForAbandonment` evalúa si personajes con moral < 20 abandonan la party. Si nunca se llama el check, los personajes nunca abandonan. El gameplay loop de "recuperar moral para evitar deserciones" queda roto.

### Dónde está el problema
**Archivo:** `src/screens/BattleScreen.tsx`

`applyMoralEvent` sí se llama (correcto), pero `checkForAbandonment` no. Hay que llamarlo después de cada combate donde la moral puede caer bajo el umbral.

### Pasos para resolverlo

**Paso 1 — Importar la función** (ya existe, solo añadir al import)

```typescript
// BattleScreen.tsx — línea 42
import {
  applyMoralEvent,
  checkForAbandonment,   // ← añadir
  generateReplacementAdventurer, // ← añadir para el reemplazo
} from '../services/moralSystem';
```

**Paso 2 — Llamar el check después de combate con moral reducida**

Después de la línea donde se llama `applyMoralEvent('DEFEAT_IN_COMBAT')` o `'PARTY_MEMBER_DIED'`, agregar:

```typescript
// Tras applyMoralEvent en la ruta de derrota/muerte (~línea 575)
const postMoralParty = applyMoralEvent(updatedParty, 'DEFEAT_IN_COMBAT');

// ✅ NUEVO: verificar abandonos
const abandonResult = checkForAbandonment(
  postMoralParty,
  seedHash,    // del store: activeGame.seedHash
  activeCycle, // del store: activeGame.cycle
);

let finalParty = abandonResult.remained;

// Generar reemplazos para cada desertor
for (const deserter of abandonResult.abandoned) {
  const replacement = generateReplacementAdventurer(deserter, activeCycle);
  finalParty = [...finalParty, replacement];
  // Mostrar alert o log al jugador
  console.log(abandonResult.log.join('\n'));
}

updatedParty = finalParty;
```

**Paso 3 — Notificar al jugador**

El jugador necesita saber que un personaje abandonó. Agregar un Alert o un evento en el NarrativeMomentPanel:

```typescript
if (abandonResult.abandoned.length > 0) {
  Alert.alert(
    lang === 'es' ? '⚠ DESERCIÓN' : '⚠ DESERTION',
    abandonResult.log.join('\n'),
    [{ text: 'OK' }],
  );
}
```

**Checklist de verificación:**
- [ ] Con un personaje con `morale < 20` y alignment `LAWFUL_GOOD`, derrotar en combate dispara la deserción
- [ ] El reemplazo aparece en la party con `level = floor(nivel_desertor × 0.7)` y stats neutros
- [ ] El jugador ve el Alert de deserción
- [ ] El personaje desertor desaparece del HUD de party

---

## GAP-03 🟠 — SECRET_BOSS_CONDITIONS definido pero no evaluado

### ¿Por qué importa?
`monsterEvolutionService.ts` tiene condiciones para bosses secretos (ej: matar 50 goblins desbloquea un boss de raid). Es una mecánica de progresión que el jugador nunca experimentará si no se evalúa.

### Dónde está el problema
`SECRET_BOSS_CONDITIONS` se exporta desde `monsterEvolutionService` pero ningún servicio o pantalla lo consume para verificar si el jugador cumple las condiciones.

### Pasos para resolverlo

**Paso 1 — Leer las condiciones definidas**

```typescript
// monsterEvolutionService.ts ~línea 340
export const SECRET_BOSS_CONDITIONS: SecretBossCondition[] = [...]
```

**Paso 2 — Añadir función `checkSecretBossUnlock`**

En `monsterEvolutionService.ts`, agregar:

```typescript
/**
 * Dado el historial de kills de la party, devuelve el primer boss secreto
 * cuya condición se cumple. Null si ninguno.
 */
export function checkSecretBossUnlock(
  killRecords: KillRecord[],
): SecretBossCondition | null {
  return SECRET_BOSS_CONDITIONS.find(cond => {
    const count = getKillCount(killRecords, cond.requiredMonsterType);
    return count >= cond.requiredKills;
  }) ?? null;
}
```

**Paso 3 — Evaluar en encounterService al entrar a sala BOSS**

En `src/services/encounterService.ts`, dentro de la lógica que decide el tipo de encuentro al entrar a una sala BOSS:

```typescript
import { checkSecretBossUnlock } from './monsterEvolutionService';

// Antes de resolver el boss normal:
const secretBoss = checkSecretBossUnlock(activeGame.killRecords ?? []);
if (secretBoss && Math.random() < secretBoss.spawnChance) {
  // Sobreescribir el encuentro con el boss secreto
  return { type: 'SECRET_BOSS', bossKey: secretBoss.bossKey };
}
```

> **Nota:** Requiere que `killRecords` esté en `SavedGame`. Si no está, añadirlo como campo JSON en `gameRepository.ts` + migration 14.

**Checklist de verificación:**
- [ ] Con suficientes kills del tipo requerido, al entrar a sala BOSS aparece el boss secreto
- [ ] El boss secreto usa stats de `getEvolvedMonster(bossKey, cycle, floor)` escalados correctamente
- [ ] El boss secreto otorga loot/esencias diferencial vs boss normal

---

## GAP-04 🔴 — advanceCycle llama simulateWorld en cada acción, y simula desde ciclo 1

### ¿Por qué importa?
Hay dos problemas relacionados que se encontraron revisando el código real:

**Problema A — simulateWorld corre en cada acción sin excepción**

`advanceCycle()` en `gameStore.ts` llama `simulateWorld` después de **cualquier acción** — MOVE, SEARCH, REST_SHORT, REST_LONG — sin verificar si el ciclo entero cambió. Un `REST_SHORT` (0.5 ciclos) dispara la simulación completa igual que un MOVE.

```typescript
// gameStore.ts ~línea 168 — ESTADO ACTUAL
const { newCycleRaw, newCycle } = advanceTime(activeGame.cycleRaw ?? activeGame.cycle, action);
const simResult = await simulateWorld(activeGame.seedHash, newCycle, activeGame);
// ❌ simulateWorld siempre se llama — no hay guard de "¿cruzó un ciclo entero?"
```

**Problema B — simulateWorld simula desde ciclo 1, no desde el ciclo anterior**

En `worldSimulator.ts`, el loop interno es `for (let cycle = 1; cycle <= targetCycle; cycle++)`. Cada llamada re-simula todos los ciclos desde el inicio. Con un jugador en ciclo 30, cada acción dispara 30 iteraciones del motor IA completo.

El guard de 100ms (`MAX_TOTAL_TIME_MS`) trunca la simulación pero deja el resultado incompleto, y se descarta en el siguiente `advanceCycle`.

### Pasos para resolverlo

**Paso 1 — Guard de cruce de entero en advanceCycle**

```typescript
// gameStore.ts — advanceCycle
advanceCycle: async (action) => {
  const { activeGame } = get();
  if (!activeGame) return;

  const { advanceTime } = await import('../services/timeService');
  const { newCycleRaw, newCycle } = advanceTime(
    activeGame.cycleRaw ?? activeGame.cycle, action
  );

  // ✅ NUEVO: solo simular si el ciclo entero cambió
  const prevCycleInt = Math.floor(activeGame.cycleRaw ?? activeGame.cycle);
  const newCycleInt  = Math.floor(newCycleRaw);

  let simResult = { events: [] as SimulationEvent[], updatedRivals: [] };
  if (newCycleInt !== prevCycleInt) {
    const { simulateWorld } = await import('../services/worldSimulator');
    simResult = await simulateWorld(activeGame.seedHash, newCycleInt, activeGame);
    saveRivals(activeGame.seedHash, simResult.updatedRivals, newCycleInt); // GAP-01
  }

  const updates = {
    cycleRaw: newCycleRaw,
    cycle: newCycleInt,
    ...(simResult.events.length > 0 && {
      lastSimEvents: JSON.stringify(simResult.events),
      lastActionAt: new Date().toISOString(),
    }),
  };

  updateSavedGame(activeGame.id, updates as Parameters<typeof updateSavedGame>[1]);
  set({
    activeGame: { ...activeGame, ...updates, updatedAt: new Date().toISOString() },
    ...(simResult.events.length > 0 && { lastSimulationEvents: simResult.events }),
  });
},
```

**Paso 2 — Simular solo ciclos nuevos, no desde el inicio**

Añadir `fromCycle` como parámetro a `simulateWorld`:

```typescript
// worldSimulator.ts — signature
export async function simulateWorld(
  seedHash: string,
  targetCycle: number,
  activeGame: SavedGame,
  fromCycle?: number,   // ← nuevo parámetro opcional
): Promise<SimulationResult> {
  // ...
  const startCycle = fromCycle ?? 1;
  for (let cycle = startCycle; cycle <= targetCycle; cycle++) {
    // ...
  }
}
```

```typescript
// gameStore.ts — pasar fromCycle
simResult = await simulateWorld(
  activeGame.seedHash,
  newCycleInt,
  activeGame,
  prevCycleInt + 1,  // solo simular los ciclos nuevos
);
```

**Checklist de verificación:**
- [ ] Un `REST_SHORT` solitario (3.5 → 4.0) NO dispara `simulateWorld`
- [ ] Dos `REST_SHORT` (3.0 → 3.5 → 4.0) — el segundo sí dispara `simulateWorld`
- [ ] `simulateWorld` con `fromCycle=5, targetCycle=6` solo itera 2 ciclos, no 6
- [ ] El WorldLog de `SimulationLoadingScreen` sigue recibiendo eventos correctamente

---

## Riesgos de diseño (mitigaciones pendientes)

Estos no son bugs de implementación sino mecánicas que necesitan caps/guards antes del lanzamiento.

### RI-01 🔴 Cap de esencias en unificación
**Contexto:** Un jugador puede unificar dos seeds con esencias rank 3+ y entrar al mid-game con la party completamente equipada.
**Mitigación a implementar:** En `seedUnificationService.ts`, al construir la nueva party, limitar a máximo 1 esencia de rank ≤ 3 por personaje heredada de la party anterior.

### RI-02 🔴 Party IA monopolista elimina todas las demás
**Contexto:** Una party AGGRESSIVE con VENDETTA puede vaciar la Torre en 20 ciclos.
**Verificar en `worldSimulator.ts`:**
- Que tras 1 eliminación PvP, la party entra en 5 ciclos DEFENSIVE obligatorios
- Que si `activeParties < 3`, se spawna automáticamente una `SYSTEM` party

### RI-07 🟡 Flag `justRevived` para combo Fénix+Tiempo
**Contexto:** Fénix (revivir al morir) + Tiempo (reacción extra) = inmortalidad práctica.
**Mitigación:** En `combatEngine.ts`, añadir `justRevived: boolean` al estado de combate. Si `justRevived === true`, bloquear uso de habilidades activas en ese turno.

### RI-08 🟡 Cooldown en NarrativeMomentPanel
**Verificar en `NarrativeMomentPanel.tsx`:** Que existe un cooldown de ≥2 rondas entre eventos del mismo tipo, y un máximo de 3 paneles por combate.

---

## Orden de implementación recomendado

```
GAP-04 (advanceCycle guard + fromCycle) — 3-4 horas — performance crítica
  Razón: actualmente simulateWorld corre en cada MOVE, cada SEARCH,
  cada REST_SHORT. En ciclo 30 eso son 30 iteraciones del motor IA
  por cada paso del jugador. Es el problema más urgente.
  ↓
GAP-02 (checkForAbandonment) — 2-3 horas — impacto gameplay inmediato
  ↓
GAP-01 (rival persistence) — 1 día — requiere migration + nuevo repo
  Nota: combinar con GAP-04 porque saveRivals se llama en advanceCycle
  ↓
RI-02 (party monopolista) — 4-6 horas — verificar guards en worldSimulator
  ↓
RI-01 (cap esencias unificación) — 2-3 horas — lógica en seedUnificationService
  ↓
GAP-03 (secret boss) — 4-6 horas — requiere killRecords en SavedGame
  ↓
RI-07 (justRevived flag) — 2 horas — cambio en combatEngine
  ↓
RI-08 (panel cooldown) — 1-2 horas — estado en NarrativeMomentPanel
```
