---
name: torre-ai-system
description: TORRE AI system for NPC parties — strategy layers, decision engine, moral pressure, bounty system, advanced AI with memory, cultural evolution, and strategic mutation. Use when working on AI party simulation, bounty logic, moral consequences, or the simulation engine. Keywords: IA, AI, simulación, bounty, moral, parties, decision engine, evolución, memoria.
argument-hint: [feature: "AI simulate" | "bounty system" | "moral conflict" | "AI decision" | "advanced AI evolution"]
---

# TORRE — Sistema de IA, Moral y Bounty

---

## Arquitectura de IA — 4 Capas

La IA toma decisiones combinando 4 capas:

```
Capa 1: Evaluación Estadística   →  PowerScore, RiskLevel, ResourceLevel
Capa 2: Memoria Histórica        →  últimos 20 ciclos, 10 combates
Capa 3: Perfil Estratégico       →  Aggressive | Defensive | Opportunistic | Survivalist
Capa 4: Ruido Controlado         →  StrategyNoise = Random(seed+cycle) × 0.1
```

---

## Flujo de Simulación de una Party IA

```typescript
function simulateParty(party: AIParty, targetCycle: number): void {
  while (party.cycleProgress < targetCycle) {
    evaluateState(party);    // calcula PowerScore, RiskLevel, MoralPressure
    decideAction(party);     // Decision Engine → UtilityScore por acción
    executeAction(party);    // ejecuta acción seleccionada
    updateCycle(party);      // incrementa cycleProgress
  }
}
```

---

## Decision Engine — Utilidad por Acción

Acciones posibles: `Explore | FightMonster | HuntParty | AvoidCombat | Rest | AdvanceFloor`

```typescript
UtilityScore =
  (ExpectedReward × WeightReward) -
  (ExpectedRisk × WeightRisk) -
  (ResourceCost × WeightCost) +
  (StrategicValue × WeightStrategic);

// + StrategyNoise para impedir predictibilidad total
FinalUtility = BaseUtility * (1 + Random(seed + cycle) * 0.1);
```

La acción con mayor `FinalUtility` se ejecuta. El empate se resuelve por seed.

---

## Evaluación de Estado

```typescript
PowerScore = Σ(CharacterLevel × StatWeight × EquipmentFactor)
RiskLevel  = currentFloor × 0.05
           + (bountyActive ? bountyMultiplier : 0)

MoralPressure: si party ataca frecuentemente otras parties → tensión interna
FloorDanger: piso > 50 dobla peso de riesgo
```

---

## Perfiles Estratégicos

Asignados al crear la party IA, afectan los pesos:

| Perfil | Modificaciones |
|---|---|
| Aggressive | WeightHunt +30%, WeightRest -20% |
| Defensive | WeightAvoid +30%, WeightFight -20% |
| Opportunistic | Reacciona al meta actual |
| Expansionist | Prioriza AdvanceFloor |
| Survivalist | Prioriza Rest, huida habilitada |

---

## Memoria Histórica

```typescript
interface MemoryState {
  aggressionScore: number;
  survivalRate: number;
  preferredActions: string[];
  enemyPatterns: Record<string, number>;
}
// últimos 20 ciclos + 10 combates almacenados
```

La IA **adapta** sus pesos según historial:
- Pierde frecuentemente → aumenta `AvoidCombat`, `Rest`.
- Gana frecuentemente → aumenta `HuntParty`, `AggressiveAdvance`.

---

## Sistema de Bounty

El bounty se activa cuando una party acumula comportamiento agresivo:

### Cálculo de Amenaza
```typescript
BountyThreatLevel  = partyViolenceScore × 0.3
BountyMultiplier   = 1 + (BountyThreatLevel × 0.2)
```

### Efectos del Bounty
- Se publica recompensa en el gremio.
- Otras parties IA priorizan atacarla.
- Mayor probabilidad de emboscada.
- Encuentra enemigos más difíciles.
- **El historial es permanente** — no desaparece.

---

## Moral Interna

Cada personaje tiene: `alineamiento, personalidad, tolerancia al riesgo, opinión sobre PvP`.

Si la party ataca frecuentemente otras parties:
- Se evalúa **tensión moral**.
- Miembros pueden **abandonar**.
- Si abandona → va al pool exclusivo del jugador (mismo nivel, no editable inicialmente).

---

## IA Avanzada — Evolución Cultural

Cada 10 ciclos, se recalcula `metaSeedTrend`:
- Qué estrategias dominan.
- Qué clases están fuertes.
- La IA ajusta pesos base ligeramente.

**Copia estratégica:** Si una estrategia externa supera umbral de rendimiento → IA adopta parcialmente.

**Mutación** (cada 15 ciclos, para IAs con bajo rendimiento):
```typescript
MutationFactor = Random(seed + cycle) × 0.05
// Modifica: perfil, pesos de utilidad, prioridad de acciones
```

---

## Simulación de Encuentro IA vs IA

```typescript
ProbabilityAWin = PowerA / (PowerA + PowerB);
const roll = deterministicRandom(seed);
// Si roll <= ProbabilityAWin → A gana
// Perdedor pierde miembros; Ganador obtiene loot parcial
// Posible aumento de bounty al ganador si ataca party más débil
```

---

## Archivos Relacionados

| Archivo | Propósito |
|---|---|
| `src/services/simulationEngine.ts` | Núcleo de simulación IA |
| `src/services/aiDecisionEngine.ts` | Decision engine + utilidades |
| `src/services/bountyService.ts` | Cálculo y efectos de bounty |
| `src/database/gameRepository.ts` | Persistencia de moral, bounty, memoria |
| `src/stores/gameStore.ts` | Estado global de parties IA |

---

## Anti-Patrones a Evitar

- ❌ No simular IA en tiempo real — solo por lotes.
- ❌ No usar `Math.random()` — siempre usar `deterministicRandom(seed)`.
- ❌ No ressetar el historial de violencia/bounty automáticamente.
- ❌ No homogeneizar todos los perfiles IA (destruye comportamiento emergente).
