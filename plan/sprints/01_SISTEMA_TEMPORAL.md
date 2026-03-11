# 01 · SISTEMA TEMPORAL Y NÚCLEO
> **Estado actual:** ~20% implementado — estructura DB existe, fase nunca cambia, simulación IA ausente
> **Sprint objetivo:** 5
> **Archivos a crear/modificar:** `gameStore.ts`, `gameRepository.ts`, `migrations.ts`, `CycleTransitionScreen.tsx`, nuevo `src/services/timeService.ts`, nuevo `src/services/worldSimulator.ts`
> **Cambios v2:** añadidas `SAFE_ZONE_WAIT` y `BATCH_SIMULATE` al tipo `TimeAction` (ver NI-05 en doc 00)

---

## Concepto

El tiempo es el recurso principal del juego. Cada acción del jugador consume ciclos. Cuando el jugador avanza ciclo, el mundo entero avanza: las parties IA se simulan hasta ese mismo punto. La Torre se cierra en el ciclo 60. Sin presión temporal, el juego pierde tensión estratégica.

---

## Estado Actual vs Objetivo

| Aspecto | Hoy | Objetivo |
|---------|-----|----------|
| `phase` (DAY/NIGHT) | Campo en DB, se muestra, nunca cambia | Alterna con cada acción que consume ciclo |
| `cycle` | Incrementa en ExtractionScreen | Incrementa por descanso, cambio de fase, acciones costosas |
| Simulación IA al avanzar | No existe | `simulateWorld(targetCycle)` se llama automáticamente |
| `CycleTransitionScreen` | `nextCycle = 4` hardcodeado | Lee `activeGame.cycle` real, muestra eventos reales |
| Espera en zona segura | No existe | `SAFE_ZONE_WAIT` simula ciclos restantes en lote |

---

## Paso 1 — Definir qué acciones consumen ciclos

Crear `src/services/timeService.ts`:

```typescript
/**
 * timeService.ts
 * Define el costo en ciclos de cada acción del jugador.
 * Todo avance de tiempo pasa por aquí — nunca mutamos cycle directo.
 *
 * IMPORTAR PRNG desde src/utils/prng.ts — no definir inline.
 */

export type TimeAction =
  | 'REST_SHORT'        // Descanso corto en dungeon           → 0.5 ciclos
  | 'REST_LONG'         // Descanso largo en posada            → 1 ciclo
  | 'EXPLORE_ROOM'      // Explorar una sala                   → 0 ciclos (gratis)
  | 'ENTER_DUNGEON'     // Entrar a la Torre                   → 0 ciclos
  | 'FLOOR_ADVANCE'     // Descender un piso                   → 0 ciclos
  | 'RETURN_VILLAGE'    // Volver al pueblo                    → 1 ciclo
  | 'PURCHASE'          // Comprar en tienda                   → 0 ciclos
  | 'NEGOTIATE'         // Negociar con otra party             → 0.5 ciclos
  | 'PHASE_CHANGE'      // Cambiar día/noche explícito         → 1 ciclo
  | 'SAFE_ZONE_WAIT'    // Esperar fin de temporada en zona segura → ciclos restantes
  | 'BATCH_SIMULATE';   // Simulación en lote (usado internamente) → variable

export const CYCLE_COST: Record<TimeAction, number> = {
  REST_SHORT:       0.5,
  REST_LONG:        1,
  EXPLORE_ROOM:     0,
  ENTER_DUNGEON:    0,
  FLOOR_ADVANCE:    0,
  RETURN_VILLAGE:   1,
  PURCHASE:         0,
  NEGOTIATE:        0.5,
  PHASE_CHANGE:     1,
  SAFE_ZONE_WAIT:   0,    // el costo real se calcula en safeZoneService (ciclos restantes)
  BATCH_SIMULATE:   0,    // controlado externamente — no usar CYCLE_COST para este
};

/**
 * Determina la nueva fase basándose en el ciclo actual.
 * Los ciclos pares son DÍA, los impares son NOCHE.
 */
export function getPhaseForCycle(cycle: number): 'DAY' | 'NIGHT' {
  return cycle % 2 === 0 ? 'DAY' : 'NIGHT';
}

/**
 * Calcula el nuevo ciclo y fase después de una acción.
 * Maneja ciclos fraccionarios (0.5) internamente.
 * Para SAFE_ZONE_WAIT usar advanceToEndOfSeason() en su lugar.
 */
export function advanceTime(
  currentCycle: number,
  action: TimeAction,
): { newCycle: number; newPhase: 'DAY' | 'NIGHT'; phaseChanged: boolean } {
  const cost = CYCLE_COST[action];
  const rawNew = currentCycle + cost;
  const newCycle = Math.floor(rawNew);
  const newPhase = getPhaseForCycle(newCycle);
  const phaseChanged = newPhase !== getPhaseForCycle(currentCycle);
  return { newCycle, newPhase, phaseChanged };
}

/**
 * Avanza directamente al ciclo 60 (fin de temporada) desde una zona segura.
 * Usado por SAFE_ZONE_WAIT — ver doc 11 (safeZoneService).
 */
export function advanceToEndOfSeason(
  currentCycle: number,
): { newCycle: 60; cyclesSimulated: number } {
  const cyclesSimulated = Math.max(0, 60 - currentCycle);
  return { newCycle: 60, cyclesSimulated };
}

/**
 * Verifica si la Torre está cerrada (ciclo >= 60).
 */
export function isTowerClosed(cycle: number): boolean {
  return cycle >= 60;
}

/**
 * Retorna cuántos ciclos quedan antes del cierre.
 */
export function cyclesRemaining(cycle: number): number {
  return Math.max(0, 60 - cycle);
}
```

---

## Paso 2 — Conectar `CycleTransitionScreen` al store real

```typescript
// src/screens/CycleTransitionScreen.tsx  — CAMBIOS

import { useGameStore } from '../stores/gameStore';

export const CycleTransitionScreen = ({ navigation }: ScreenProps<'CycleTransition'>) => {
  const activeGame   = useGameStore(s => s.activeGame);
  const lastSimEvents = useGameStore(s => s.lastSimulationEvents);

  // ❌ ANTES (hardcodeado):
  // const nextCycle = 4;
  // const previousFloor = 5;

  // ✅ AHORA (del store):
  const nextCycle    = activeGame?.cycle ?? 1;
  const previousFloor = activeGame?.floor ?? 1;

  // Top 5 eventos reales del worldSimulator
  const displayEvents = lastSimEvents?.slice(0, 5) ?? [];

  const phases = useMemo(() => [
    t('cycleTransition.extracting'),
    t('cycleTransition.processing'),
    `${t('cycleTransition.cycle')} ${nextCycle - 1} → ${t('cycleTransition.cycle')} ${nextCycle}`,
    ...displayEvents.map(e => e.summary),
    t('cycleTransition.ready'),
  ], [t, nextCycle, displayEvents]);

  // ... resto igual
};
```

---

## Paso 3 — Añadir `lastSimulationEvents` al gameStore

```typescript
// src/stores/gameStore.ts — AÑADIR

import type { SimulationEvent } from '../services/worldSimulator';
import { advanceTime, advanceToEndOfSeason } from '../services/timeService';
import { simulateWorld, advanceCycleBatch } from '../services/worldSimulator';

// En GameState:
type GameState = {
  // ... campos existentes ...
  lastSimulationEvents: SimulationEvent[] | null;
};

// En GameActions:
type GameActions = {
  // ... acciones existentes ...
  advanceCycle:    (action: TimeAction) => Promise<void>;
  advanceToVillage: () => Promise<void>; // desde zona segura: simula ciclos restantes
  setSimulationEvents: (events: SimulationEvent[]) => void;
};

// Implementación:
advanceCycle: async (action) => {
  const { activeGame } = get();
  if (!activeGame) return;

  const { newCycle, newPhase } = advanceTime(activeGame.cycle, action);
  if (newCycle === activeGame.cycle) return; // sin cambio de ciclo entero

  const { events } = await simulateWorld(activeGame.seedHash, newCycle, activeGame);

  get().updateProgress({ cycle: newCycle, phase: newPhase });
  set({ lastSimulationEvents: events });
},

advanceToVillage: async () => {
  const { activeGame } = get();
  if (!activeGame) return;

  // Simular ciclos restantes en lotes de 6 (ver doc 12)
  const { events } = await advanceCycleBatch(
    activeGame.seedHash,
    activeGame.cycle,
    60,
    activeGame,
  );

  get().updateProgress({ cycle: 60, phase: 'DAY', towerClosed: true });
  set({ lastSimulationEvents: events });
},
```

---

## Paso 4 — Trigger de avance de ciclo en VillageScreen

```typescript
// src/screens/VillageScreen.tsx

const { advanceCycle } = useGameStore();

const handleRest = useCallback(async () => {
  if (gold < REST_INN_COST) return; // Ver doc 02 para REST_INN_COST = 50

  updateProgress({ gold: gold - REST_INN_COST });
  await advanceCycle('REST_LONG');
  navigation.navigate('CycleTransition');
}, [gold, advanceCycle, updateProgress, navigation]);
```

---

## Paso 5 — Migration v7

```typescript
// src/database/migrations.ts — migration v7

7: [
  `ALTER TABLE saved_games ADD COLUMN cycle_raw REAL NOT NULL DEFAULT 1.0`,
  `ALTER TABLE saved_games ADD COLUMN last_action_at TEXT`,
  `ALTER TABLE saved_games ADD COLUMN last_sim_events TEXT`, // JSON de SimulationEvent[]
],
```

---

## Flujo completo de avance de tiempo

```
Jugador presiona "Descansar" en VillageScreen
    ↓
advanceCycle('REST_LONG') en gameStore
    ↓
timeService.advanceTime(currentCycle, 'REST_LONG')
    → newCycle = currentCycle + 1
    ↓
worldSimulator.simulateWorld(seedHash, newCycle, activeGame)
    → Procesa parties IA hasta newCycle
    → Genera SimulationEvent[]
    ↓
updateProgress({ cycle: newCycle, phase: newPhase })
    ↓
navigation.navigate('CycleTransition')
    → Muestra SimulationEvent[] reales
    ↓
navigation.navigate('Village')

─────────── SAFE_ZONE_WAIT (desde CampScreen doc 11) ───────────

Jugador elige "Esperar fin de temporada" en CampScreen
    ↓
gameStore.advanceToVillage()
    ↓
advanceCycleBatch(seedHash, currentCycle, 60, activeGame)
    → Simula en lotes de 6 ciclos
    → Muestra SimulationLoadingScreen con highlights
    ↓
updateProgress({ cycle: 60, towerClosed: true })
    ↓
navigation.navigate('Village') [con guardia towerClosed]
```

---

## Checklist de implementación

- [ ] Crear `src/utils/prng.ts` — utilitario PRNG compartido (ver doc 08)
- [ ] Crear `src/services/timeService.ts` con todas las `TimeAction` (Paso 1)
- [ ] Conectar `CycleTransitionScreen` al store (Paso 2)
- [ ] Añadir `lastSimulationEvents` + `advanceCycle` + `advanceToVillage` al gameStore (Paso 3)
- [ ] Trigger `advanceCycle` en VillageScreen posada (Paso 4)
- [ ] Migration v7 (Paso 5)
- [ ] Trigger `advanceCycle('RETURN_VILLAGE')` al salir del dungeon
- [ ] Mostrar contador de ciclos restantes en VillageScreen header
- [ ] Modal de cierre de temporada al ciclo 60
- [ ] Guardia en VillageScreen: bloquear acceso si `!towerClosed` al regresar de zona segura
