# TORRE — Guía Completa de Implementación
> Basada en `plan/sprints/` · Versión 1.0 · 2026-03-11
> Estado del proyecto: Sprint 4B completado. El siguiente inmediato es **Sprint 4C**.

---

## ¿Cómo leer esta guía?

Cada bloque incluye:
- **Qué es y por qué existe** — contexto técnico para el equipo
- **Archivos involucrados** — qué tocar y qué crear
- **Pasos concretos** — en orden de dependencia
- **Checklist de verificación** — cómo saber que está hecho

Los bloques están ordenados por **dependencia real**, no por número de sprint. No saltar bloques.

---

## Regla de oro de integridad antes de empezar

Antes de tocar cualquier archivo, el equipo debe conocer estas 6 notas de integridad del sistema (de `00_INDICE.md`):

| Nota | Regla |
|------|-------|
| NI-01 | `MAX_LEVEL_MVP = 10` en Sprint 6. Se sube a 20 en Sprint 7 con esencias. |
| NI-02 | El tipo `CharacterSave` canónico vive en `gameRepository.ts`. Añadir campos ahí siempre. |
| NI-03 | `makePRNG()` nunca se define inline. Siempre importar desde `src/utils/prng.ts`. |
| NI-04 | `AIProfile` tiene 5 valores: `AGGRESSIVE \| DEFENSIVE \| OPPORTUNISTIC \| EXPANSIONIST \| SURVIVALIST`. |
| NI-05 | `SAFE_ZONE_WAIT` en `timeService.ts` — el costo real lo calcula `safeZoneService`. |
| NI-06 | `CombatResult.essenceDrops` en doc 03 y doc 13 deben estar sincronizados. |

---

---

# SPRINT 4C — Sistema Narrativo Emocional
> **Prerrequisito:** Sprint 4B completado ✅
> **Archivos:** `combatEngine.ts`, `BattleScreen.tsx`, nuevo `emotionalNarrativeService.ts`, nuevo `NarrativeMomentPanel.tsx`
> **Impacto:** 100% aditivo. No rompe nada existente.

## ¿Por qué existe este sistema?

El combate DnD 5e actual resuelve tiradas y mueve HP, pero el jugador no siente nada. Este sistema añade una capa emocional: los personajes reaccionan con su expresión facial generada por IA, y un panel de texto narrativo aparece en momentos dramáticos (aliado caído, boss derrotado, crítico). Usa las 22 expresiones que ya existen en DB.

## Paso 4C-01 — Añadir eventos al resultado de combate

**Archivo:** `src/services/combatEngine.ts`

Añadir los nuevos tipos al final del archivo, sin modificar los tipos existentes:

```typescript
// ─── Tipos de eventos de combate (Sprint 4C) ─────────────
export type CombatEventType =
  | 'CRIT_DEALT'       // golpe crítico — nat-20
  | 'ALLY_DOWN'        // personaje del jugador cae
  | 'ENEMY_DOWN'       // enemigo derrotado
  | 'BOSS_DEFEATED'    // boss del piso derrotado
  | 'FUMBLE'           // nat-1 — fallo catastrófico
  | 'NEAR_DEATH'       // personaje < 20% HP
  | 'VERY_LOW_HEALTH'  // party < 30% HP promedio
  | 'LAST_STANDING';   // último personaje vivo de la party

export type CombatEvent = {
  type: CombatEventType;
  actorName: string;
  targetName?: string;
  value?: number;      // daño en CRIT, HP restante en NEAR_DEATH
  turn: number;
};

// Añadir campo optional a CombatResult (sin romper lectores actuales):
// events?: CombatEvent[]
```

**Por qué campo optional:** `ReportScreen` y `gameStore` leen `CombatResult` hoy. Al hacerlo opcional no hay que modificar esos lectores existentes.

## Paso 4C-02 — Emitir eventos desde `resolveCombat()`

**Archivo:** `src/services/combatEngine.ts` — dentro de `resolveCombat()`

Al final de cada turno del bucle de combate, detectar condiciones y emitir eventos:

```typescript
// Dentro del bucle de turnos — al procesar el resultado de cada ataque:
const events: CombatEvent[] = [];

// Crítico:
if (rollResult === 20) {
  events.push({ type: 'CRIT_DEALT', actorName: attacker.name, targetName: defender.name, value: damage, turn });
}

// Aliado caído:
if (defenderIsPlayer && defender.hpAfter <= 0) {
  events.push({ type: 'ALLY_DOWN', actorName: defender.name, turn });
}

// Boss derrotado:
if (roomType === 'BOSS' && !defenderIsPlayer && defender.hpAfter <= 0) {
  events.push({ type: 'BOSS_DEFEATED', actorName: defender.name, turn });
}

// Al construir CombatResult:
return { ...existingFields, events };
```

## Paso 4C-03 — Crear `emotionalNarrativeService.ts`

**Archivo nuevo:** `src/services/emotionalNarrativeService.ts`

Este servicio traduce eventos de combate a expresiones faciales y texto narrativo:

```typescript
import type { CombatEvent, CombatEventType } from './combatEngine';
import type { CharacterSave } from '../database/gameRepository';

// Las 22 expresiones válidas (coinciden exactamente con keys del DB)
export type ExpressionKey =
  | 'neutral' | 'angry' | 'confident' | 'confused' | 'despondent'
  | 'determined' | 'disgusted' | 'fearful' | 'fierce' | 'flirty'
  | 'happy' | 'hollow' | 'incredulous' | 'rage' | 'sad'
  | 'sarcastic' | 'seductive' | 'serious' | 'shocked' | 'surprised'
  | 'tired' | 'triumph';

export type EmotionState = {
  characterName: string;
  expression: ExpressionKey;
  intensity: number; // 0-1 — qué tan intensa es la emoción
};

export type NarrativeMoment = {
  headline: string;
  headline_en: string;
  characterName: string;
  expression: ExpressionKey;
  durationMs: number; // normalmente 3500ms
  eventType: CombatEventType;
};

// Mapa de evento → expresión por clase de personaje
const CLASS_EXPRESSIONS: Record<string, Partial<Record<CombatEventType, ExpressionKey>>> = {
  barbarian: { CRIT_DEALT: 'rage', ALLY_DOWN: 'fierce', BOSS_DEFEATED: 'triumph' },
  rogue:     { CRIT_DEALT: 'flirty', ALLY_DOWN: 'shocked', BOSS_DEFEATED: 'sarcastic' },
  paladin:   { CRIT_DEALT: 'determined', ALLY_DOWN: 'sad', BOSS_DEFEATED: 'confident' },
  wizard:    { CRIT_DEALT: 'incredulous', ALLY_DOWN: 'despondent', BOSS_DEFEATED: 'serious' },
  // default para clases no listadas:
  _default:  { CRIT_DEALT: 'fierce', ALLY_DOWN: 'sad', BOSS_DEFEATED: 'triumph', FUMBLE: 'confused', NEAR_DEATH: 'fearful' },
};

export function resolveExpression(
  charClass: string,
  eventType: CombatEventType,
): ExpressionKey {
  const map = CLASS_EXPRESSIONS[charClass.toLowerCase()] ?? CLASS_EXPRESSIONS._default;
  return map[eventType] ?? CLASS_EXPRESSIONS._default[eventType] ?? 'neutral';
}

// Solo 4 tipos generan panel narrativo visible
export function isSignificantEvent(eventType: CombatEventType): boolean {
  return ['ALLY_DOWN', 'BOSS_DEFEATED', 'VERY_LOW_HEALTH', 'CRIT_DEALT'].includes(eventType);
}

// Pools de texto narrativo por evento (expandir en Sprint 8)
const NARRATIVE_POOLS: Record<CombatEventType, string[]> = {
  ALLY_DOWN:       ['¡{name} ha caído!', 'La Torre reclama a {name}...', '{name} no puede más.'],
  BOSS_DEFEATED:   ['¡{name} ha sido derrotado!', 'El eco del dungeon tiembla.', 'Victoria en las profundidades.'],
  VERY_LOW_HEALTH: ['La party está al límite.', 'Solo queda resistir.', 'Un paso más y todo acaba.'],
  CRIT_DEALT:      ['¡Golpe devastador de {name}!', '¡{name} encuentra el punto débil!', '¡Crítico!'],
  FUMBLE:          [], ENEMY_DOWN: [], NEAR_DEATH: [], LAST_STANDING: [],
};

export function buildNarrativeMoment(
  event: CombatEvent,
  char: CharacterSave,
): NarrativeMoment | null {
  if (!isSignificantEvent(event.type)) return null;
  const pool = NARRATIVE_POOLS[event.type];
  if (!pool.length) return null;

  const expression = resolveExpression(char.charClass, event.type);
  const rawText = pool[Math.floor(Math.random() * pool.length)].replace('{name}', event.actorName);

  return {
    headline: rawText,
    headline_en: rawText, // expandir con traducciones en Sprint 8
    characterName: event.actorName,
    expression,
    durationMs: 3500,
    eventType: event.type,
  };
}
```

## Paso 4C-04 — Crear `NarrativeMomentPanel.tsx`

**Archivo nuevo:** `src/components/NarrativeMomentPanel.tsx`

```typescript
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import type { NarrativeMoment } from '../services/emotionalNarrativeService';

type Props = {
  moment: NarrativeMoment;
  portraitUri?: string;
  onDismiss: () => void;
};

export const NarrativeMomentPanel = React.memo<Props>(({ moment, onDismiss }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in → espera → fade out automático
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(moment.durationMs - 600),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => onDismiss());
  }, [moment]);

  return (
    <Animated.View style={{ opacity, position: 'absolute', bottom: 80, left: 16, right: 16 }}
      className="bg-black/90 border border-amber-500 rounded p-4">
      <Text className="text-amber-400 font-bold text-center">{moment.headline}</Text>
    </Animated.View>
  );
});
```

## Paso 4C-05 — Integrar en `BattleScreen.tsx`

Añadir estado y lógica (sin modificar el flujo de combate existente):

```typescript
import { buildNarrativeMoment } from '../services/emotionalNarrativeService';
import { NarrativeMomentPanel } from '../components/NarrativeMomentPanel';

// Estado nuevo:
const [activeMoment, setActiveMoment] = useState<NarrativeMoment | null>(null);
const [partyEmotions, setPartyEmotions] = useState<Record<string, ExpressionKey>>({});

// Después de resolveCombat(), procesar eventos:
const processEmotionEvents = useCallback((events: CombatEvent[]) => {
  for (const event of events) {
    if (isSignificantEvent(event.type)) {
      const char = partyData.find(c => c.name === event.actorName);
      if (char) {
        const moment = buildNarrativeMoment(event, char);
        if (moment) setActiveMoment(moment);
      }
    }
  }
}, [partyData]);

// En el render, debajo del log de combate:
{activeMoment && (
  <NarrativeMomentPanel
    moment={activeMoment}
    onDismiss={() => setActiveMoment(null)}
  />
)}
```

## Paso 4C-06 — Reemplazar selección de expresión hardcodeada

**Archivo:** `src/screens/BattleScreen.tsx` línea 536

```typescript
// ❌ ANTES (hardcodeado):
// exprs?.['aggressive'] ?? exprs?.['angry'] ?? exprs?.['neutral']

// ✅ AHORA (dinámico por estado emocional):
const getCharExpression = useCallback((charName: string): string => {
  const emotionKey = partyEmotions[charName] ?? 'neutral';
  const exprs = portraitsMap?.[charName];
  return exprs?.[emotionKey] ?? exprs?.['neutral'] ?? '';
}, [partyEmotions, portraitsMap]);
```

## Checklist Sprint 4C
- [ ] `CombatResult` tiene campo `events?: CombatEvent[]`
- [ ] `resolveCombat()` emite eventos para: crit, ally_down, boss_defeated, fumble
- [ ] `emotionalNarrativeService.ts` creado y exportado desde `services/index.ts`
- [ ] `NarrativeMomentPanel` se muestra y auto-dismiss en 3.5s
- [ ] Expresión en BattleScreen deja de estar hardcodeada
- [ ] El panel no bloquea ninguna acción del jugador

---

---

# SPRINT 5-A — PRNG Centralizado (PRERREQUISITO DE TODO)
> **Hacer esto antes que cualquier otra cosa del Sprint 5**
> **Archivo:** `src/utils/prng.ts`

## ¿Por qué es el primer paso?

Actualmente `makePRNG()` está definido inline en 8+ servicios (`combatEngine.ts`, `dungeonGraphService.ts`, `lootService.ts`, etc.). Si dos servicios usan la misma semilla pero su implementación diverge mínimamente, los valores generados difieren y el mundo deja de ser determinístico. Esto rompe la promesa fundamental del juego: **la misma seed siempre genera el mismo mundo**.

## Paso 5A-01 — Crear `src/utils/prng.ts`

```typescript
/**
 * prng.ts — Generador Pseudoaleatorio Compartido
 * FUENTE DE VERDAD ÚNICA para toda la PRNG del proyecto.
 *
 * Algoritmo: djb2 (hash de string → seed numérica) + LCG (Linear Congruential Generator)
 * Características:
 *   - Determinístico: misma string → misma secuencia de números
 *   - Rápido: sin operaciones de punto flotante pesadas
 *   - Portable: funciona igual en iOS, Android y Node.js (para tests)
 *
 * REGLA: Nunca definir makePRNG inline en ningún servicio.
 * SIEMPRE importar desde aquí.
 */

export type PRNG = {
  /** Devuelve float en [0, 1) */
  float(): number;
  /** Devuelve entero en [min, max] inclusive */
  next(min?: number, max?: number): number;
  /** Devuelve true con probabilidad p (0-1) */
  chance(p: number): boolean;
  /** Elige elemento random de un array */
  pick<T>(arr: T[]): T;
};

/**
 * Crea un PRNG seeded a partir de cualquier string.
 *
 * CONVENCIÓN DE PREFIJOS:
 * Cada servicio debe añadir un prefijo único para evitar colisiones de secuencia:
 *   - combate:    `${seedHash}_combat_${roomId}`
 *   - loot:       `${seedHash}_loot_${roomId}_${floor}`
 *   - moral:      `${seedHash}_moral_${charName}`
 *   - esencias:   `${seedHash}_essence_${definitionId}_${cycle}`
 *   - worldsim:   `${seedHash}_wsim_${partyName}_${cycle}`
 *
 * NUNCA compartir el mismo string de seed entre servicios distintos.
 */
export function makePRNG(seed: string): PRNG {
  // djb2: hash de string a entero de 32 bits
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(h, 33) ^ seed.charCodeAt(i)) >>> 0;
  }

  // LCG state (Numerical Recipes constants)
  let s = h >>> 0;

  const advance = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s;
  };

  return {
    float() {
      return advance() / 0x100000000;
    },
    next(min = 0, max = 1) {
      return Math.floor(min + this.float() * (max - min + 1));
    },
    chance(p) {
      return this.float() < p;
    },
    pick<T>(arr: T[]): T {
      return arr[this.next(0, arr.length - 1)];
    },
  };
}
```

## Paso 5A-02 — Reemplazar definiciones inline

Buscar en todo el proyecto con: `grep -r "function makePRNG" src/`

Reemplazar en cada archivo encontrado:
```typescript
// ❌ ELIMINAR el bloque completo de función makePRNG local
// ✅ AÑADIR al principio del archivo:
import { makePRNG } from '../utils/prng';
// (ajustar path relativo según la ubicación del archivo)
```

**Archivos donde existe hoy (verificar con grep):**
- `src/services/combatEngine.ts`
- `src/services/dungeonGraphService.ts`
- `src/services/lootService.ts` (si ya existe)
- Cualquier otro que aparezca en el grep

## Checklist 5A
- [ ] `src/utils/prng.ts` creado
- [ ] `grep -r "function makePRNG" src/` devuelve 0 resultados
- [ ] Todos los servicios importan `makePRNG` desde `../utils/prng`
- [ ] Tests: `makePRNG('A').float() !== makePRNG('B').float()` (prefijos distintos)

---

# SPRINT 5-B — Sistema Temporal (timeService + CycleTransitionScreen)
> **Prerrequisito:** 5A completado
> **Archivos:** `src/services/timeService.ts`, `src/stores/gameStore.ts`, `src/screens/CycleTransitionScreen.tsx`, `src/screens/VillageScreen.tsx`, `src/database/migrations.ts`

## ¿Por qué existe este sistema?

El tiempo es el recurso estratégico principal. Sin él, el jugador puede explorar indefinidamente sin consecuencias. El ciclo 60 marca el cierre de la Torre — la presión temporal es lo que fuerza decisiones. Hoy el campo `cycle` existe en DB pero nunca avanza por acciones del jugador.

## Paso 5B-01 — Crear `src/services/timeService.ts`

Ver código completo en `plan/sprints/01_SISTEMA_TEMPORAL.md` → Paso 1.

Puntos clave:
- Todas las acciones del jugador pasan por `advanceTime()` — nunca mutar `cycle` directamente
- `SAFE_ZONE_WAIT` tiene costo 0 en esta tabla — el costo real lo calcula `safeZoneService` (Sprint 6)
- `advanceToEndOfSeason()` es la función para saltar al ciclo 60 desde una zona segura

## Paso 5B-02 — Migration v7

**Archivo:** `src/database/migrations.ts`

```typescript
7: [
  // cycle_raw: permite ciclos fraccionarios (0.5 por REST_SHORT)
  // La fuente de verdad del ciclo es cycle_raw, no el campo cycle
  `ALTER TABLE saved_games ADD COLUMN cycle_raw REAL NOT NULL DEFAULT 1.0`,
  // last_action_at: timestamp de última acción (para analytics futuros)
  `ALTER TABLE saved_games ADD COLUMN last_action_at TEXT`,
  // last_sim_events: JSON de SimulationEvent[] del worldSimulator
  `ALTER TABLE saved_games ADD COLUMN last_sim_events TEXT`,
],
```

**Por qué `cycle_raw`:** REST_SHORT cuesta 0.5 ciclos. Para que el sistema sea consistente en casos de crash/recuperación, el estado real del tiempo es el float, no el entero. Al cargar un save: `cycle = Math.floor(cycle_raw)`.

## Paso 5B-03 — Añadir acciones de tiempo al `gameStore.ts`

Ver código completo en `plan/sprints/01_SISTEMA_TEMPORAL.md` → Paso 3.

Resumen de lo que se añade:
- `lastSimulationEvents: SimulationEvent[] | null` al estado
- `advanceCycle(action: TimeAction)`: avanza tiempo y llama al worldSimulator
- `advanceToVillage()`: desde zona segura, simula ciclos restantes en lotes

## Paso 5B-04 — Conectar `CycleTransitionScreen` al store real

**Archivo:** `src/screens/CycleTransitionScreen.tsx`

```typescript
// ❌ ANTES — completamente hardcodeado:
const nextCycle = 4;
const previousFloor = 5;

// ✅ AHORA — datos reales del store:
const activeGame = useGameStore(s => s.activeGame);
const lastSimEvents = useGameStore(s => s.lastSimulationEvents);

const nextCycle = activeGame?.cycle ?? 1;
const previousFloor = activeGame?.floor ?? 1;
const displayEvents = lastSimEvents?.slice(0, 5) ?? [];
```

## Paso 5B-05 — Trigger en VillageScreen (posada)

```typescript
// src/screens/VillageScreen.tsx
const { advanceCycle } = useGameStore();

const handleRest = useCallback(async () => {
  if (gold < REST_INN_COST) {
    Alert.alert(t('village.insufficientGold'), `Necesitas ${REST_INN_COST}G`);
    return;
  }
  updateProgress({ gold: gold - REST_INN_COST });
  await advanceCycle('REST_LONG');
  navigation.navigate('CycleTransition');
}, [gold, advanceCycle]);
```

## Paso 5B-06 — Trigger al salir del dungeon

```typescript
// src/screens/MapScreen.tsx — en el handler de volver a la villa
// Al presionar el botón de salida del dungeon:
await advanceCycle('RETURN_VILLAGE');
navigation.navigate('Village');
```

## Paso 5B-07 — Modal de cierre de Torre al ciclo 60

```typescript
// src/screens/VillageScreen.tsx
const cycle = useGameStore(s => s.activeGame?.cycle);

useEffect(() => {
  if (cycle >= 60) {
    // Mostrar modal de cierre de temporada
    setShowSeasonEndModal(true);
  }
}, [cycle]);
```

## Checklist 5B
- [ ] `timeService.ts` creado con todas las `TimeAction` definidas
- [ ] Migration v7 ejecuta sin error en DB limpia
- [ ] `CycleTransitionScreen` muestra el ciclo real (no `4` hardcodeado)
- [ ] Descansar en posada incrementa el ciclo en el store
- [ ] Salir del dungeon incrementa el ciclo
- [ ] Modal de cierre aparece al llegar al ciclo 60
- [ ] `cycle = Math.floor(cycle_raw)` al cargar save

---

# SPRINT 5-C — worldSimulator.ts (Motor de Simulación IA)
> **Prerrequisito:** 5A y 5B completados
> **Archivo:** `src/services/worldSimulator.ts`
> **Este es el sistema más crítico del Sprint 5**

## ¿Por qué existe este sistema?

Sin él, el jugador es el único actor del mundo. Las parties IA existen como texto decorativo. Con el worldSimulator, cuando el jugador avanza un ciclo, todas las parties IA también avanzan: combaten entre sí, suben de piso, forman alianzas o mueren. El WorldLog deja de ser mock.

## Paso 5C-01 — Tipos del simulador

Ver código completo en `plan/sprints/04_WORLD_SIMULATOR.md` → Paso 1.

Tipos clave:
- `SimulationEvent` — un hecho ocurrido en el mundo (con `summary` en ES y EN)
- `SimulationResult` — lista de events + rivals actualizados
- `AIPartyState` — estado interno de cada party IA durante la simulación
- `AIProfile` — debe tener los 5 valores canónicos (ver NI-04)

## Paso 5C-02 — PRNG del simulador

```typescript
// worldSimulator.ts — importar desde utils (NI-03)
import { makePRNG } from '../utils/prng';

// Prefijo único para evitar colisiones:
// makePRNG(`${seedHash}_wsim_${partyName}_${cycle}`)
```

## Paso 5C-03 — `decideAction()` con perfiles

```typescript
function decideAction(state: AIPartyState, rng: PRNG): AIAction {
  switch (state.profile) {
    case 'AGGRESSIVE':
      // 60% atacar la party más fuerte accesible
      if (rng.chance(0.6) && hasTargetsAvailable(state)) return 'ATTACK';
      return 'ADVANCE';
    case 'DEFENSIVE':
      // Priorizar recuperar HP antes de atacar
      if (state.hp < 40) return 'REST';
      return rng.chance(0.3) ? 'ATTACK' : 'ADVANCE';
    case 'OPPORTUNISTIC':
      // Atacar solo si tiene ventaja clara de HP
      if (state.hp > 70 && hasWeakTargets(state)) return 'ATTACK';
      return 'ADVANCE';
    case 'EXPANSIONIST':
      // Avanzar pisos agresivamente
      return rng.chance(0.7) ? 'ADVANCE' : 'ATTACK';
    case 'SURVIVALIST':
      // Sobrevivir ante todo
      if (state.hp < 60) return 'REST';
      return 'ADVANCE';
    default:
      return 'ADVANCE';
  }
}
```

## Paso 5C-04 — `simulateWorld()` — entry point

```typescript
export async function simulateWorld(
  seedHash: string,
  targetCycle: number,
  playerGame: SavedGame,
): Promise<SimulationResult> {
  const rivals = loadRivalsFromDB(seedHash); // fuente de verdad: DB (ver RT-04)
  const events: SimulationEvent[] = [];

  for (const rival of rivals) {
    const state = initAIPartyState(rival, seedHash);
    const rng = makePRNG(`${seedHash}_wsim_${rival.name}_${targetCycle}`);

    // Simular del ciclo actual al targetCycle
    for (let c = rival.currentCycle; c < targetCycle; c++) {
      const action = decideAction(state, rng);
      const event = executeAction(state, action, c, rng, playerGame);
      if (event) events.push(event);
    }
  }

  return { updatedRivals: rivals, events };
}
```

**Regla crítica (RT-04):** Siempre cargar rivals desde DB al inicio, no desde estado anterior en memoria. La DB es la fuente de verdad.

## Paso 5C-05 — Benchmark obligatorio

```typescript
// Crear test en __tests__/worldSimulator.test.ts
it('simula 10 parties × 60 ciclos en < 100ms', () => {
  const start = Date.now();
  simulateWorld('TEST_SEED', 60, mockPlayerGame);
  expect(Date.now() - start).toBeLessThan(100);
});
```

Si el benchmark falla: revisar que no haya operaciones de DB dentro del bucle de simulación. La carga de rivals debe ser una sola query antes de los bucles.

## Paso 5C-06 — Conectar WorldLogScreen

**Archivo:** `src/screens/WorldLogScreen.tsx`

```typescript
// Reemplazar LOG_ENTRIES mock por datos reales:
const lastSimEvents = useGameStore(s => s.lastSimulationEvents);

// Los eventos ya están agrupados por ciclo en el store
const displayEvents = lastSimEvents ?? [];
```

## Checklist 5C
- [ ] `worldSimulator.ts` creado
- [ ] `AIProfile` tiene los 5 valores canónicos (NI-04)
- [ ] `simulateWorld()` carga rivals desde DB al inicio (no desde estado en memoria)
- [ ] Benchmark: 10 parties × 60 ciclos < 100ms
- [ ] `WorldLogScreen` muestra eventos reales (no mock)
- [ ] Añadir `worldSimulator` al barrel de `services/index.ts`

---

---

# SPRINT 6-A — Migrations y Arquitectura de Datos
> **Prerrequisito:** Sprint 5 completado
> **Archivos:** `src/database/migrations.ts`, `src/database/itemRepository.ts`, `src/database/eventRepository.ts`, `src/database/gameRepository.ts`

## ¿Por qué primero las migrations?

Todos los sistemas del Sprint 6 necesitan tablas que no existen. Si se implementa lógica antes que la DB, hay que refactorizar. Las migrations son la base. La regla es: **migration antes de servicio, servicio antes de pantalla**.

## Paso 6A-01 — Migration v8: tabla `items`

Ver SQL completo en `plan/sprints/02_ECONOMIA_Y_LOOT.md` → Paso 1.

Puntos de diseño importantes:
- `owner_game_id = null` significa el item está en el piso, sin dueño
- `claimed = 1` para loot único de boss ya recogido (previene duplicados — ver RT-06)
- `data TEXT` como JSON permite guardar stats específicos sin cambiar el schema

## Paso 6A-02 — Migration v9: tablas `events` y `bounties`

Ver SQL completo en `plan/sprints/05_MORAL_Y_BOUNTY.md` → Paso 1.

## Paso 6A-03 — Migration v10: tabla `alliances`

Ver SQL completo en `plan/sprints/07_POLITICA_Y_ALIANZAS.md` → Paso 1.

## Paso 6A-04 — Migration v11: campos de zona segura

```typescript
11: [
  `ALTER TABLE saved_games ADD COLUMN in_safe_zone INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE saved_games ADD COLUMN safe_zone_room_id TEXT`,
],
```

## Paso 6A-05 — Migration v12: ciclo de vida de party

```typescript
12: [
  // party_origin: 'player_created' | 'ai_inherited' | 'system'
  `ALTER TABLE saved_games ADD COLUMN party_origin TEXT NOT NULL DEFAULT 'player_created'`,
  `ALTER TABLE saved_games ADD COLUMN predecessor_game_id TEXT`,
  `ALTER TABLE saved_games ADD COLUMN created_by_player INTEGER NOT NULL DEFAULT 1`,
],
```

## Paso 6A-06 — `CharacterSave` canónico (NI-02)

**Archivo:** `src/database/gameRepository.ts`

Añadir todos los campos nuevos al tipo `CharacterSave`:

```typescript
export type CharacterSave = {
  // ─── Campos existentes ───────────────────────────────────
  name: string;
  race: string;
  charClass: string;
  subclass: string;
  background: string;
  alignment: string;
  hp: number;
  maxHp: number;
  alive: boolean;

  // ─── Sprint 5 ────────────────────────────────────────────
  stats: Record<string, number>;

  // ─── Sprint 6 (añadir en 6A) ────────────────────────────
  level: number;         // 1-10 (MVP), 1-20 (full con esencias)
  xp: number;            // XP acumulada
  deathCount: number;    // muertes totales del personaje
  morale: number;        // 0-100 (sistema de moral)
  pendingLevelUp: boolean; // hay nivel disponible sin confirmar en CampScreen
};
```

**Regla NI-02:** Cualquier otro documento que añada campos a CharacterSave debe pasar primero por aquí.

## Paso 6A-07 — Crear `itemRepository.ts` y `eventRepository.ts`

Estos repositories siguen el mismo patrón que `gameRepository.ts`:
- `saveItem(item: LootDrop, gameId: string): void`
- `getItemsByGame(gameId: string): LootDrop[]`
- `markBosslootClaimed(itemId: string): void`

Exportar ambos desde `src/database/index.ts`.

## Checklist 6A
- [ ] Migrations v8–v12 ejecutan en orden sin error desde DB limpia
- [ ] `CharacterSave` tiene todos los campos nuevos en `gameRepository.ts`
- [ ] `itemRepository.ts` creado con CRUD básico
- [ ] `eventRepository.ts` creado con insert y query por seed+tipo
- [ ] Todos los repositories exportados desde `database/index.ts`

---

# SPRINT 6-B — Economía y Loot
> **Prerrequisito:** 6A completado (migration v8 activa)
> **Archivos:** `economyService.ts`, `lootService.ts`, `VillageScreen.tsx`, `BattleScreen.tsx`, `ReportScreen.tsx`

## ¿Por qué importa?

Revivir hoy es gratis — elimina toda la tensión económica del juego. El loot es un string random sin persistencia. Estos dos sistemas dan peso real a las decisiones económicas.

## Paso 6B-01 — `economyService.ts`

Ver código completo en `plan/sprints/02_ECONOMIA_Y_LOOT.md` → Paso 2.

Fórmula clave: `ReviveCost = 100 × nivel × (1 + deathCount × 0.15)`

Ejemplo: nivel 5, 2 muertes = `100 × 5 × 1.30 = 650G`

## Paso 6B-02 — `lootService.ts`

Ver código completo en `plan/sprints/02_ECONOMIA_Y_LOOT.md` → Paso 3.

Puntos críticos:
- El ID del item incluye `seedHash` — es determinístico
- `isBossLootClaimed()` consulta DB antes de generar el drop
- Guardar loot en DB en la misma transacción que marca `claimed` (RT-06)

## Paso 6B-03 — VillageScreen: revivir con costo real

Ver código completo en `plan/sprints/02_ECONOMIA_Y_LOOT.md` → Paso 4.

La lógica: si `gold < reviveCost` → Alert de fondos insuficientes. Si no → descontar oro y restaurar HP al 50%.

## Paso 6B-04 — BattleScreen: incrementar `deathCount` al morir

```typescript
// En handleContinue, al procesar el resultado:
const diedThisCombat = char.alive && !combatMember.alive;
return {
  ...char,
  deathCount: diedThisCombat ? (char.deathCount ?? 0) + 1 : (char.deathCount ?? 0),
};
```

## Paso 6B-05 — ReportScreen: guardar loot en DB

```typescript
// En useEffect al montar ReportScreen:
const drops = generateRoomLoot(roomId, roomType, floor, cycle, seedHash);
if (roomType === 'BOSS') {
  const unique = generateBossUniqueLoot(seedHash, roomId, floor);
  if (unique) drops.push(unique);
}
saveItems(drops, gameId, seedHash, cycle, floor); // itemRepository
```

## Checklist 6B
- [ ] Revivir descuenta oro correctamente
- [ ] Revivir rechaza si `gold < reviveCost` con mensaje claro
- [ ] `deathCount` se incrementa en BattleScreen al morir
- [ ] `deathCount` afecta el costo de revivir
- [ ] Loot se guarda en DB después de cada combate
- [ ] Boss loot único: segunda vez que se mata el mismo boss, no se genera loot unique

---

# SPRINT 6-C — Progresión y Parties (XP, Niveles, Herencia)
> **Prerrequisito:** 6A completado
> **Archivos:** `progressionService.ts`, `BattleScreen.tsx`, `SeedScreen.tsx`, `PartyScreen.tsx`

## Paso 6C-01 — `progressionService.ts`

Ver código completo en `plan/sprints/06_PARTIES_Y_HERENCIA.md` → Paso 1.

Funciones clave:
- `getLevelFromXP(xp)` — nivel según tabla DnD 5e simplificada
- `applyXP(char, xpGained)` — retorna CharacterSave actualizado + flag de nivel nuevo
- `getInheritedLevel(previousParty)` — nivel inicial de nueva party = avg de la anterior
- `MAX_LEVEL_MVP = 10` — constante exportada, no hardcodeada (NI-01)

## Paso 6C-02 — Aplicar XP post-combate

```typescript
// BattleScreen.tsx — en handleContinue:
import { applyXP } from '../services/progressionService';

const updatedParty = activeGame.partyData.map(char => {
  if (!char.alive) return char;
  const xpShare = Math.floor(result.totalXp / aliveCount);
  return applyXP(char, xpShare).updatedChar;
});
updateProgress({ partyData: updatedParty });
```

## Paso 6C-03 — Herencia de nivel al crear nueva party

```typescript
// SeedScreen.tsx o PartyScreen.tsx — al iniciar nueva expedición en seed existente:
import { getInheritedLevel } from '../services/progressionService';

const inheritedLevel = previousParty ? getInheritedLevel(previousParty) : 1;
// Pasar inheritedLevel como nivel inicial de cada personaje nuevo
```

## Checklist 6C
- [ ] `progressionService.ts` exportado desde `services/index.ts`
- [ ] XP se acumula en `CharacterSave.xp` después de cada combate
- [ ] `pendingLevelUp: true` cuando el personaje alcanza XP para subir nivel
- [ ] Nueva party en seed existente hereda nivel promedio
- [ ] `MAX_LEVEL_MVP = 10` como constante exportada (nunca hardcodeada)

---

# SPRINT 6-D — Moral, Bounty y Sistema Social
> **Prerrequisito:** 6A y 6C completados
> **Archivos:** `moralSystem.ts`, `bountyService.ts`, `GuildScreen.tsx`

## Paso 6D-01 — `moralSystem.ts`

Ver `plan/sprints/05_MORAL_Y_BOUNTY.md` para la implementación completa.

La moral (0-100) se reduce al:
- Matar una party → -20 moral a personajes de alineamiento bueno
- Abandonar a un aliado → -15 moral
- Completar un objetivo de gremio → +10 moral

Al moral < 20 y alineamiento bueno/legal: el personaje abandona la party. Pasa al pool de aventureros disponibles (no muere).

## Paso 6D-02 — `bountyService.ts`

El bounty es permanente en la seed. Se acumula por cada party IA eliminada.

```typescript
// bountyService.ts — calcular nivel de bounty:
export function calculateBountyLevel(killCount: number): number {
  if (killCount >= 8) return 5; // Infame — todas las parties te atacan
  if (killCount >= 5) return 4;
  if (killCount >= 3) return 3;
  if (killCount >= 1) return 2;
  return 1; // Sin bounty
}
```

## Paso 6D-03 — Actualizar GuildScreen

Añadir secciones:
- Lista de bounties activos contra el jugador
- Panel de alianzas activas
- WorldLog con eventos reales del simulador

## Checklist 6D
- [ ] `morale` se actualiza al matar party o al morir aliado
- [ ] Personaje con moral < 20 y alineamiento bueno abandona en siguiente ciclo
- [ ] Bounty se acumula en DB al eliminar parties
- [ ] GuildScreen muestra bounty actual y alianzas activas

---

# SPRINT 6-E — Combate Expandido y Zonas Seguras
> **Prerrequisito:** 6B, 6D completados
> **Archivos:** `encounterService.ts`, `safeZoneService.ts`, `CampScreen.tsx`, `LevelUpScreen.tsx`

## Paso 6E-01 — `encounterService.ts`

Ver `plan/sprints/03_COMBATE_EXPANDIDO.md` para la implementación completa.

Este servicio detecta cuándo el jugador y una party IA están en el mismo piso+zona y ofrece: atacar, negociar o huir.

## Paso 6E-02 — `safeZoneService.ts` + `CampScreen.tsx`

Ver `plan/sprints/11_ZONAS_SEGURAS.md` para la implementación completa.

La zona segura permite:
- Confirmar niveles pendientes (`pendingLevelUp`)
- Consumir consumibles del inventario
- Cambiar líder de party
- Descanso corto o largo (con costo de ciclos)
- Desde Sprint 7: gestión de esencias

## Paso 6E-03 — `LevelUpScreen.tsx`

Pantalla para confirmar subida de nivel de un personaje. Se accede desde CampScreen. Muestra las bonificaciones que se ganan y permite elegir (en clases con decisiones, como Fighter con Fighting Style).

## Checklist 6E
- [ ] `CampScreen` accesible desde nodos `SAFE_ZONE` en MapScreen
- [ ] `LevelUpScreen` aparece para cada personaje con `pendingLevelUp: true`
- [ ] Confirmar nivel actualiza stats del personaje en DB
- [ ] Huida de combate tiene chequeo real (Atletismo/Sigilo)
- [ ] Negociación tiene pantalla dedicada (`NegotiationScreen`)

---

# SPRINT 6-F — Alianzas y GuildScreen Hub
> **Prerrequisito:** 6D completado
> **Archivos:** `allianceService.ts`, `GuildScreen.tsx`, `AllianceScreen.tsx`

Ver `plan/sprints/07_POLITICA_Y_ALIANZAS.md` para implementación detallada.

Puntos clave:
- Un contrato de alianza tiene `protectionFee` (oro por ciclo) y `expiresAtCycle`
- La party aliada no ataca al jugador mientras el contrato esté activo
- `GuildScreen` se convierte en el hub central: contratos, bounty board, WorldLog, rankings

---

# SPRINT 6-G — Seeds, Parties y Cierre de Temporada
> **Prerrequisito:** 6C completado
> **Archivos:** `seedUnificationService.ts`, `UnificationScreen.tsx`, `SimulationLoadingScreen.tsx`

Ver `plan/sprints/12_SEED_Y_PARTIES.md` para las reglas completas.

Reglas más importantes:
- R1: 1 party activa por seed en cualquier momento
- R2: Al crear nueva party en seed existente → party anterior pasa a IA_INHERITED
- R4: Máximo 2 IA_INHERITED. La tercera elimina la más débil
- R10: Misma seed existente → flujo de Unificación

---

# SPRINT 7 — IA Avanzada, Esencias y Ascensión
> **Prerrequisito:** Sprint 6 completo

## 7A — `aiMemoryService.ts` + `aiProfileEngine.ts`

Ver `plan/sprints/09_IA_AVANZADA.md`.

La IA con memoria recuerda interacciones pasadas: si el jugador la atacó antes, cambia su perfil. El motor de perfiles traduce el historial en decisiones estratégicas.

## 7B — `essenceService.ts` + `essenceRepository.ts` + Migration v13

Ver `plan/sprints/13_SISTEMA_ESENCIAS.md` para implementación completa.

Puntos clave:
- Las esencias tienen ID determinístico: `${seedHash}_essence_${definitionId}_${cycle}_${floor}`
- `INSERT OR IGNORE` en essenceRepository para idempotencia (RT-09)
- Los slots se desbloquean por nivel: nivel 5 → 1 slot, nivel 9 → 2 slots, etc.
- `CombatResult.essenceDrops` debe estar sincronizado entre combatEngine y essenceService (NI-06)

## 7C — `AscensionScreen.tsx`

Solo accesible cuando un personaje supera el nivel 20 (que se activa en Sprint 7 junto con esencias). La ascensión es irreversible y da poder masivo pero altera el balance de la party.

---

# Orden de implementación recomendado — Resumen

```
4C  → Sistema Narrativo Emocional (aditivo, sin dependencias)
5A  → PRNG centralizado (PRIMERO, bloquea todo lo demás)
5B  → Sistema temporal (timeService + CycleTransition real)
5C  → worldSimulator (el más crítico del Sprint 5)
6A  → Migrations v8–v12 + CharacterSave canónico + repositories
6B  → economyService + lootService + revivir con costo
6C  → progressionService + XP + herencia
6D  → moralSystem + bountyService + GuildScreen
6E  → encounterService + safeZoneService + CampScreen
6F  → allianceService + AllianceScreen
6G  → seedUnificationService + cierre de temporada
7A  → aiMemoryService + aiProfileEngine
7B  → essenceService + migration v13
7C  → AscensionScreen
```

---

## Reglas de código para todo el equipo

| Regla | Detalle |
|-------|---------|
| PRNG | Siempre `import { makePRNG } from '../utils/prng'` — nunca inline |
| CharacterSave | Añadir campos solo en `gameRepository.ts` (NI-02) |
| DB writes | Múltiples operaciones relacionadas → dentro de transacción |
| Barrel | Cada nuevo servicio → añadir a `services/index.ts` |
| Level cap | `MAX_LEVEL_MVP = 10` en Sprint 6; `MAX_LEVEL_FULL = 20` en Sprint 7 |
| AIProfile | 5 valores: `AGGRESSIVE \| DEFENSIVE \| OPPORTUNISTIC \| EXPANSIONIST \| SURVIVALIST` |
| Funciones | Exportar funciones puras sin side effects cuando sea posible |
