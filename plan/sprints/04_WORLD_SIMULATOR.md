# 04 · MOTOR DE SIMULACIÓN (worldSimulator.ts)
> **Estado actual:** 0% — el archivo no existe
> **Sprint objetivo:** 5 (SIGUIENTE)
> **Archivo principal:** `src/services/worldSimulator.ts` (nuevo)
> **Este es el sistema más crítico del Sprint 5**

---

## Concepto

Cuando el jugador avanza ciclo, el mundo entero avanza. Todas las parties IA se procesan hasta el ciclo actual usando un motor determinístico basado en la seed. El resultado es una lista de `SimulationEvent[]` que alimenta el `WorldLogScreen` y el `CycleTransitionScreen`.

---

## Paso 1 — Tipos del simulador

```typescript
// src/services/worldSimulator.ts

import type { RivalEntry } from './rivalGenerator';
import type { SavedGame } from '../database/gameRepository';

// ─── Tipos públicos ────────────────────────────────────────

export type SimulationEventType =
  | 'AI_COMBAT_WIN'
  | 'AI_COMBAT_LOSS'
  | 'AI_FLOOR_ADVANCE'
  | 'AI_REST'
  | 'AI_ELIMINATED'
  | 'AI_PARTY_SPAWNED'
  | 'BOSS_KILLED'
  | 'ALLIANCE_FORMED'
  | 'BOUNTY_ISSUED';

export type SimulationEvent = {
  type: SimulationEventType;
  cycle: number;
  floor: number;
  partyName: string;
  targetName?: string;  // en combate: el perdedor
  summary: string;      // texto para WorldLogScreen
  summary_en: string;
};

export type SimulationResult = {
  updatedRivals: RivalEntry[];
  events: SimulationEvent[];
};

// ─── Estado interno por party IA ──────────────────────────

type AIPartyState = {
  entry: RivalEntry;
  cycleProgress: number;
  hp: number;          // porcentaje 0-100 (simplificado)
  gold: number;
  consecutiveLosses: number;
  profile: AIProfile;
};

type AIProfile = 'AGGRESSIVE' | 'DEFENSIVE' | 'OPPORTUNISTIC' | 'SURVIVALIST';
```

---

## Paso 2 — PRNG del simulador

```typescript
// Mismo algoritmo en todo el proyecto — consistencia determinística
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
    next(min: number, max: number): number {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return Math.floor(min + (s / 0x100000000) * (max - min + 1));
    },
    bool(probability: number): boolean {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return (s / 0x100000000) < probability;
    },
  };
}
```

---

## Paso 3 — Derivar perfil estratégico por seed

```typescript
/**
 * Cada party IA tiene un perfil fijo derivado de su nombre (seed-based).
 * SYSTEMS.MD: "Perfil base generado al inicio: Aggressive, Defensive, Opportunistic..."
 */
function deriveProfile(partyName: string, seedHash: string): AIProfile {
  const rng = makePRNG(`${seedHash}_profile_${partyName}`);
  const profiles: AIProfile[] = ['AGGRESSIVE', 'DEFENSIVE', 'OPPORTUNISTIC', 'SURVIVALIST'];
  return profiles[Math.floor(rng.float() * profiles.length)];
}

/**
 * Pesos de decisión según perfil.
 * SYSTEMS.MD: "Aggressive: WeightHunt += 30%, WeightRest -= 20%"
 */
function getProfileWeights(profile: AIProfile) {
  const base = {
    explore:       0.30,
    fightMonster:  0.25,
    huntParty:     0.10,
    avoidCombat:   0.15,
    rest:          0.10,
    advanceFloor:  0.10,
  };

  switch (profile) {
    case 'AGGRESSIVE':
      return { ...base, huntParty: 0.25, rest: 0.05, fightMonster: 0.35, avoidCombat: 0.05 };
    case 'DEFENSIVE':
      return { ...base, rest: 0.20, avoidCombat: 0.25, huntParty: 0.02, explore: 0.25 };
    case 'OPPORTUNISTIC':
      return { ...base, huntParty: 0.15, fightMonster: 0.30, advanceFloor: 0.20 };
    case 'SURVIVALIST':
      return { ...base, rest: 0.25, avoidCombat: 0.30, huntParty: 0.00, explore: 0.20 };
    default:
      return base;
  }
}
```

---

## Paso 4 — Motor de decisión de una party IA

```typescript
type AIAction = 'explore' | 'fightMonster' | 'huntParty' | 'avoidCombat' | 'rest' | 'advanceFloor';

/**
 * SYSTEMS.MD: "UtilityScore = (ExpectedReward × WeightReward) - (ExpectedRisk × WeightRisk) ..."
 * Decide la próxima acción de la party IA para este ciclo.
 */
function decideAction(
  state: AIPartyState,
  nearbyRivals: AIPartyState[],
  rng: ReturnType<typeof makePRNG>,
): AIAction {
  const weights = getProfileWeights(state.profile);

  // Modificar pesos según estado actual
  const adjustedWeights = { ...weights };

  // Si HP baja → priorizar descanso y evitar combate
  if (state.hp < 30) {
    adjustedWeights.rest += 0.30;
    adjustedWeights.huntParty = 0;
    adjustedWeights.fightMonster -= 0.15;
  }

  // Si no hay rivales cercanos → no puede cazar
  if (nearbyRivals.length === 0) {
    adjustedWeights.huntParty = 0;
  }

  // Si el piso es alto y HP es buena → tentar avance
  if (state.entry.floor > 20 && state.hp > 70) {
    adjustedWeights.advanceFloor += 0.10;
  }

  // Ruido controlado por seed (SYSTEMS.MD: "StrategyNoise = Random × 0.1")
  const noise = (rng.float() - 0.5) * 0.1;
  Object.keys(adjustedWeights).forEach(key => {
    adjustedWeights[key as AIAction] = Math.max(0, adjustedWeights[key as AIAction] + noise);
  });

  // Normalizar pesos
  const total = Object.values(adjustedWeights).reduce((s, v) => s + v, 0);
  const normalized = Object.fromEntries(
    Object.entries(adjustedWeights).map(([k, v]) => [k, v / total])
  ) as Record<AIAction, number>;

  // Seleccionar acción por ruleta ponderada
  const roll = rng.float();
  let cumulative = 0;
  for (const [action, weight] of Object.entries(normalized)) {
    cumulative += weight;
    if (roll <= cumulative) return action as AIAction;
  }

  return 'explore'; // fallback
}
```

---

## Paso 5 — Resolver cada acción

```typescript
function executeAction(
  state: AIPartyState,
  action: AIAction,
  nearbyRivals: AIPartyState[],
  rng: ReturnType<typeof makePRNG>,
  cycle: number,
  events: SimulationEvent[],
): AIPartyState {
  const updated = { ...state, entry: { ...state.entry } };

  switch (action) {
    case 'explore':
      // Ganar algo de HP e incrementar progreso
      updated.hp = Math.min(100, updated.hp + 5);
      break;

    case 'fightMonster': {
      // SYSTEMS.MD: "ProbabilidadVictoria = PartyPower / (PartyPower + EnemyPower × RiskFactor)"
      const partyPower = updated.entry.floor * 1.5 + updated.hp * 0.1;
      const enemyPower = updated.entry.floor * 1.2;
      const riskFactor = 1 + updated.entry.floor * 0.02;
      const winChance = partyPower / (partyPower + enemyPower * riskFactor);

      if (rng.bool(winChance)) {
        updated.hp = Math.max(20, updated.hp - 15);  // victoria con algo de daño
        updated.gold += updated.entry.floor * 10;
        updated.consecutiveLosses = 0;
        events.push({
          type: 'AI_COMBAT_WIN',
          cycle,
          floor: updated.entry.floor,
          partyName: updated.entry.name,
          summary: `${updated.entry.name} venció monstruos en Piso ${updated.entry.floor}`,
          summary_en: `${updated.entry.name} defeated monsters on Floor ${updated.entry.floor}`,
        });
      } else {
        updated.hp = Math.max(5, updated.hp - 35);  // derrota severa
        updated.consecutiveLosses++;
        events.push({
          type: 'AI_COMBAT_LOSS',
          cycle,
          floor: updated.entry.floor,
          partyName: updated.entry.name,
          summary: `${updated.entry.name} fue derrotada en Piso ${updated.entry.floor}`,
          summary_en: `${updated.entry.name} was defeated on Floor ${updated.entry.floor}`,
        });
      }
      break;
    }

    case 'huntParty': {
      if (nearbyRivals.length === 0) break;
      const target = nearbyRivals[rng.next(0, nearbyRivals.length - 1)];

      // Combate abstracto party vs party
      const attackerPower = updated.entry.floor * 1.5 + updated.hp * 0.1;
      const defenderPower = target.entry.floor * 1.5 + target.hp * 0.1;
      const winChance = attackerPower / (attackerPower + defenderPower);

      if (rng.bool(winChance)) {
        updated.hp = Math.max(30, updated.hp - 20);
        updated.gold += Math.floor(target.gold * 0.3); // 30% del gold rival
        events.push({
          type: 'AI_COMBAT_WIN',
          cycle,
          floor: updated.entry.floor,
          partyName: updated.entry.name,
          targetName: target.entry.name,
          summary: `${updated.entry.name} eliminó a ${target.entry.name} en Piso ${updated.entry.floor}`,
          summary_en: `${updated.entry.name} eliminated ${target.entry.name} on Floor ${updated.entry.floor}`,
        });
      } else {
        updated.hp = Math.max(5, updated.hp - 40);
        updated.consecutiveLosses++;
      }
      break;
    }

    case 'rest':
      // Recuperación de HP, cuesta gold (posada)
      const restCost = 50 * Math.max(1, Math.floor(updated.entry.floor / 10));
      if (updated.gold >= restCost) {
        updated.hp = Math.min(100, updated.hp + 40);
        updated.gold -= restCost;
      } else {
        // Descanso gratuito pero menos efectivo
        updated.hp = Math.min(100, updated.hp + 15);
      }
      break;

    case 'advanceFloor': {
      // Solo avanza si HP es decente y tiene progreso suficiente
      if (updated.hp >= 50) {
        updated.entry.floor++;
        events.push({
          type: 'AI_FLOOR_ADVANCE',
          cycle,
          floor: updated.entry.floor,
          partyName: updated.entry.name,
          summary: `${updated.entry.name} avanzó al Piso ${updated.entry.floor}`,
          summary_en: `${updated.entry.name} advanced to Floor ${updated.entry.floor}`,
        });
      }
      break;
    }

    case 'avoidCombat':
      // No hacer nada — conservar recursos
      break;
  }

  // Verificar eliminación (HP <= 0 y sin gold para revivir)
  if (updated.hp <= 0) {
    updated.entry.status = 'defeated';
    events.push({
      type: 'AI_ELIMINATED',
      cycle,
      floor: updated.entry.floor,
      partyName: updated.entry.name,
      summary: `${updated.entry.name} fue eliminada`,
      summary_en: `${updated.entry.name} was eliminated`,
    });
  }

  return updated;
}
```

---

## Paso 6 — Función principal `simulateWorld`

```typescript
/**
 * ENTRY POINT PRINCIPAL — llamar desde gameStore.advanceCycle()
 *
 * Simula todas las parties IA desde su ciclo actual hasta targetCycle.
 * SYSTEMS.MD: "simulateWorld(playerCycle): procesa todas las parties IA hasta el ciclo actual"
 */
export async function simulateWorld(
  seedHash: string,
  targetCycle: number,
  activeGame: SavedGame,
): Promise<SimulationResult> {
  // Obtener rivals actuales
  const { generateRivals } = await import('./rivalGenerator');
  const rivals = generateRivals(activeGame.seedHash);

  const events: SimulationEvent[] = [];

  // Inicializar estado de cada party IA
  const aiStates: AIPartyState[] = rivals.map(rival => ({
    entry: { ...rival },
    cycleProgress: Math.max(1, rival.floor - 1),  // aproximación inicial
    hp: 100 - rival.floor * 2,                    // parties más avanzadas = más dañadas
    gold: rival.floor * 50,
    consecutiveLosses: 0,
    profile: deriveProfile(rival.name, seedHash),
  }));

  // Simular ciclo por ciclo (SYSTEMS.MD: "procesamiento por lotes")
  for (let cycle = 1; cycle <= targetCycle; cycle++) {
    const rng = makePRNG(`${seedHash}_world_${cycle}`);

    for (let i = 0; i < aiStates.length; i++) {
      const state = aiStates[i];
      if (state.entry.status === 'defeated') continue;

      // Parties cercanas para contexto de "caza"
      const nearbyRivals = aiStates.filter((other, j) =>
        j !== i &&
        other.entry.status !== 'defeated' &&
        Math.abs(other.entry.floor - state.entry.floor) <= 3
      );

      // Decidir y ejecutar acción para este ciclo
      const action = decideAction(state, nearbyRivals, rng);
      aiStates[i] = executeAction(state, action, nearbyRivals, rng, cycle, events);
    }

    // Regenerar parties eliminadas (SYSTEMS.MD: "Si slots disponibles → generar nueva IA nivel 1")
    const eliminatedCount = aiStates.filter(s => s.entry.status === 'defeated').length;
    if (eliminatedCount > 0 && aiStates.length < 10) {
      // TODO: generar party nueva en Sprint 6
    }
  }

  // Construir RivalEntry[] actualizado
  const updatedRivals: RivalEntry[] = aiStates.map(s => ({
    ...s.entry,
    floor: s.entry.floor,
    rep: Math.min(100, s.entry.rep + s.consecutiveLosses * 5),
  }));

  // Filtrar solo eventos relevantes (los últimos 20, máximo)
  const relevantEvents = events.slice(-20);

  return { updatedRivals, events: relevantEvents };
}
```

---

## Paso 7 — Persistir eventos en `WorldLogScreen`

```typescript
// src/screens/WorldLogScreen.tsx — REEMPLAZAR LOG_ENTRIES mock

import { useGameStore } from '../stores/gameStore';

export const WorldLogScreen = ({ navigation }: ScreenProps<'WorldLog'>) => {
  const { t, lang } = useI18n();
  const lastEvents = useGameStore(s => s.lastSimulationEvents);
  const activeGame = useGameStore(s => s.activeGame);

  // Mapear SimulationEvent[] a LogEntry para la UI existente
  const logEntries: LogEntry[] = useMemo(() => {
    if (!lastEvents || lastEvents.length === 0) {
      return [{ cycle: 1, type: 'SYSTEM', message_en: 'No events yet', message_es: 'Sin eventos aún' }];
    }

    return lastEvents.map(event => ({
      cycle: event.cycle,
      type: mapEventType(event.type),  // ver abajo
      message_en: event.summary_en,
      message_es: event.summary,
    }));
  }, [lastEvents]);

  // ...resto del componente sin cambios...
};

function mapEventType(type: SimulationEventType): LogFilter {
  if (type.includes('COMBAT') || type.includes('ELIMINATED')) return 'COMBAT';
  if (type.includes('BOSS')) return 'COMBAT';
  if (type.includes('ALLIANCE') || type.includes('BOUNTY')) return 'LORE';
  return 'SYSTEM';
}
```

---

## Checklist de implementación

- [ ] Crear `src/services/worldSimulator.ts` completo (Pasos 1-6)
- [ ] Añadir `lastSimulationEvents` al `gameStore.ts`
- [ ] Añadir `advanceCycle()` al `gameStore.ts` que llama `simulateWorld`
- [ ] `WorldLogScreen`: reemplazar `LOG_ENTRIES` con `lastSimulationEvents` del store (Paso 7)
- [ ] `CycleTransitionScreen`: mostrar eventos reales (ver doc 01)
- [ ] Tests: `simulateWorld` con seed fija debe producir siempre los mismos eventos
- [ ] Benchmark: simular 10 parties × 60 ciclos debe completarse en < 100ms

---

## ACTUALIZACIÓN v2 — Integridad con docs 09 y 13

### AIProfile — añadir EXPANSIONIST (doc 09)

```typescript
// src/services/worldSimulator.ts — actualizar tipo AIProfile

// ANTES (4 perfiles):
type AIProfile = 'AGGRESSIVE' | 'DEFENSIVE' | 'OPPORTUNISTIC' | 'SURVIVALIST';

// AHORA (5 perfiles — sincronizado con doc 09 aiProfileEngine.ts):
type AIProfile = 'AGGRESSIVE' | 'DEFENSIVE' | 'OPPORTUNISTIC' | 'EXPANSIONIST' | 'SURVIVALIST';

// EXPANSIONIST: advanceFloor weight = 0.30 (el más alto) — siempre quiere avanzar piso
// Ver doc 09 Paso 2 para los pesos completos de cada perfil.
```

### calculatePartyPower — incluir bonus de esencias (doc 13)

```typescript
// src/services/encounterService.ts (o worldSimulator.ts donde esté)

export function calculatePartyPower(party: CharacterSave[], gameId?: string): number {
  return party
    .filter(c => c.alive)
    .reduce((total, c) => {
      const avgStat = (c.baseStats.STR + c.baseStats.DEX + c.baseStats.CON +
                       c.baseStats.INT + c.baseStats.WIS + c.baseStats.CHA) / 6;
      const level  = c.level ?? 1;
      const statMult = avgStat / 10;

      // Bonus de esencias al power score (Solo si gameId disponible — Sprint 7+)
      const essenceBonus = gameId
        ? getEquippedEssences(c.name, gameId)
            .reduce((s, e) => s + getEssencePowerScore(e), 0) * 0.1
        : 0;

      // Ascensión añade multiplicador
      const ascensionMult = c.isAscended ? 1.15 : 1.0;

      return total + (level * statMult * ascensionMult) + essenceBonus;
    }, 0);
}

// Para parties IA en piso 30+: estimar bonus de esencias sin DB
function estimateEssenceBonusForFloor(floor: number, rng: ReturnType<typeof makePRNG>): number {
  if (floor < 15) return 0;
  if (floor < 30) return rng.float() * 2;
  return 2 + rng.float() * 5;  // pisos altos: esencias épicas estimadas
}
```

### Checklist adicional (v2)
- [ ] Actualizar `AIProfile` type para incluir `EXPANSIONIST`
- [ ] Añadir `EXPANSIONIST` a `deriveProfile()` (o delegarlo a `aiProfileEngine.ts` de doc 09)
- [ ] `calculatePartyPower()`: añadir `essenceBonus` cuando `gameId` esté disponible
- [ ] `simulateWorld()`: usar `estimateEssenceBonusForFloor()` para parties IA en piso 30+
- [ ] Importar `makePRNG` desde `src/utils/prng.ts` — eliminar definición inline
