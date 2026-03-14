# Code Review: `src/services/worldSimulator.ts`

**Revisado:** 2026-03-14  
**Líneas de código:** 425  
**Severidad general:** 🟢 Bien implementado  
**Comentarios:** 3 observaciones (1🟡, 2✅)

---

## Resumen

Motor de simulación determinístico de parties IA. Simula ciclo a ciclo todas las parties IA
usando un PRNG semillado, un sistema de pesos adaptativo (`aiProfileEngine`), y memoria por
party (`aiMemoryService`). Lógica limpia y bien referenciada a SYSTEMS.MD. No hay accesos
a Zustand ni side effects externos — funciones puras con estado local por ciclo.

---

## [CR-041] `simulateWorld` re-genera rivals en cada llamada — ineficiencia menor 🟡

> **Línea:** 284  
> **Tipo:** Performance / Arquitectura

```ts
const { generateRivals } = await import('./rivalGenerator');
const rivals = generateRivals(activeGame.seedHash, activeGame.floor ?? 1, activeGame.cycle ?? 1);
```

**Problema:** Cada llamada a `simulateWorld` re-genera la lista de rivals desde cero usando el
seed. Aunque es determinístico, implica recalcular todos los rivals y luego simular todos los
ciclos desde `fromCycle`. El parámetro `fromCycle` permite optimizar simulaciones incrementales,
pero `rivals` siempre se recalcula — si `generateRivals` es costosa, esto puede ser un problema
en partidas avanzadas.

**Propuesta:** Considerar pasar `rivals` como parámetro (ya calculados por el caller):
```ts
export async function simulateWorld(
  seedHash: string,
  targetCycle: number,
  activeGame: SavedGame,
  fromCycle?: number,
  precomputedRivals?: RivalEntry[],   // ← opcional
): Promise<SimulationResult>
```

**Prioridad:** P4 — Solo optimizar si `generateRivals` demuestra ser un cuello de botella en profiling.

---

## [CR-042] `MAX_TOTAL_TIME_MS = 100` — time-limit guard correcto ✅

> **Línea:** 297  
> **Tipo:** Positivo — Performance

```ts
const MAX_TOTAL_TIME_MS = 100;
const simStartTime = Date.now();
// ...
if (Date.now() - simStartTime > MAX_TOTAL_TIME_MS) break;
```

El guard de 100ms previene que simulaciones largas bloqueen el JS thread (RT-01).
Esto es crítico para React Native, donde cualquier operación >16ms puede causar jank.
Implementación correcta.

---

## [CR-043] `calculatePartyPower` sigue SYSTEMS.MD fielmente ✅

> **Tipo:** Correctness

```ts
const avgStat = (STR + DEX + CON + INT + WIS + CHA) / 6;
return total + level * (avgStat / 10) * (isAscended ? 1.15 : 1.0);
```

La fórmula coincide exactamente con:
> SYSTEMS.MD: "PartyPower = Σ(level × avgStat/10 × ascensionMult)"

La constante `1.15` para ascendidos y el filtro `c.alive` son correctos.

---

## Patrones positivos adicionales

- ✅ Determinismo garantizado: `makePRNG(\`${seedHash}_world_${cycle}\`)` — seed único por ciclo
- ✅ Sin imports de Zustand — simulación completamente pura
- ✅ `executeAction` y `decideAction` son funciones puras que retornan nuevos estados (inmutabilidad)
- ✅ `fromCycle` permite reanudar simulación incremental sin recalcular todo desde ciclo 1
- ✅ Sistema de memoria por party (`aiMemoryService`) integrado correctamente
- ✅ RI-02 implementado: `forcedDefensiveCycles` previene guerras infinitas entre parties IA
- ✅ `events.slice(-20)` — protege la UI de recibir miles de eventos en partidas largas
