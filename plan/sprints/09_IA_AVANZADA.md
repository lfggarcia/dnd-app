# 09 · IA AVANZADA — MEMORIA, PERFILES Y EVOLUCIÓN CULTURAL
> **Estado actual:** 0% — es el sistema más ambicioso del proyecto
> **Sprint objetivo:** 7 (post-release MVP)
> **Archivo principal:** `src/services/aiMemoryService.ts` (nuevo), actualizar `worldSimulator.ts`
> **Prerequisito:** Doc 04 (worldSimulator.ts) completamente implementado

---

## Concepto

La IA de Sprint 5 (worldSimulator.ts básico) es determinística pero sin memoria. Este sistema la hace adaptativa: cada party IA recuerda sus últimas 20 decisiones, aprende de victorias y derrotas, copia estrategias exitosas, y muta cada 15 ciclos. El resultado es un ecosistema que evoluciona dentro de la seed.

---

## Componentes del Sistema

```
worldSimulator.ts (doc 04)
    ↑ integra
    ├── aiMemoryService.ts       ← Memoria histórica (este doc)
    ├── aiProfileEngine.ts       ← Perfiles estratégicos (este doc)
    └── culturalEvolution.ts     ← Copia y mutación (este doc)
```

---

## Paso 1 — Estructura de memoria por party IA

Crear `src/services/aiMemoryService.ts`:

```typescript
/**
 * aiMemoryService.ts
 * Gestiona la memoria histórica de cada party IA.
 * SYSTEMS.MD: "Cada party IA guarda últimos 20 ciclos de decisiones,
 * últimos 10 combates, historial de victorias/derrotas, tendencias de enemigos."
 */

// ─── Types ────────────────────────────────────────────────

export type CombatMemory = {
  cycle: number;
  opponentFloor: number;
  outcome: 'WIN' | 'LOSS';
  hpLost: number;          // % HP perdido (0-100)
  reward: number;          // XP/gold ganado
};

export type DecisionMemory = {
  cycle: number;
  action: string;          // AIAction del worldSimulator
  outcome: 'positive' | 'negative' | 'neutral';
  efficiencyScore: number; // Reward / RiskCost
};

export type AIMemoryState = {
  partyName: string;
  recentDecisions: DecisionMemory[];   // últimas 20
  recentCombats: CombatMemory[];       // últimos 10
  totalWins: number;
  totalLosses: number;
  winStreak: number;
  lossStreak: number;
  /** Acciones que históricamente producen mejor resultado */
  preferredActions: Record<string, number>;  // action → avgEfficiency
  /** Tipos de oponentes que ha vencido frecuentemente */
  enemyPatterns: Record<string, number>;     // enemy type → kill count
};

// ─── PRNG (consistente con el resto del proyecto) ─────────

function makePRNG(seed: string) {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(h, 33) ^ seed.charCodeAt(i)) >>> 0;
  }
  let s = h >>> 0;
  return {
    float(): number {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 0x100000000;
    },
  };
}

// ─── Gestión de memoria ───────────────────────────────────

const MAX_DECISIONS = 20;
const MAX_COMBATS   = 10;

export function createMemory(partyName: string): AIMemoryState {
  return {
    partyName,
    recentDecisions: [],
    recentCombats: [],
    totalWins: 0,
    totalLosses: 0,
    winStreak: 0,
    lossStreak: 0,
    preferredActions: {},
    enemyPatterns: {},
  };
}

/**
 * Registra una decisión y su resultado.
 * SYSTEMS.MD: "EfficiencyScore = Reward / RiskCost"
 */
export function recordDecision(
  memory: AIMemoryState,
  action: string,
  reward: number,
  riskCost: number,
): AIMemoryState {
  const efficiencyScore = riskCost > 0 ? reward / riskCost : reward;
  const outcome = efficiencyScore > 1.2 ? 'positive' : efficiencyScore < 0.5 ? 'negative' : 'neutral';

  const newDecision: DecisionMemory = {
    cycle: memory.recentDecisions.length + 1, // aproximado
    action,
    outcome,
    efficiencyScore,
  };

  // Mantener solo las últimas 20 decisiones
  const updated = [newDecision, ...memory.recentDecisions].slice(0, MAX_DECISIONS);

  // Actualizar pesos de acciones preferidas (media móvil)
  const currentAvg = memory.preferredActions[action] ?? 1.0;
  const newAvg = currentAvg * 0.7 + efficiencyScore * 0.3;  // EMA con alpha=0.3

  return {
    ...memory,
    recentDecisions: updated,
    preferredActions: { ...memory.preferredActions, [action]: newAvg },
  };
}

/**
 * Registra el resultado de un combate.
 */
export function recordCombat(
  memory: AIMemoryState,
  cycle: number,
  opponentFloor: number,
  outcome: 'WIN' | 'LOSS',
  hpLost: number,
  reward: number,
): AIMemoryState {
  const newCombat: CombatMemory = { cycle, opponentFloor, outcome, hpLost, reward };
  const updatedCombats = [newCombat, ...memory.recentCombats].slice(0, MAX_COMBATS);

  const isWin = outcome === 'WIN';

  return {
    ...memory,
    recentCombats: updatedCombats,
    totalWins:    isWin ? memory.totalWins + 1 : memory.totalWins,
    totalLosses:  !isWin ? memory.totalLosses + 1 : memory.totalLosses,
    winStreak:    isWin ? memory.winStreak + 1 : 0,
    lossStreak:   !isWin ? memory.lossStreak + 1 : 0,
  };
}

/**
 * Calcula los pesos adaptativos basados en el historial.
 * SYSTEMS.MD: "Si la IA pierde frecuentemente → Aumenta peso AvoidCombat/Rest.
 *              Si gana frecuentemente → Aumenta peso HuntParty/AggressiveAdvance."
 */
export function getAdaptiveWeights(memory: AIMemoryState): Record<string, number> {
  const recentWinRate = memory.recentCombats.length > 0
    ? memory.recentCombats.filter(c => c.outcome === 'WIN').length / memory.recentCombats.length
    : 0.5;

  const adaptations: Record<string, number> = {};

  // Alta tasa de victorias → más agresivo
  if (recentWinRate > 0.7 || memory.winStreak >= 3) {
    adaptations.huntParty = +0.15;
    adaptations.fightMonster = +0.10;
    adaptations.rest = -0.10;
  }

  // Alta tasa de derrotas → más defensivo
  if (recentWinRate < 0.3 || memory.lossStreak >= 2) {
    adaptations.avoidCombat = +0.20;
    adaptations.rest = +0.15;
    adaptations.huntParty = -0.15;
    adaptations.fightMonster = -0.10;
  }

  // Incorporar preferencias históricas (refuerzo)
  for (const [action, efficiency] of Object.entries(memory.preferredActions)) {
    if (efficiency > 1.5) adaptations[action] = (adaptations[action] ?? 0) + 0.08;
    if (efficiency < 0.5) adaptations[action] = (adaptations[action] ?? 0) - 0.08;
  }

  return adaptations;
}
```

---

## Paso 2 — Motor de perfiles estratégicos

Crear `src/services/aiProfileEngine.ts`:

```typescript
/**
 * aiProfileEngine.ts
 * Perfiles estratégicos que determinan el estilo base de juego de cada party IA.
 * SYSTEMS.MD: "Profiles: Aggressive, Defensive, Opportunistic, Expansionist, Survivalist"
 */

export type AIProfile = 'AGGRESSIVE' | 'DEFENSIVE' | 'OPPORTUNISTIC' | 'EXPANSIONIST' | 'SURVIVALIST';

export type ProfileWeights = {
  explore:      number;
  fightMonster: number;
  huntParty:    number;
  avoidCombat:  number;
  rest:         number;
  advanceFloor: number;
};

// ─── Pesos base por perfil ────────────────────────────────

const PROFILE_WEIGHTS: Record<AIProfile, ProfileWeights> = {
  AGGRESSIVE: {
    explore:      0.20,
    fightMonster: 0.35,  // ← alto
    huntParty:    0.25,  // ← alto
    avoidCombat:  0.05,
    rest:         0.05,
    advanceFloor: 0.10,
  },
  DEFENSIVE: {
    explore:      0.25,
    fightMonster: 0.15,
    huntParty:    0.02,  // ← muy bajo
    avoidCombat:  0.28,  // ← alto
    rest:         0.20,  // ← alto
    advanceFloor: 0.10,
  },
  OPPORTUNISTIC: {
    explore:      0.25,
    fightMonster: 0.28,
    huntParty:    0.15,
    avoidCombat:  0.10,
    rest:         0.07,
    advanceFloor: 0.15,
  },
  EXPANSIONIST: {
    explore:      0.20,
    fightMonster: 0.25,
    huntParty:    0.08,
    avoidCombat:  0.10,
    rest:         0.07,
    advanceFloor: 0.30,  // ← alto — siempre quiere avanzar piso
  },
  SURVIVALIST: {
    explore:      0.20,
    fightMonster: 0.15,
    huntParty:    0.00,  // ← nunca caza parties
    avoidCombat:  0.30,  // ← máximo
    rest:         0.25,  // ← alto
    advanceFloor: 0.10,
  },
};

/**
 * Deriva el perfil de una party de forma determinística.
 * El mismo nombre + seed siempre produce el mismo perfil.
 */
export function deriveProfile(partyName: string, seedHash: string): AIProfile {
  let h = 5381;
  const key = `${seedHash}_profile_${partyName}`;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 33) ^ key.charCodeAt(i)) >>> 0;
  let s = h >>> 0;
  s = (Math.imul(1664525, s) + 1013904223) >>> 0;
  const f = s / 0x100000000;

  const profiles: AIProfile[] = ['AGGRESSIVE', 'DEFENSIVE', 'OPPORTUNISTIC', 'EXPANSIONIST', 'SURVIVALIST'];
  return profiles[Math.floor(f * profiles.length)];
}

/**
 * Obtiene los pesos base del perfil, aplicando adaptaciones de memoria.
 */
export function getProfileWeights(
  profile: AIProfile,
  adaptations: Record<string, number> = {},
): ProfileWeights {
  const base = { ...PROFILE_WEIGHTS[profile] };

  // Aplicar adaptaciones de memoria
  for (const [key, delta] of Object.entries(adaptations)) {
    if (key in base) {
      base[key as keyof ProfileWeights] = Math.max(0, base[key as keyof ProfileWeights] + delta);
    }
  }

  // Renormalizar
  const total = Object.values(base).reduce((s, v) => s + v, 0);
  if (total > 0) {
    for (const key of Object.keys(base)) {
      base[key as keyof ProfileWeights] /= total;
    }
  }

  return base;
}

/**
 * Mutar el perfil de una party (cada 15 ciclos, pocas IAs seleccionadas).
 * SYSTEMS.MD: "Mutación: Modifica el perfil estratégico, ajusta pesos, con límites para evitar caos."
 */
export function mutateProfile(
  profile: AIProfile,
  seedHash: string,
  partyName: string,
  cycle: number,
): AIProfile {
  let h = 5381;
  const key = `${seedHash}_mutation_${partyName}_${cycle}`;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 33) ^ key.charCodeAt(i)) >>> 0;
  let s = h >>> 0;
  s = (Math.imul(1664525, s) + 1013904223) >>> 0;
  const roll = s / 0x100000000;

  // SYSTEMS.MD: "No todas mutan — las con bajo rendimiento y pequeño % aleatorio"
  if (roll > 0.15) return profile;  // 85% no mutan

  // Mutar a un perfil adyacente (no salto total)
  const profiles: AIProfile[] = ['AGGRESSIVE', 'DEFENSIVE', 'OPPORTUNISTIC', 'EXPANSIONIST', 'SURVIVALIST'];
  const idx = profiles.indexOf(profile);
  const shift = roll < 0.075 ? -1 : 1;
  const newIdx = Math.max(0, Math.min(profiles.length - 1, idx + shift));

  return profiles[newIdx];
}
```

---

## Paso 3 — Evolución cultural (copia entre parties)

Crear `src/services/culturalEvolution.ts`:

```typescript
/**
 * culturalEvolution.ts
 * SYSTEMS.MD: "Las parties IA pueden observar y copiar estrategias exitosas."
 * Simula evolución de meta-estrategias dentro de la seed.
 */

import type { AIMemoryState } from './aiMemoryService';
import type { AIProfile } from './aiProfileEngine';

export type CulturalSnapshot = {
  partyName: string;
  profile: AIProfile;
  winRate: number;
  avgFloor: number;
  dominantAction: string;  // acción con mayor uso en las últimas decisiones
};

/**
 * SYSTEMS.MD: "Cada ciclo, la IA evalúa qué parties tuvieron mayor éxito."
 * Calcula un snapshot del estado de todas las parties activas.
 */
export function buildCulturalSnapshot(
  memories: Map<string, AIMemoryState>,
  floors: Map<string, number>,
  profiles: Map<string, AIProfile>,
): CulturalSnapshot[] {
  return Array.from(memories.entries()).map(([name, memory]) => {
    const totalCombats = memory.totalWins + memory.totalLosses;
    const winRate = totalCombats > 0 ? memory.totalWins / totalCombats : 0.5;
    const avgFloor = floors.get(name) ?? 1;

    // Acción dominante: la que más aparece en historial reciente
    const actionCounts: Record<string, number> = {};
    for (const d of memory.recentDecisions) {
      actionCounts[d.action] = (actionCounts[d.action] ?? 0) + 1;
    }
    const dominantAction = Object.entries(actionCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'explore';

    return {
      partyName: name,
      profile: profiles.get(name) ?? 'OPPORTUNISTIC',
      winRate,
      avgFloor,
      dominantAction,
    };
  });
}

/**
 * SYSTEMS.MD: "Si una estrategia supera umbral de rendimiento → la IA adopta parcialmente."
 * Retorna adaptaciones de pesos para una party específica basadas en el meta-actual.
 */
export function getCulturalAdaptations(
  partyName: string,
  snapshots: CulturalSnapshot[],
  seedHash: string,
  cycle: number,
): Record<string, number> {
  // Identificar la estrategia dominante (meta actual)
  const successfulSnapshots = snapshots.filter(s =>
    s.partyName !== partyName &&
    s.winRate > 0.65 &&
    s.avgFloor > 10
  );

  if (successfulSnapshots.length === 0) return {};

  // Calcular el "meta": qué acción domina entre los exitosos
  const metaActions: Record<string, number> = {};
  for (const snap of successfulSnapshots) {
    metaActions[snap.dominantAction] = (metaActions[snap.dominantAction] ?? 0) + 1;
  }
  const metaDominantAction = Object.entries(metaActions)
    .sort(([, a], [, b]) => b - a)[0]?.[0];

  if (!metaDominantAction) return {};

  // PRNG para determinar si esta party adopta la tendencia
  let h = 5381;
  const key = `${seedHash}_cultural_${partyName}_${cycle}`;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 33) ^ key.charCodeAt(i)) >>> 0;
  let s = h >>> 0;
  s = (Math.imul(1664525, s) + 1013904223) >>> 0;
  const roll = s / 0x100000000;

  // SYSTEMS.MD: "No copia todo. Solo copia un porcentaje."
  if (roll > 0.30) return {};  // 70% no se deja influenciar

  // Copiar parcialmente (boost +0.05 a la acción meta)
  return { [metaDominantAction]: 0.05 };
}

/**
 * SYSTEMS.MD: "Cuando varias parties adoptan la misma estrategia → se convierte en tendencia.
 *              Después de cierto tiempo → pierde efectividad → contra-meta."
 *
 * Detecta si el meta actual está "saturado" y retorna la acción counter-meta.
 */
export function detectMetaShift(
  snapshots: CulturalSnapshot[],
  cycle: number,
): { isSaturated: boolean; counterAction: string | null } {
  if (snapshots.length < 5) return { isSaturated: false, counterAction: null };

  // Contar cuántas parties usan la misma acción dominante
  const actionCounts: Record<string, number> = {};
  for (const snap of snapshots) {
    actionCounts[snap.dominantAction] = (actionCounts[snap.dominantAction] ?? 0) + 1;
  }

  const topAction = Object.entries(actionCounts).sort(([, a], [, b]) => b - a)[0];
  if (!topAction) return { isSaturated: false, counterAction: null };

  const dominanceRatio = topAction[1] / snapshots.length;

  if (dominanceRatio > 0.60) {
    // Meta saturada — el counter es la acción opuesta
    const counterMap: Record<string, string> = {
      huntParty:    'avoidCombat',
      avoidCombat:  'huntParty',
      fightMonster: 'rest',
      rest:         'fightMonster',
      advanceFloor: 'explore',
      explore:      'advanceFloor',
    };
    return {
      isSaturated: true,
      counterAction: counterMap[topAction[0]] ?? null,
    };
  }

  return { isSaturated: false, counterAction: null };
}
```

---

## Paso 4 — Integrar todo en worldSimulator.ts

```typescript
// src/services/worldSimulator.ts — actualizar executeAction para usar memoria

import { createMemory, recordDecision, recordCombat, getAdaptiveWeights } from './aiMemoryService';
import { deriveProfile, getProfileWeights, mutateProfile } from './aiProfileEngine';
import { buildCulturalSnapshot, getCulturalAdaptations, detectMetaShift } from './culturalEvolution';

// En el tipo AIPartyState — añadir:
type AIPartyState = {
  // ...campos existentes...
  memory: AIMemoryState;       // NUEVO
  profile: AIProfile;          // NUEVO
};

// En simulateWorld — inicialización extendida:
const aiStates: AIPartyState[] = rivals.map(rival => ({
  // ...campos existentes...
  profile: deriveProfile(rival.name, seedHash),
  memory: createMemory(rival.name),
}));

// En el loop de ciclos — añadir evolución cultural cada 10 ciclos:
for (let cycle = 1; cycle <= targetCycle; cycle++) {
  // Evolución cultural cada 10 ciclos
  if (cycle % 10 === 0) {
    const memories = new Map(aiStates.map(s => [s.entry.name, s.memory]));
    const floors = new Map(aiStates.map(s => [s.entry.name, s.entry.floor]));
    const profiles = new Map(aiStates.map(s => [s.entry.name, s.profile]));
    const snapshots = buildCulturalSnapshot(memories, floors, profiles);
    const metaShift = detectMetaShift(snapshots, cycle);

    for (let i = 0; i < aiStates.length; i++) {
      // Mutación cada 15 ciclos
      if (cycle % 15 === 0) {
        aiStates[i].profile = mutateProfile(aiStates[i].profile, seedHash, aiStates[i].entry.name, cycle);
      }

      // Adopción cultural
      const culturalAdapt = getCulturalAdaptations(
        aiStates[i].entry.name, snapshots, seedHash, cycle
      );

      // Los adaptativos también responden al counter-meta
      if (metaShift.isSaturated && metaShift.counterAction) {
        culturalAdapt[metaShift.counterAction] = (culturalAdapt[metaShift.counterAction] ?? 0) + 0.03;
      }
    }
  }

  for (let i = 0; i < aiStates.length; i++) {
    const state = aiStates[i];
    if (state.entry.status === 'defeated') continue;

    // Combinar pesos de perfil + adaptaciones de memoria
    const memAdaptations = getAdaptiveWeights(state.memory);
    const weights = getProfileWeights(state.profile, memAdaptations);

    // Decidir con pesos actualizados
    const action = decideActionWithWeights(state, nearbyRivals, rng, weights);

    // Ejecutar y registrar en memoria
    const { updatedState, reward, riskCost } = executeActionWithMetrics(state, action, ...);

    aiStates[i] = {
      ...updatedState,
      memory: recordDecision(state.memory, action, reward, riskCost),
    };
  }
}
```

---

## Checklist de implementación

- [ ] Crear `src/services/aiMemoryService.ts` (Paso 1)
- [ ] Crear `src/services/aiProfileEngine.ts` (Paso 2)
- [ ] Crear `src/services/culturalEvolution.ts` (Paso 3)
- [ ] Actualizar `worldSimulator.ts` para usar los 3 servicios (Paso 4)
- [ ] Añadir `AIPartyState.memory` y `AIPartyState.profile` al estado interno del simulador
- [ ] Test de regresión: mismo seed + mismo ciclo → mismos eventos (verificar que la memoria no rompe determinismo)
- [ ] Test de performance: 10 parties × 60 ciclos con memoria debe completarse en < 200ms
- [ ] Benchmark: comparar calidad de decisiones con/sin memoria (% de parties que llegan a piso 20+)

---

## Notas de diseño

> **El determinismo no se rompe.** La memoria se inicializa desde cero en cada llamada a `simulateWorld`. Dado que la seed es fija, los mismos ciclos siempre producen las mismas decisiones, que producen la misma memoria acumulada. El determinismo está garantizado porque el PRNG usa `seedHash + partyName + cycle` como semilla en cada operación.

> **La mutación no es caótica.** Solo el 15% de las parties mutan en cada ventana de 15 ciclos, y solo se mueven a un perfil adyacente. Esto evita que el ecosistema colapse en un solo perfil o se vuelva impredecible.

> **Counter-meta emergente.** Si el 60%+ de parties usa la misma estrategia, el sistema automáticamente incentiva la acción opuesta. Esto crea ciclos estratégicos que hacen cada seed única y rejugable.

---

## ACTUALIZACIÓN v2 — Integridad con docs 04, 12 y 08

### AIProfile: 5 perfiles (sincronizar con doc 04)

El tipo `AIProfile` en doc 04 (worldSimulator base) tenía 4 perfiles. Este doc (09) es la referencia completa con los 5:

```typescript
// Ya definido correctamente en este doc — confirmar que doc 04 se actualice:
export type AIProfile = 'AGGRESSIVE' | 'DEFENSIVE' | 'OPPORTUNISTIC' | 'EXPANSIONIST' | 'SURVIVALIST';
```

### inferProfileFromPlayerHistory (doc 12)

Doc 12 (Seed y Parties) define una función `inferProfileFromPlayerHistory()` que deriva el perfil de la IA heredada a partir del historial del jugador. Esta función DEBE integrarse en `aiProfileEngine.ts`:

```typescript
// src/services/aiProfileEngine.ts — añadir:

/**
 * Deriva el perfil de una party IA_INHERITED a partir del comportamiento histórico del jugador.
 * Llamado desde seedUnificationService cuando se crea una party heredada.
 * (Ver doc 12 Paso 2 — inferProfileFromPlayerHistory)
 */
export function inferProfileFromPlayerHistory(
  efficiencyRatio: number,  // floor alcanzado / ciclos usados
  pvpKills: number,
  bossKills: number,
): AIProfile {
  if (pvpKills >= 5)              return 'AGGRESSIVE';
  if (efficiencyRatio > 1.0)     return 'EXPANSIONIST';  // sube rápido = expansionista
  if (bossKills >= 3)            return 'OPPORTUNISTIC'; // caza bosses = oportunista
  if (efficiencyRatio < 0.5)     return 'SURVIVALIST';   // lento = superviviente
  return 'DEFENSIVE';
}
```

### PRNG compartido

```typescript
// src/services/aiMemoryService.ts, aiProfileEngine.ts, culturalEvolution.ts
// REEMPLAZAR makePRNG definido inline por:
import { makePRNG } from '../utils/prng';
```
