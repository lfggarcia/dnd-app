# TORRE — Guía de Best Practices y Performance
> Basada en `PERFORMANCE_TASKS.md` + `plan/RIESGOS_Y_MEJORAS.md` · Versión 2.0 · 2026-03-11
> Para el equipo: cada sección incluye el **por qué** técnico antes del **cómo**.

---

## Estado de performance actual

Las optimizaciones de `PERFORMANCE_TASKS.md` están **todas completadas** (marcadas `[x]`). Los servicios centrales (`prng.ts`, `timeService.ts`, `worldSimulator.ts`, migrations v7–v12, `gameRepository.ts`) están implementados y funcionales.

Esta guía documenta:
1. **Riesgos técnicos activos** con su estado actual y mitigación pendiente
2. **Deudas técnicas** que deben resolverse antes de Sprint 7
3. **Reglas de arquitectura** para mantener la calidad durante el desarrollo futuro
4. **Targets de performance** con benchmarks obligatorios

---

---

# PARTE 1 — RIESGOS TÉCNICOS ACTIVOS

> Ordenados por criticidad. Los 🔴 bloquean el lanzamiento si no se resuelven.

---

## [RT-01] 🔴 worldSimulator — Cuello de botella de performance

**Descripción:** Con 10 parties × 60 ciclos × lógica de memoria (Sprint 7), el simulador puede superar 200ms en dispositivos de gama baja.

**Estado actual:** La implementación base incluye un guard de 100ms (`MAX_TOTAL_TIME_MS = 100`) que corta la simulación si se supera. Sin embargo, con memoria IA activa (Sprint 7), el tiempo por ciclo puede multiplicarse y el guard puede cortar demasiado pronto, dejando eventos incompletos.

**Por qué es el riesgo más crítico:** El simulador se llama en el hilo JS principal. Cualquier freeze > 100ms es visible al jugador como lag en la pantalla.

**Mitigación implementada parcialmente:**
- Guard de tiempo en `worldSimulator.ts` ✅
- Simulación asíncrona con `await` en gameStore ✅

**Mitigación pendiente (Sprint 7):**

Benchmark test obligatorio antes de merge de Sprint 7:

```typescript
// __tests__/worldSimulator.perf.test.ts — ya existe, verificar que pasa
it('simula 60 ciclos × 10 parties en < 200ms con memoria', async () => {
  const start = Date.now();
  await simulateWorld(seedHash, 60, mockGame);
  expect(Date.now() - start).toBeLessThan(200);
});
```

Si el benchmark falla → mover `simulateWorld()` a un Web Worker o usar `InteractionManager.runAfterInteractions()`:

```typescript
// En gameStore.advanceCycle():
import { InteractionManager } from 'react-native';

await new Promise<void>(resolve => {
  InteractionManager.runAfterInteractions(async () => {
    const simResult = await simulateWorld(...);
    // ... actualizar estado
    resolve();
  });
});
```

**Target:** < 100ms para simulación base. < 200ms para simulación con memoria IA.

---

## [RT-02] 🔴 Colisiones PRNG entre servicios

**Descripción:** Con la PRNG compartida (`prng.ts`), dos servicios que usen el mismo string de semilla producirán valores idénticos. Esto crea correlaciones no deseadas: el loot podría caer siempre junto con las emboscadas, o los drops de esencia coincidir siempre con el morale bajo.

**Estado actual:** Cada servicio usa prefijos distintos correctamente:
- `${seedHash}_combat_...` — combatEngine
- `${seedHash}_loot_...` — lootService
- `${seedHash}_moral_...` — moralSystem
- `${seedHash}_encounter_...` — encounterService
- `${seedHash}_world_...` — worldSimulator
- `${seedHash}_profile_...` — worldSimulator/aiProfileEngine

**Mitigación pendiente (Sprint 7):** Al crear servicios nuevos (`essenceService`, `culturalEvolution`), verificar que usen prefijos únicos:
- `${seedHash}_essence_drop_...` — essenceService
- `${seedHash}_cultural_...` — culturalEvolution

**Test de no-colisión (ejecutar en cada nuevo servicio):**

```typescript
it('PRNG con prefijos distintos produce valores distintos', () => {
  const a = makePRNG('SEED_loot_room1').float();
  const b = makePRNG('SEED_combat_room1').float();
  const c = makePRNG('SEED_essence_drop_room1').float();
  expect(a).not.toBe(b);
  expect(b).not.toBe(c);
  expect(a).not.toBe(c);
});
```

---

## [RT-03] 🟠 Corrupción de migrations

**Descripción:** Con 13 versiones de migration, un error en v8+ ejecutado sobre v7 puede dejar la DB en estado inconsistente.

**Estado actual:** Las migrations v7–v12 están correctamente envueltas en `BEGIN TRANSACTION / COMMIT / ROLLBACK` ✅.

**Mitigación pendiente:** Al añadir migration v13, verificar el mismo patrón:

```typescript
db.executeSync('BEGIN TRANSACTION');
try {
  for (const sql of migrations[13]) {
    db.executeSync(sql);
  }
  db.executeSync('INSERT INTO schema_version (version) VALUES (?)', [13]);
  db.executeSync('COMMIT');
} catch (error) {
  db.executeSync('ROLLBACK');
  throw error;
}
```

**Test obligatorio (ya existe como base en `__tests__/migrations.test.ts`):**
- [ ] Ejecutar migrations desde v1 hasta v13 en DB limpia → schema final correcto
- [ ] Ejecutar migrations desde v12 hasta v13 → sin errores ni duplicados
- [ ] Ejecutar migrations dos veces → idempotente (gracias a `IF NOT EXISTS`)

---

## [RT-04] 🟠 Desync entre PvP y worldSimulator

**Descripción:** El jugador puede eliminar una party IA en combate PvP, pero `worldSimulator.ts` la genera cada vez desde `generateRivals()` (en memoria, no desde DB). No existe una tabla `rivals` en DB. En el siguiente ciclo, la party "eliminada" seguirá apareciendo en el WorldLog.

**Estado actual:** `worldSimulator.ts` llama `generateRivals()` al inicio de cada simulación, lo que sobrescribe cualquier estado anterior de rivals. Las parties marcadas como `status: 'defeated'` en el resultado no se persisten a ningún lado.

**Por qué es importante:** El WorldLog mostrará eventos de parties que el jugador ya eliminó, rompiendo la consistencia narrativa.

**Dos opciones de mitigación:**

**Opción A (recomendada — menor deuda):** Crear tabla `rivals` en DB (migration v14 post-Sprint 7) y cargar desde ahí en `simulateWorld()`. Al eliminar una party en PvP, hacer `UPDATE rivals SET status = 'defeated'` inmediatamente.

**Opción B (parche temporal):** Mantener una lista de `defeatedRivalNames` en el gameStore en memoria, y filtrarla al inicio de `simulateWorld()`:

```typescript
// En gameStore:
defeatedRivalNames: string[]
addDefeatedRival: (name: string) => void

// En worldSimulator.ts:
const rivals = generateRivals(...).filter(r => !defeatedRivalNames.includes(r.name));
```

**Target:** Al eliminar una party en BattleScreen, esa party NO debe aparecer en eventos posteriores del WorldLog.

---

## [RT-05] 🟠 Dependencias circulares entre servicios

**Descripción:** La dirección de importaciones debe ser: `utils/prng` ← `types/` ← `services/` ← `database/` ← `stores/` ← `screens/`. Cualquier violación de esta dirección puede crear ciclos que crashean en runtime.

**Estado actual:** La dirección se respeta actualmente. El riesgo aumenta en Sprint 7 cuando `essenceService` necesite datos de `essenceRepository`, y `worldSimulator` use `aiProfileEngine` y `aiMemoryService`.

**Regla estricta:** `database/*` **nunca** importa de `services/*`. Si hay que compartir tipos entre capas, definirlos en `src/types/` o en `gameRepository.ts`.

**Verificación:**
```bash
# Nunca debe encontrar nada:
grep -r "from '../services/" src/database/
grep -r "from '../../services/" src/database/
```

---

## [RT-06] 🟠 Race condition en loot de boss

**Descripción:** Si el jugador obtiene el loot único del boss y la app cierra antes de que `claimed = 1` se persista, puede obtenerlo dos veces en el siguiente run.

**Estado actual:** `lootService.generateBossUniqueLoot()` llama `isBossLootClaimed()` correctamente antes de generar. `ReportScreen.tsx` llama `createItem()` al recibir el loot.

**Mitigación pendiente:** Verificar que `createItem()` en `itemRepository` usa `claimed = 1` en la inserción inicial y que la inserción es atómica:

```typescript
// En itemRepository.createItem() — verificar que NO usa dos operaciones separadas:
db.executeSync('BEGIN TRANSACTION');
db.executeSync(
  `INSERT INTO items (id, ..., claimed) VALUES (?, ..., 1)`,
  [id, ...],
);
db.executeSync('COMMIT');
```

**Target:** Ejecutar 2 combates de boss con el mismo `bossRoomId` → el segundo `generateBossUniqueLoot()` retorna `null`.

---

## [RT-07] 🟡 Desync de fase día/noche

**Descripción:** `cycle_raw` puede estar en 3.5 mientras `cycle` entero está en 3. Si `cycleRaw` no se persiste correctamente (ver FIX-01 en GUIA_COMPLETAR_PROYECTO), al reanudar el juego el ciclo puede estar incorrecto.

**Estado actual:** Este riesgo está **activado** por el bug FIX-01 (`updateSavedGame` no persiste `cycleRaw`). Hasta que FIX-01 se resuelva, la fase puede desyncroniarse.

**Mitigación:** FIX-01 es la solución directa. Una vez resuelto:
- Al cargar el save: `cycle = Math.floor(cycleRaw)` — nunca leer el campo `cycle` directamente
- `rowToSavedGame()` ya hace esto correctamente: `cycleRaw: row.cycle_raw ?? row.cycle`

---

## [RT-08] 🟡 Seeds de baja entropía

**Estado actual:** ✅ RESUELTO — `SeedScreen.tsx` implementa la validación completa:
- Mínimo 4 caracteres
- Solo ASCII imprimible
- Mínimo 2 caracteres únicos

**Verificación:**
```bash
grep -n "uniqueChars\|ASCII\|minLength" src/screens/SeedScreen.tsx
```

---

## [RT-09] 🟡 Esencias duplicadas en DB

**Estado actual:** El riesgo existirá cuando se implemente Sprint 7 (drops de esencia). La mitigación está diseñada desde el principio.

**Mitigación en `essenceRepository.saveEssenceDrop()`:**

```typescript
// ID canónico — determinístico por seed:
const id = `${seedHash}_essence_${definitionId}_${cycle}_${floor}`;

// INSERT OR IGNORE — silencioso ante duplicados:
db.executeSync(
  `INSERT OR IGNORE INTO essences (id, ...) VALUES (?, ...)`,
  [id, ...],
);
```

**NUNCA** generar el ID con `Date.now()` o `Math.random()` para esencias — rompería la idempotencia.

---

---

# PARTE 2 — DEUDAS TÉCNICAS ACTIVAS

| ID | Descripción | Archivo | Prioridad | Sprint |
|----|-------------|---------|-----------|--------|
| DT-01 | `dungeonGraphService.ts` define `makePRNG` inline | `src/services/dungeonGraphService.ts` | 🔴 Alta | Antes de Sprint 7 |
| DT-02 | `updateSavedGame` no persiste `cycleRaw`, `lastActionAt`, `lastSimEvents` (FIX-01) | `src/database/gameRepository.ts` | 🔴 Alta | Inmediato |
| DT-03 | `checkForAbandonment()` no llamado en game loop (FIX-03) | `src/screens/CampScreen.tsx` | 🟠 Media | Antes de Sprint 7 |
| DT-04 | `recordPartyKill()` no llamado al eliminar rival (FIX-04) | `src/screens/BattleScreen.tsx` | 🟠 Media | Antes de Sprint 7 |
| DT-05 | `seedUnificationService.ts` no existe | `src/services/` | 🟠 Media | Sprint 6G |
| DT-06 | CampScreen falta tab INVENTORY | `src/screens/CampScreen.tsx` | 🟡 Baja | Sprint 6E cierre |
| DT-07 | CharacterDetailScreen falta tab ESENCIAS | `src/screens/CharacterDetailScreen.tsx` | 🟡 Baja | Sprint 7 |
| DT-08 | worldSimulator no persiste estados de rivals (RT-04) | `src/services/worldSimulator.ts` | 🟡 Baja | Sprint 7 o post |

---

---

# PARTE 3 — REGLAS DE ARQUITECTURA

> Estas reglas aplican a TODO el código nuevo. No son sugerencias.

## A1 — Funciones puras en servicios

Los servicios exportan funciones puras. **Prohibido** llamar `useGameStore.getState()` dentro de un servicio.

```typescript
// ❌ MAL:
export function calculateReviveCost() {
  const gold = useGameStore.getState().activeGame?.gold; // No hacer esto
}

// ✅ BIEN:
export function calculateReviveCost(char: CharacterEconomyState, currentGold: number) {
  // ... función pura
}
```

## A2 — Múltiples escrituras DB en transacción

Cualquier operación que requiera más de un `executeSync` relacionados va en transacción:

```typescript
db.executeSync('BEGIN TRANSACTION');
try {
  db.executeSync('INSERT INTO items ...', [...]);
  db.executeSync('UPDATE saved_games SET ...', [...]);
  db.executeSync('COMMIT');
} catch (e) {
  db.executeSync('ROLLBACK');
  throw e;
}
```

## A3 — Barrel exports actualizados en cada sprint

Después de crear cualquier servicio nuevo:
- Añadir a `src/services/index.ts`
- Si es un repository, añadir a `src/database/index.ts`

## A4 — Selectores Zustand granulares

```typescript
// ❌ MAL — re-render en cualquier cambio al activeGame:
const game = useGameStore(s => s.activeGame);
const gold = game?.gold;

// ✅ BIEN — re-render solo cuando cambia gold:
const gold = useGameStore(s => s.activeGame?.gold ?? 0);
```

## A5 — useCallback y useMemo con dependencias exactas

```typescript
// ❌ MAL:
const handler = useCallback(() => { ... }, []); // sin dep → closure stale

// ✅ BIEN:
const handler = useCallback(() => {
  doSomethingWith(gold, partyData);
}, [gold, partyData]); // deps exactas
```

## A6 — Tipos compartidos en `src/types/` o `gameRepository.ts`

Si un tipo necesita ser importado por más de 2 servicios independientes, sacarlo a `src/types/`. Nunca crear tipos de datos core dentro de un servicio que otro servicio también necesite importar.

## A7 — Console.log solo bajo `__DEV__`

```typescript
// ❌ MAL en producción:
console.log('combat result:', result);

// ✅ BIEN:
if (__DEV__) console.log('combat result:', result);
```

---

---

# PARTE 4 — TARGETS DE PERFORMANCE

## Benchmarks obligatorios antes de merge de Sprint 7

| Operación | Target | Test |
|-----------|--------|------|
| `simulateWorld(60 ciclos, 10 parties)` base | < 100ms | `worldSimulator.perf.test.ts` |
| `simulateWorld(60 ciclos, 10 parties)` con memoria IA | < 200ms | Añadir al mismo test |
| Migrations v1 → v13 en dispositivo real (primera instalación) | < 500ms | `migrations.test.ts` |
| `CampScreen` render inicial (3 tabs + party de 4) | < 16ms (60fps) | Profiler RN |
| Essence drop + saveEssenceDrop() | < 20ms | `essenceService.test.ts` |
| `CharacterDetailScreen` abrir tab ESENCIAS con 10 esencias | < 16ms | Profiler RN |

## Guía para medir performance en React Native

```typescript
// Para medir cualquier operación síncrona:
const start = performance.now();
const result = someExpensiveOperation();
const elapsed = performance.now() - start;
if (__DEV__ && elapsed > 16) {
  console.warn(`[PERF] someExpensiveOperation tomó ${elapsed.toFixed(1)}ms`);
}
```

Para medir renders: usar React DevTools Profiler en Flipper.

---

---

# PARTE 5 — PRIORIDADES DE TESTING

## Tests existentes (verificar que siguen pasando)

| Archivo | Cubre |
|---------|-------|
| `__tests__/prng.test.ts` | Determinismo PRNG, no-colisión entre prefijos |
| `__tests__/combatEngine.test.ts` | Motor de combate DnD 5e |
| `__tests__/worldSimulator.perf.test.ts` | Benchmark de performance |
| `__tests__/economyService.test.ts` | Fórmulas de economía |
| `__tests__/lootService.test.ts` | Generación de loot determinístico |
| `__tests__/progressionService.test.ts` | XP, niveles, herencia |
| `__tests__/migrations.test.ts` | Schema final correcto tras v1→v12 |
| `__tests__/NarrativeMomentPanel.test.ts` | Render + auto-dismiss |
| `__tests__/CampScreen.test.ts` | Tabs, descanso, level-up |
| `__tests__/navigation.test.tsx` | Happy path Map → Battle → Report → Map |

## Tests a crear en Sprint 7 (por prioridad)

1. `essenceRepository.test.ts` — INSERT OR IGNORE idempotente, slots respetados
2. `aiProfileEngine.test.ts` — 5 perfiles, mutación cultural
3. `culturalEvolution.test.ts` — fitness score, peer learning
4. `seedUnificationService.test.ts` — seed nueva vs existente, nivel heredado
5. `worldSimulator.perf.test.ts` (ampliar) — añadir test con memoria IA < 200ms
6. `migrations.test.ts` (ampliar) — añadir v13

## Prioridad de testing (de más a menos crítico)

`prng` > `worldSimulator (perf)` > `combatEngine` > `economyService` > `progressionService` > `lootService` > `migrations` > `essenceService` > `seedUnificationService` → componentes → navegación

---

---

# PARTE 6 — PRE-LAUNCH CHECKLIST TÉCNICO

## Obligatorio antes de release

- [ ] `grep -r "function makePRNG" src/` → 0 resultados (solo en `utils/prng.ts`)
- [ ] `updateSavedGame` persiste `cycleRaw`, `lastActionAt`, `lastSimEvents` (FIX-01)
- [ ] `checkForAbandonment()` llamado en descanso largo (CampScreen)
- [ ] `recordPartyKill()` llamado al eliminar rival en BattleScreen
- [ ] Migrations v7–v13 pasan desde DB limpia
- [ ] Benchmark worldSimulator < 100ms base, < 200ms con memoria IA
- [ ] Test colisión PRNG: prefijos distintos → floats distintos
- [ ] Boss loot no duplicado en run consecutivo del mismo seed
- [ ] Revive no puede ejecutarse si `gold < cost`
- [ ] `NarrativeMomentPanel` limitado a 3 por combate (`momentCountRef.current < 3`)
- [ ] Drop esencia legendaria ≤ 2% verificado en `essenceService.resolveEssenceDrop`
- [ ] worldSimulator salta parties con `status === 'defeated'`
- [ ] Seed existente en SeedScreen → UnificationScreen → nivel heredado aplicado
- [ ] `INSERT OR IGNORE` en `essenceRepository.saveEssenceDrop` — no hay duplicados
- [ ] `database/*` no importa de `services/*` (verificar con grep)
- [ ] `if (__DEV__)` en todos los `console.log`
- [ ] ErrorBoundary en `App.tsx` (Sprint 7 final)
