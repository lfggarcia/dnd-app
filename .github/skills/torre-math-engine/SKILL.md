---
name: torre-math-engine
description: TORRE exact math formulas and simulation algorithms — hit chance, damage, initiative, XP, floor scaling, bounty scaling, revive cost, party encounter probability, and the full AI simulation algorithm. Use when implementing combat math, balancing stats, writing simulation engine functions, or verifying formulas are correct. Keywords: fórmulas, formulas, math, hit, damage, XP, initiative, scaling, probabilidad, simulation, cálculo.
argument-hint: [formula: "hit chance" | "damage" | "XP" | "initiative" | "bounty scaling" | "revive cost" | "encounter probability" | "monster scaling"]
---

# TORRE — Fórmulas Matemáticas Exactas y Motor de Simulación

---

## Principios Generales

- Todas las fórmulas son **determinísticas**.
- Usan **seed** como fuente de aleatoriedad — nunca `Math.random()`.
- Tienen **límites (clamps)** para evitar explosión exponencial.
- Mismo input → mismo resultado garantizado.

```typescript
// Plantilla de uso
Result = Clamp(Formula, Min, Max)

// Random con seed
function roll(seed: string, context: string): number {
  return deterministicRandom(seed + context); // 0.0 a 1.0
}
```

---

## 1. Hit Chance (Acierto en Combate)

```typescript
function calcHitChance(
  attackerAttackStat: number,
  proficiencyBonus: number,
  targetDefenseStat: number
): number {
  const raw = BASE_ACCURACY
    + (attackerAttackStat * 0.5)
    + proficiencyBonus
    - (targetDefenseStat * 0.4);
  
  return Math.min(0.95, Math.max(0.05, raw));  // Clamp 5%–95%
}

// Resolución
const hit = roll(seed, 'attack') <= hitChance;
```

---

## 2. Daño Exacto

```typescript
function calcDamage(
  weaponBaseDamage: number,
  attackerMainStat: number,
  bonusDamage: number,
  targetArmor: number,
  isCritical: boolean,
  hasResistance: boolean,
  hasVulnerability: boolean
): number {
  const raw = weaponBaseDamage + (attackerMainStat * 1.2) + bonusDamage;
  let dmg = Math.max(1, raw - (targetArmor * 0.3));

  if (isCritical)       dmg *= 2;
  if (hasResistance)    dmg *= 0.5;
  if (hasVulnerability) dmg *= 1.5;

  return Math.floor(dmg);
}
```

---

## 3. Iniciativa

```typescript
function rollInitiative(
  actors: CombatActor[],
  seed: string
): CombatActor[] {
  return actors
    .map(a => ({ ...a, initiative: a.stats.DEX + roll(seed, a.id) * 20 }))
    .sort((a, b) => b.initiative - a.initiative);
}
```

---

## 4. XP Exacta

```typescript
function calcXP(
  enemyLevel: number,
  playerLevel: number,
  enemyAlreadyDefeated: boolean,
  floorNumber: number
): number {
  const levelDiff = playerLevel - enemyLevel;
  if (levelDiff > 5) return 0;

  const baseXP = enemyLevel * 50;
  const xp = enemyAlreadyDefeated
    ? baseXP * 0.5
    : baseXP * (1 + enemyLevel / playerLevel);

  const floorMultiplier = 1 + (floorNumber * 0.05);
  return Math.max(10, Math.floor(xp * floorMultiplier));
}
```

- ❌ XP = 0 si diferencia de nivel > 5 (anti-farm de pisos bajos).
- ❌ XP = 0 por matar otras parties.
- Bonus de piso: +5% por piso (incentiva exploración vertical).

---

## 5. Escalado de Monstruos por Piso

```typescript
function scaleMonsterStats(baseStats: MonsterStats, floor: number): MonsterStats {
  return {
    hp:     Math.floor(baseStats.hp     * (1 + floor * 0.07)),
    damage: Math.floor(baseStats.damage * (1 + floor * 0.05)),
    // resto de stats sin escalar agresivamente
  };
}
```

---

## 6. Bounty Scaling

```typescript
function calcBountyMultiplier(violenceScore: number): number {
  const threatLevel = violenceScore * 0.3;
  return 1 + (threatLevel * 0.2);
}
// Impacto: mayor probabilidad de emboscada, IA prioriza atacar, recompensa mayor
```

---

## 7. Costo de Revivir

```typescript
const REVIVE_BASE = 100;

function reviveCost(characterLevel: number, deathCount: number): number {
  const base = REVIVE_BASE * characterLevel;
  return deathCount > 0 ? base * (1 + deathCount * 0.15) : base;
}
// Genera desgaste económico progresivo
```

---

## 8. Probabilidad de Encuentro entre Parties

```typescript
function calcEncounterChance(
  partyNoiseLevel: number,
  floorDensity: number
): number {
  const BASE = 0.10;
  const raw = BASE + (partyNoiseLevel * 0.2) + (floorDensity * 0.1);
  return Math.min(0.60, Math.max(0.05, raw));  // Clamp 5%–60%
}
// Si roll <= encounterChance → evento de encuentro activado
```

---

## 9. Poder de Party (Party Power Score)

```typescript
function calcPartyPower(party: Party): number {
  return party.characters.reduce((sum, char) => {
    return sum + char.level * statWeight(char.stats) * equipmentFactor(char);
  }, 0);
}

function calcVictoryProbability(
  partyPower: number,
  enemyPower: number,
  floor: number,
  isNight: boolean
): number {
  const riskFactor = floor * 0.05 * (isNight ? 1.3 : 1.0);
  return partyPower / (partyPower + enemyPower * riskFactor);
}
```

---

## 10. Utilidad de Decisión IA

```typescript
function calcActionUtility(
  action: AIAction,
  weights: StrategyWeights,
  noise: number  // deterministicRandom(seed + cycle) * 0.1
): number {
  const base = (action.expectedReward * weights.reward)
    - (action.expectedRisk  * weights.risk)
    - (action.resourceCost  * weights.cost)
    + (action.strategicValue * weights.strategic);
  
  return base * (1 + noise);
}
```

---

## Performance del Motor

Para 10 parties × 60 ciclos:
- Simular solo hasta `targetCycle` (no recalcular ciclos pasados).
- Guardar **checkpoints** de simulación por ciclo (`PartyStateSnapshot`).
- Evitar loops por individuo — calcular en vectores cuando sea posible.
- Costo computacional esperado: **bajo** (cálculos aritméticos simples).

---

## Archivos Relacionados

| Archivo | Propósito |
|---|---|
| `src/services/combatEngine.ts` | Implementación de hit/damage/initiative |
| `src/services/simulationEngine.ts` | Motor de simulación AI + ciclos |
| `src/services/xpService.ts` | Cálculo de XP y escalado |
| `src/services/aiDecisionEngine.ts` | UtilityScore y decision engine |
| `src/services/economyService.ts` | ReviveCost, BountyMultiplier |

---

## Resumen de Constantes

```typescript
const COMBAT = {
  HIT_MIN: 0.05,        // 5%  clamp mínimo
  HIT_MAX: 0.95,        // 95% clamp máximo
  CRIT_MULTIPLIER: 2.0,
  RESISTANCE_MULT: 0.5,
  VULNERABILITY_MULT: 1.5,
  MIN_DAMAGE: 1,
};

const XP = {
  BASE_PER_LEVEL: 50,
  FLOOR_BONUS_RATE: 0.05,
  REPEAT_PENALTY: 0.5,
  MAX_LEVEL_DIFF: 5,
  MIN_XP: 10,
};

const ECONOMY = {
  REVIVE_BASE: 100,
  DEATH_PENALTY_RATE: 0.15,
};

const ENCOUNTER = {
  BASE_CHANCE: 0.10,
  MIN: 0.05,
  MAX: 0.60,
};

const SCALING = {
  MONSTER_HP_RATE:  0.07,  // por piso
  MONSTER_DMG_RATE: 0.05,  // por piso
};
```
