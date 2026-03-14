# Code Review: `src/services/combatEngine.ts`

**Revisado:** 2026-03-14  
**Líneas de código:** 983  
**Severidad general:** 🟢 Bien implementado  
**Comentarios:** 3 observaciones

---

## Resumen

`combatEngine.ts` es el corazón del juego — implementa el sistema de combate DnD 5e con 
estado vivo (`LiveCombatState`), resolución de acciones, y construcción del resultado final.
El código es denso pero correcto. La arquitectura de funciones puras es buena para testing.
El principal problema es el tamaño (983 líneas) y la falta de separación entre el motor
puro y los tipos de datos.

---

## [CR-027] Pure functions para resolución de combate — excelente para testing ✅

> **Tipo:** Positivo  

```ts
export function resolvePlayerAttack(state: LiveCombatState, ...): LiveCombatState { ... }
export function resolveEnemyTurn(state: LiveCombatState, ...): LiveCombatState { ... }
export function buildCombatResultFromLive(state: LiveCombatState): CombatResult { ... }
```

Todas las funciones de resolución son puras — toman state y retornan nuevo state.
Esto hace que los tests sean directos (comparar input/output sin mocks). ✅

---

## [CR-028] `createCombatRNG` exportado — asegura determinismo ✅

> **Tipo:** Positivo  

```ts
export function createCombatRNG(seed: string): () => number { ... }
```

Exportar el generador de números aleatorios y pasarlo como parámetro (en lugar de usar
`Math.random()`) asegura que los combates son deterministas dado el mismo seed. Esto es
crítico para reproducir bugs y para testing. ✅

---

## [CR-029] 983 líneas — separar tipos, constantes, y engine

> **Tipo:** Arquitectura / Mantenibilidad  
> **Severidad:** 🟢 Baja

**Estructura actual (todo en combatEngine.ts):**
- Tipos (`LiveCombatState`, `LivePartyMember`, `LiveEnemy`, etc.)
- Constantes (`CLASS_ABILITIES`)
- Funciones de inicialización (`initCombat`, `generateEnemiesForRoom`)
- Funciones de resolución de turnos (`resolvePlayerAttack`, etc.)
- Función de resultado (`buildCombatResultFromLive`)

**Estructura propuesta:**
```
src/services/combat/
  types.ts           ← LiveCombatState, LiveEnemy, LivePartyMember, etc.
  constants.ts       ← CLASS_ABILITIES
  initCombat.ts      ← generateEnemiesForRoom, initCombat
  resolvers.ts       ← resolvePlayerAttack, resolveEnemyTurn, etc.
  result.ts          ← buildCombatResultFromLive
  index.ts           ← re-exports para compatibilidad hacia atrás
```

**Tiempo estimado:** 2-3 horas (reestructurar sin cambiar lógica)  
**Prioridad:** P3 — Antes de añadir más clases o habilidades
