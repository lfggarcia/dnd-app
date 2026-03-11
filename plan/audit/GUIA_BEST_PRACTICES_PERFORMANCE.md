# TORRE — Guía de Best Practices y Performance
> Basada en `PERFORMANCE_TASKS.md` + `plan/RIESGOS_Y_MEJORAS.md` · Versión 1.0 · 2026-03-11
> Para el equipo: cada sección incluye el **por qué** técnico antes del **cómo**.

---

## Estado de performance actual

Las optimizaciones de la Primera y Segunda Ronda del `PERFORMANCE_TASKS.md` están **todas completadas** (marcadas `[x]`). Esta guía documenta:

1. Las optimizaciones que **quedan pendientes** para sistemas nuevos (Sprints 5–7)
2. **Riesgos técnicos activos** que el equipo debe conocer antes de implementar
3. **Reglas de arquitectura** para mantener la calidad durante el desarrollo futuro

---

---

# PARTE 1 — RIESGOS TÉCNICOS ACTIVOS

> Estos riesgos deben resolverse en el orden indicado. Ignorarlos puede causar crashes, pérdida de saves o comportamientos no determinísticos.

## [RT-01] 🔴 worldSimulator — Cuello de botella de performance

**Descripción del problema:**

El `worldSimulator` procesará 10 parties × 60 ciclos por cada avance de ciclo del jugador. En dispositivos de gama baja, esto puede superar los 200ms, causando un freeze visible en el hilo JS de React Native.

**Por qué es el riesgo más crítico:**

En React Native, el hilo JS es el mismo que maneja las animaciones y los gestos. Un bloqueo de 200ms no solo congela el UI — también cancela animaciones activas y puede causar que el sistema operativo reporte la app como "no responsiva".

**Paso 1 — Restricción de tiempo por ciclo:**

```typescript
// worldSimulator.ts — restricción de tiempo
const MAX_TIME_PER_CYCLE_MS = 5; // < 0.5ms por party, 10 parties
const MAX_TOTAL_TIME_MS = 100;   // límite total para 60 ciclos

export async function simulateWorld(
  seedHash: string,
  targetCycle: number,
  playerGame: SavedGame,
): Promise<SimulationResult> {
  const startTime = Date.now();

  // ... lógica de simulación ...

  // Checkpoint de tiempo en cada ciclo
  if (Date.now() - startTime > MAX_TOTAL_TIME_MS) {
    console.warn('[worldSimulator] Time limit reached, truncating simulation');
    break; // salir del bucle de ciclos
  }
}
```

**Paso 2 — Benchmark obligatorio antes de merge:**

```typescript
// __tests__/worldSimulator.perf.test.ts
it('10 parties × 60 ciclos < 100ms', async () => {
  const mockRivals = Array.from({ length: 10 }, (_, i) => createMockRival(i));
  const start = Date.now();
  await simulateWorld('BENCH_SEED', 60, mockPlayerGame);
  const elapsed = Date.now() - start;
  expect(elapsed).toBeLessThan(100);
  console.log(`[PERF] worldSimulator: ${elapsed}ms`);
});
```

**Paso 3 — Si el benchmark falla, mover a Web Worker:**

```typescript
// Si simulateWorld() > 100ms en mid-range device:
// Mover la lógica a un Web Worker usando react-native-workers o similar.
// La interfaz sería:
// worker.postMessage({ seedHash, targetCycle, playerGame });
// worker.onmessage = ({ data }) => { dispatch(setSimulationEvents(data.events)); };
```

**Regla de performance del simulador:**

```
No hacer queries de DB dentro del bucle de ciclos.
Cargar todos los rivals ANTES de los bucles con una sola query.
La DB solo se escribe DESPUÉS de que terminan todos los ciclos.
```

---

## [RT-02] 🔴 Colisiones PRNG entre servicios

**Descripción del problema:**

Si dos servicios usan el mismo string de semilla para `makePRNG()`, generan la misma secuencia de números. Esto produce correlaciones no deseadas: el loot siempre cae junto con las emboscadas, o los drops de esencia coinciden siempre con el moral bajo. El juego deja de sentirse aleatorio aunque sí lo sea.

**Por qué pasa:**

Con una sola semilla compartida (el `seedHash` de la partida), todos los servicios parten del mismo punto. Sin namespacing, el primer servicio en llamar `makePRNG(seedHash)` y el segundo obtienen la misma secuencia.

**Paso 1 — Protocolo de prefijos único por servicio:**

```typescript
// REGLA: nunca llamar makePRNG(seedHash) directamente en un servicio.
// SIEMPRE incluir el prefijo del servicio + contexto único.

// ❌ MAL — todos los servicios generan los mismos números:
const rng = makePRNG(seedHash);

// ✅ BIEN — cada servicio tiene su propio namespace:
// combatEngine.ts:
const rng = makePRNG(`${seedHash}_combat_${roomId}_${floor}`);
// lootService.ts:
const rng = makePRNG(`${seedHash}_loot_${roomId}_${floor}_${cycle}`);
// moralSystem.ts:
const rng = makePRNG(`${seedHash}_moral_${charName}_${cycle}`);
// bountyService.ts:
const rng = makePRNG(`${seedHash}_bounty_${gameId}_${cycle}`);
// worldSimulator.ts:
const rng = makePRNG(`${seedHash}_wsim_${partyName}_${cycle}`);
// essenceService.ts:
const rng = makePRNG(`${seedHash}_essence_${definitionId}_${cycle}_${floor}`);
```

**Paso 2 — Test de verificación:**

```typescript
// __tests__/prng.test.ts
it('prefijos distintos generan secuencias distintas', () => {
  const rng1 = makePRNG('SEED_combat_room1_1');
  const rng2 = makePRNG('SEED_loot_room1_1');
  expect(rng1.float()).not.toBe(rng2.float());
});

it('misma seed y prefijo siempre generan mismo resultado', () => {
  const rng1 = makePRNG('SEED_combat_room1_1');
  const rng2 = makePRNG('SEED_combat_room1_1');
  expect(rng1.float()).toBe(rng2.float()); // determinístico
});
```

**Tabla de prefijos canónicos — agregar al `prng.ts` como comentario:**

| Servicio | Prefijo |
|----------|---------|
| combatEngine | `${seedHash}_combat_${roomId}_${floor}` |
| lootService | `${seedHash}_loot_${roomId}_${floor}_${cycle}` |
| dungeonGraphService | `${seedHash}_dungeon_${floor}` |
| worldSimulator | `${seedHash}_wsim_${partyName}_${cycle}` |
| moralSystem | `${seedHash}_moral_${charName}_${cycle}` |
| bountyService | `${seedHash}_bounty_${gameId}_${cycle}` |
| essenceService | `${seedHash}_essence_${defId}_${cycle}_${floor}` |
| encounterService | `${seedHash}_encounter_${floor}_${cycle}` |
| allianceService | `${seedHash}_alliance_${partyA}_${partyB}` |
| safeZoneService | `${seedHash}_safezone_${floor}_${nodeId}` |

---

## [RT-03] 🟠 Corrupción de migrations

**Descripción del problema:**

Con 13 versiones de migration, un error en v8 que se ejecuta en un dispositivo con v7 puede dejar la DB en estado inconsistente (algunas tablas creadas, otras no). Esto causa crash en el siguiente arranque y potencialmente pérdida del save.

**Por qué es un riesgo real:**

SQLite en op-sqlite ejecuta las migrations secuencialmente. Si una sentencia de v8 falla a mitad, las sentencias anteriores de la misma versión ya se ejecutaron — sin rollback automático a menos que se haya abierto una transacción explícita.

**Paso 1 — Envolver cada versión en transacción:**

```typescript
// src/database/migrations.ts — patrón para CADA versión
async function runMigration(db: DB, version: number, statements: string[]): Promise<void> {
  try {
    await db.executeAsync('BEGIN TRANSACTION');
    for (const sql of statements) {
      await db.executeAsync(sql);
    }
    await db.executeAsync(`UPDATE db_version SET version = ${version}`);
    await db.executeAsync('COMMIT');
  } catch (error) {
    await db.executeAsync('ROLLBACK');
    throw new Error(`Migration v${version} failed: ${error}`);
  }
}
```

**Paso 2 — Test de migration completo:**

```typescript
// __tests__/migrations.test.ts
it('ejecuta migrations v1 → v13 desde DB limpia sin error', async () => {
  const db = await createInMemoryDB();
  await expect(runAllMigrations(db)).resolves.not.toThrow();

  // Verificar schema final
  const tables = await db.executeAsync("SELECT name FROM sqlite_master WHERE type='table'");
  expect(tableNames).toContain('items');
  expect(tableNames).toContain('events');
  expect(tableNames).toContain('bounties');
  expect(tableNames).toContain('alliances');
  expect(tableNames).toContain('essences');
  expect(tableNames).toContain('monster_kills');
});
```

**Paso 3 — Regla de migrations:**

```
NUNCA usar DROP TABLE en una migration.
SIEMPRE usar ALTER TABLE ADD COLUMN para añadir campos.
Si hay que renombrar una tabla: CREATE TABLE nueva → INSERT SELECT → DROP tabla vieja
(solo si hay datos de producción que migrar — pedir aprobación del equipo).
```

---

## [RT-04] 🟠 Desync de combate PvP vs worldSimulator

**Descripción del problema:**

Si el jugador elimina una party IA en combate PvP, pero el worldSimulator tiene esa party en su lista activa en memoria, el siguiente `simulateWorld()` la procesará como si existiera. Esto crea "fantasmas" en el WorldLog: parties que aparecen haciendo acciones después de ser eliminadas.

**Paso 1 — La DB es la fuente de verdad, siempre:**

```typescript
// worldSimulator.ts — CORRECTO: cargar desde DB al inicio
export async function simulateWorld(seedHash: string, targetCycle: number): Promise<SimulationResult> {
  // Carga fresh desde DB — no desde estado anterior en memoria
  const rivals = await getRivalsBySeed(seedHash, { status: 'active' }); // gameRepository
  // ...
}

// BattleScreen.tsx — al eliminar una party en PvP:
// Marcar como defeated en DB ANTES de navegar a ReportScreen
await updateGameStatus(rivalGameId, 'defeated'); // gameRepository
```

**Paso 2 — Query con filtro de status:**

```typescript
// gameRepository.ts
export function getRivalsBySeed(seedHash: string, filter?: { status?: string }): SavedGame[] {
  const whereClause = filter?.status ? `AND status = '${filter.status}'` : '';
  const result = db.executeSync(
    `SELECT * FROM saved_games WHERE seed_hash = ? ${whereClause}`,
    [seedHash]
  );
  return parseRows(result.rows);
}
```

---

## [RT-05] 🟠 Dependencias circulares entre servicios

**Descripción del problema:**

Al añadir 8+ servicios nuevos en Sprint 6, es fácil crear dependencias circulares sin darse cuenta. Por ejemplo: `encounterService` importa `bountyService`, `bountyService` importa `eventRepository`, `eventRepository` importa tipos de `worldSimulator`. Si `worldSimulator` importa de `encounterService`, hay un ciclo.

**El grafo de dependencias permitido:**

```
src/utils/prng.ts
    ↑
src/types/*.ts  (tipos compartidos sin lógica)
    ↑
src/services/*.ts  (lógica de negocio)
    ↑
src/database/*.ts  (acceso a datos)
    ↑
src/stores/*.ts    (estado global)
    ↑
src/screens/*.ts   (UI)
```

**Regla crítica:**

```
database/* NUNCA importa de services/*
services/* NUNCA importa de screens/* o stores/*
Si dos services necesitan compartir tipos → mover los tipos a src/types/
```

**Paso — Verificar antes de hacer merge:**

```bash
# Detectar ciclos con madge o similar:
npx madge --circular src/services/

# Si aparece algún ciclo → refactorizar tipos a src/types/ antes de mergear
```

---

## [RT-06] 🟠 Race condition en loot de boss

**Descripción del problema:**

Si el jugador derrota al boss y la app cierra (crash o background kill) DESPUÉS de mostrar el loot pero ANTES de guardar `claimed = 1`, en el siguiente run puede obtener el mismo item único dos veces.

**Paso 1 — Guardar en la misma transacción:**

```typescript
// itemRepository.ts — operación atómica
export function saveBossLootAtomic(item: LootDrop, gameId: string, seedHash: string): void {
  const db = getDB();
  // Transacción: INSERT item + marcar claimed en una sola operación
  db.executeSync('BEGIN TRANSACTION');
  try {
    db.executeSync(
      'INSERT OR IGNORE INTO items (id, seed_hash, ..., claimed) VALUES (?, ?, ..., 1)',
      [item.id, seedHash, ...]
    );
    db.executeSync('COMMIT');
  } catch {
    db.executeSync('ROLLBACK');
    throw new Error('Failed to save boss loot atomically');
  }
}
```

**Paso 2 — Verificar al inicio del combate de boss (no solo al final):**

```typescript
// BattleScreen.tsx — al cargar el combate de boss:
const bossLootAlreadyClaimed = isBossLootClaimed(seedHash, roomId); // lootService
// Si ya fue reclamado: no generar loot unique al terminar el combate
```

---

## [RT-07] 🟡 Desync de fase día/noche

**Descripción del problema:**

`cycle_raw` puede estar en 3.5 (después de un REST_SHORT) mientras el entero `cycle` está en 3. Si el app crashea en ese momento, al recuperar el save el ciclo puede estar equivocado dependiendo de qué campo se lea primero.

**Paso — Usar `cycle_raw` como fuente de verdad:**

```typescript
// gameRepository.ts — al cargar save:
export function loadGame(gameId: string): SavedGame {
  const raw = db.executeSync('SELECT * FROM saved_games WHERE id = ?', [gameId]);
  const data = raw.rows[0];
  return {
    ...data,
    // La fuente de verdad es cycle_raw, el entero se deriva siempre:
    cycle: Math.floor(data.cycle_raw ?? data.cycle ?? 1),
  };
}

// gameStore.ts — al guardar:
// Siempre guardar cycle_raw junto con cycle en updateProgress()
```

---

## [RT-08] 🟡 Seeds con baja entropía

**Descripción del problema:**

Seeds muy cortas ("A") o con caracteres repetidos ("AAAA") producen hashes djb2 con baja variación, creando colisiones: dos seeds distintas generan el mismo dungeon.

**Paso — Validación en SeedScreen (Sprint 5):**

```typescript
export function validateSeed(input: string): { valid: boolean; error?: string } {
  if (input.length < 4) {
    return { valid: false, error: 'Mínimo 4 caracteres' };
  }
  if (!/^[\x20-\x7E]+$/.test(input)) {
    return { valid: false, error: 'Solo caracteres ASCII imprimibles' };
  }
  // Detectar baja entropía (todos los caracteres iguales):
  const uniqueChars = new Set(input).size;
  if (uniqueChars < 2) {
    return { valid: false, error: 'La seed necesita más variedad de caracteres' };
  }
  return { valid: true };
}
```

---

---

# PARTE 2 — DEUDAS TÉCNICAS ACTIVAS

> Del documento `RIESGOS_Y_MEJORAS.md`. Ordenadas por prioridad.

## [DT-01] 🔴 `makePRNG` inline en 8+ servicios

**Estado:** Pendiente de resolver en Sprint 5A (primer bloque).

**Acción:**
```bash
# Verificar que no queda ninguna definición inline:
grep -rn "function makePRNG" src/
# Resultado esperado: 0 líneas
```

Ver `GUIA_COMPLETAR_PROYECTO.md → Sprint 5A` para el paso completo.

---

## [DT-02] 🔴 `CharacterSave` parcial en múltiples docs

**Estado:** Pendiente de resolver en Sprint 6A.

**Acción:** Añadir todos los campos nuevos al tipo canónico en `gameRepository.ts` ANTES de implementar los servicios que los usan. Ver la sección `CharacterSave canónico` en `plan/sprints/08_ARQUITECTURA_DATOS.md`.

**Verificación:**
```bash
# Buscar definiciones del tipo fuera de gameRepository:
grep -rn "type CharacterSave" src/
# Resultado esperado: solo 1 línea (en gameRepository.ts)
```

---

## [DT-05] 🟠 `nextCycle = 4` hardcodeado en CycleTransitionScreen

**Estado:** Pendiente de resolver en Sprint 5B.

**Buscar y eliminar:**
```bash
grep -rn "nextCycle = 4" src/
# Al encontrarlo: reemplazar por datos del store (ver GUIA_COMPLETAR_PROYECTO.md Sprint 5B)
```

---

## [DT-06] 🟠 Revivir gratis en VillageScreen

**Estado:** Pendiente de resolver en Sprint 6B.

**Buscar:**
```bash
grep -rn "reviveCharacter" src/screens/VillageScreen.tsx
# Verificar que la función descuenta oro y verifica suficiencia
```

---

---

# PARTE 3 — REGLAS DE ARQUITECTURA PARA NUEVOS SISTEMAS

## Regla A1 — Funciones puras en servicios

**Por qué:** Las funciones puras son determinísticas y testeables. Una función que recibe los mismos inputs siempre devuelve el mismo output — lo que es fundamental para el determinismo del juego.

**Cómo:**

```typescript
// ❌ MAL — función impura (tiene side effects):
export function reviveCharacter(charName: string): void {
  const store = useGameStore.getState(); // accede a estado global directamente
  store.updateProgress({ partyData: ... });
}

// ✅ BIEN — función pura (calcula y devuelve):
export function calculateReviveCost(char: CharacterEconomyState): ReviveCostResult {
  const cost = Math.round(REVIVE_BASE_COST * char.level * (1 + char.deathCount * 0.15));
  return { cost, breakdown: '...' };
}
// El screen/store llama a esta función y aplica el resultado
```

**Regla:** Los servicios calculan. Los stores aplican los cambios. Las screens disparan las acciones.

---

## Regla A2 — DB writes en transacción cuando hay múltiples operaciones

**Por qué:** Si se hacen 3 writes relacionados (guardar loot + actualizar cycle + marcar boss claimed) y el segundo falla, la DB queda en estado inconsistente. La transacción garantiza atomicidad: o todo funciona o nada.

**Cómo:**

```typescript
// ❌ MAL — tres writes independientes:
saveItem(lootDrop, gameId);
updateGameCycle(gameId, newCycle);
markBossClaimed(bossRoomId);

// ✅ BIEN — transacción atómica:
const db = getDB();
db.executeSync('BEGIN TRANSACTION');
try {
  db.executeSync('INSERT INTO items ...', [...]); 
  db.executeSync('UPDATE saved_games SET cycle = ? WHERE id = ?', [newCycle, gameId]);
  db.executeSync('UPDATE items SET claimed = 1 WHERE id = ?', [bossRoomId]);
  db.executeSync('COMMIT');
} catch (e) {
  db.executeSync('ROLLBACK');
  throw e;
}
```

---

## Regla A3 — Barrel exports para todos los módulos

**Por qué:** Sin barrel exports, un screen que necesita 5 servicios tiene 5 líneas de imports con paths relativos distintos, difíciles de mantener. Con barrels, cada capa tiene un único punto de entrada.

**Cómo — actualizar en cada sprint:**

```typescript
// src/services/index.ts — añadir cada nuevo servicio aquí:
export { makePRNG } from '../utils/prng';  // aunque está en utils, barrel conveniente
export { advanceTime, advanceCycle, CYCLE_COST } from './timeService';
export { simulateWorld, advanceCycleBatch } from './worldSimulator';
export { calculateReviveCost, REST_INN_COST } from './economyService';
export { generateRoomLoot, generateBossUniqueLoot } from './lootService';
export { getLevelFromXP, applyXP, MAX_LEVEL_MVP } from './progressionService';
// ... etc.

// En los screens:
import { calculateReviveCost, generateRoomLoot } from '../services';
// En lugar de:
import { calculateReviveCost } from '../services/economyService';
import { generateRoomLoot } from '../services/lootService';
```

---

## Regla A4 — Selectores granulares en Zustand

**Por qué:** `useGameStore(s => s.activeGame)` suscribe al objeto completo. Cualquier cambio en `activeGame` (aunque sea el campo `lastSimEvents` que el screen no usa) provoca un re-render completo del screen.

**Cómo:**

```typescript
// ❌ MAL — suscribe al objeto completo:
const activeGame = useGameStore(s => s.activeGame);
const gold = activeGame?.gold;
const cycle = activeGame?.cycle;

// ✅ BIEN — selectores granulares:
const gold = useGameStore(s => s.activeGame?.gold);
const cycle = useGameStore(s => s.activeGame?.cycle);
const seedHash = useGameStore(s => s.activeGame?.seedHash);

// El screen solo re-renderiza cuando cambia gold, cycle o seedHash —
// no cuando cambia partyPortrait, lastSimEvents, etc.
```

**Regla:** Siempre extraer el campo exacto que se necesita, no el objeto padre.

---

## Regla A5 — useCallback y useMemo con dependencias correctas

**Por qué:** Una función o valor sin memoizar crea una referencia nueva en cada render. Si esa función se pasa como prop a un componente con `React.memo`, el memo nunca evita el re-render porque la prop "cambió" (nueva referencia, mismo valor).

**Cómo:**

```typescript
// ❌ MAL — nueva referencia en cada render:
const handleRevive = (charName: string) => {
  // ... lógica
};

// ✅ BIEN — referencia estable mientras gold y partyData no cambien:
const handleRevive = useCallback((charName: string) => {
  const cost = reviveCosts[charName] ?? 999999;
  if (gold < cost) return;
  // ... lógica
}, [gold, partyData, reviveCosts, updateProgress]); // deps exactas

// ❌ MAL — recalcula en cada render:
const reviveCosts = partyData.filter(c => !c.alive).map(...);

// ✅ BIEN — recalcula solo cuando partyData cambia:
const reviveCosts = useMemo(() =>
  partyData.filter(c => !c.alive).reduce(...),
  [partyData]
);
```

**Regla para hooks con deps:** Poner exactamente las variables que se leen dentro del callback. Ni más (re-renders innecesarios) ni menos (closures obsoletos → bugs difíciles de debuggear).

---

## Regla A6 — Tipos compartidos en `src/types/`, no en services

**Por qué:** Si `CharacterSave` vive en `gameRepository.ts`, entonces `emotionalNarrativeService.ts` debe importar desde `database/gameRepository`, lo que viola la dirección de dependencias (services no deben importar de database para obtener tipos).

**Cómo:**

```typescript
// Mover tipos que cruzan capas a:
// src/types/character.ts
export type CharacterSave = { ... };

// src/types/simulation.ts
export type SimulationEvent = { ... };
export type AIProfile = { ... };

// Luego todos los services y repositories importan desde types/:
import type { CharacterSave } from '../types/character';
// En lugar de:
import type { CharacterSave } from '../database/gameRepository';
```

**Nota:** Esta refactorización es para Sprint 7 (mejora de arquitectura MA-02). En Sprint 5-6 mantener el patrón actual para no bloquear el desarrollo.

---

## Regla A7 — `console.log` solo en `__DEV__`

**Por qué:** En builds de producción, cada `console.log` serializa sus argumentos a string, lo que tiene costo de CPU. Con 15+ servicios cada uno con logs de debug, el overhead acumulado puede ser significativo en gama baja.

**Cómo:**

```typescript
// ❌ MAL — siempre ejecuta:
console.log('[worldSimulator] Simulating party', partyName, cycle);

// ✅ BIEN — solo en development:
if (__DEV__) {
  console.log('[worldSimulator] Simulating party', partyName, cycle);
}

// O crear un wrapper una vez:
// src/utils/logger.ts
export const log = (...args: unknown[]) => {
  if (__DEV__) console.log(...args);
};
```

**Regla:** Cada nuevo servicio en Sprint 5+ solo puede usar `if (__DEV__) console.log(...)`. Prohibido `console.log()` sin guardia en producción.

---

---

# PARTE 4 — MÉTRICAS DE PERFORMANCE OBJETIVO

> Estas métricas son los límites que el equipo debe respetar. Si alguna se supera, hay que optimizar antes de mergear.

| Operación | Límite | Cómo medir |
|-----------|--------|------------|
| `simulateWorld(60 ciclos, 10 parties)` | < 100ms | Jest + `Date.now()` |
| `simulateWorld` con memoria IA (Sprint 7) | < 200ms | Jest benchmark |
| Migration total (v1 → v13) | < 500ms en primer arranque | Log en `DatabaseGate` |
| Render de `CampScreen` (4 tabs cargados) | < 16ms (60fps) | Flipper Profiler |
| Drop de esencia + save a DB | < 20ms | Jest + `Date.now()` |
| `generateRoomLoot()` (función pura) | < 1ms | Jest benchmark |
| Carga de `GlossaryModal` (350 entries) | < 200ms | Flipper + FlatList `initialNumToRender` |

---

## Checklist pre-launch (del `RIESGOS_Y_MEJORAS.md`)

Antes de cada release, verificar:

- [ ] Todas las migrations v7–v13 ejecutan sin error desde DB limpia
- [ ] `grep -rn "function makePRNG" src/` devuelve 0 resultados
- [ ] `CharacterSave` definido solo en `gameRepository.ts` (1 definición)
- [ ] `simulateWorld(60)` < 100ms en iPhone 12 / Android mid-range
- [ ] Seeds "AAAA" y "BBBB" generan dungeons distintos (test de colisión)
- [ ] Boss loot no se duplica en 100 runs de la misma seed
- [ ] Revivir descuenta gold correctamente y rechaza si insuficiente
- [ ] `NarrativeMomentPanel` no aparece más de 3 veces por combate
- [ ] Esencia legendaria tiene drop rate real ≤ 2% en boss mayor
- [ ] `worldSimulator` no procesa parties con `status = 'defeated'`
- [ ] `grep -rn "console\.log" src/` — todos bajo guardia `__DEV__`

---

# PARTE 5 — MEJORAS DE ARQUITECTURA PROPUESTAS (Sprint 7)

> No urgentes pero importantes para mantener la base de código escalable.

## [MA-01] — Barrel exports limpios (Sprint 6)

Completar los barrels de los tres módulos principales:

```typescript
// src/services/index.ts   → todos los servicios nuevos de Sprint 6+
// src/database/index.ts   → todos los repositories nuevos
// src/utils/index.ts      → prng + futuros utilitarios
```

## [MA-02] — Tipos compartidos en `src/types/` (Sprint 7)

Mover `CharacterSave`, `SimulationEvent`, `AIProfile`, `CombatResult` a `src/types/`. Esto elimina la dirección de dependencia invertida entre services y database.

## [MA-03] — Separar `resolveCombat` en fases (Sprint 7)

El `combatEngine.ts` actual resuelve todo en un paso. Para el sistema de emociones (Sprint 4C) y las habilidades de esencia (Sprint 7), separar en:

```typescript
// Propuesta de refactor:
initCombat(party, enemies, roomId, floor, cycle): CombatState
resolveTurn(state: CombatState): { state: CombatState; events: CombatEvent[] }
buildCombatResult(state: CombatState): CombatResult

// Ventaja: cada vuelta de turno puede emitir eventos emocionales inmediatamente
// En lugar de procesar todos los turnos y solo entonces calcular eventos
```

---

# PARTE 6 — TESTING (Sprint 7)

**Estado actual:** Cobertura de tests ≈ 0% (solo 1 test de render básico en `App.test.tsx`).

## Orden de prioridad para escribir tests:

**Prioridad 1 — Lógica de negocio crítica:**

```typescript
// __tests__/prng.test.ts
// __tests__/worldSimulator.perf.test.ts  (benchmark)
// __tests__/combatEngine.test.ts
// __tests__/economyService.test.ts       (fórmulas de precios)
// __tests__/progressionService.test.ts   (tabla XP)
// __tests__/lootService.test.ts          (determinismo)
// __tests__/migrations.test.ts           (v1 → v13 desde DB limpia)
```

**Prioridad 2 — Componentes con lógica:**

```typescript
// __tests__/NarrativeMomentPanel.test.tsx
// __tests__/CampScreen.test.tsx
// __tests__/GlossaryModal.test.tsx
```

**Prioridad 3 — Navegación:**

```typescript
// __tests__/navigation.test.tsx  (happy path: Main → Seed → Party → Village → Map → Battle → Report → Map)
```

---

## Regla de tests para funciones puras:

```typescript
// Un test de función pura siempre sigue este patrón:
it('calcula costo de revivir nivel 3 con 2 muertes', () => {
  const result = calculateReviveCost({ level: 3, deathCount: 2, alive: false });
  // 100 × 3 × (1 + 2 × 0.15) = 100 × 3 × 1.30 = 390
  expect(result.cost).toBe(390);
  expect(result.breakdown).toContain('390G');
});

// Si el test falla → la fórmula está mal. Sin mocks, sin setup complejo.
```

---

# Resumen de reglas para el equipo

| Regla | ¿Cómo verificar? |
|-------|-----------------|
| `makePRNG` siempre importado desde `utils/prng` | `grep -rn "function makePRNG" src/` = 0 |
| Prefijos únicos por servicio en PRNG | Code review en PRs |
| Funciones puras en servicios | Sin `useGameStore.getState()` en services |
| Writes relacionados en transacción | Code review + test de crash recovery |
| Barrels actualizados en cada sprint | `grep -rn "from '../services/economyService'" src/screens/` = 0 |
| Selectores granulares Zustand | `grep -rn "s => s.activeGame\b" src/screens/` = 0 (sin `?.field`) |
| `console.log` solo bajo `__DEV__` | `grep -rn "console\.log" src/` verificar que todos tienen guardia |
| DB como fuente de verdad | worldSimulator carga desde DB, no desde estado en memoria |
| Migrations en transacción | Code review de `migrations.ts` |
| CharacterSave canónico | `grep -rn "type CharacterSave" src/` = 1 (solo en gameRepository) |
