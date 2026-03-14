# Code Review: Screens — CycleTransitionScreen, LevelUpScreen, UnificationScreen

**Revisado:** 2026-03-14  
**Severidad general:** 🟡 Observaciones menores (mismo patrón repetido)

---

## `src/screens/CycleTransitionScreen.tsx`

**Líneas:** ~80 | Severidad: 🟡

### [CR-058] `activeGame` completo — solo usa 2 propiedades 🟡

> **Línea:** 14  
> **Referencia audit:** PERF-001

```ts
const activeGame = useGameStore(s => s.activeGame);
const nextCycle     = route.params?.cycle ?? activeGame?.cycle ?? 1;
const previousFloor = activeGame?.floor ?? 1;
```

Solo usa `cycle` y `floor`. Propuesta:
```ts
const nextCycle     = route.params?.cycle ?? useGameStore(s => s.activeGame?.cycle ?? 1);
const previousFloor = useGameStore(s => s.activeGame?.floor ?? 1);
```

**Patrones positivos:** Sin eslint-disable, pantalla de transición pequeña (bajo impacto lógico).

---

## `src/screens/LevelUpScreen.tsx`

**Líneas:** ~120 | Severidad: 🟡

### [CR-059] `activeGame` completo — solo usa `partyData` 🟡

> **Línea:** 13  
> **Referencia audit:** PERF-001

```ts
const activeGame = useGameStore(s => s.activeGame);
const partyData  = activeGame?.partyData ?? [];
```

Propuesta:
```ts
const partyData = useGameStore(s => s.activeGame?.partyData ?? []);
```

**Patrones positivos:** Sin eslint-disable, lógica de level-up delegada a `confirmLevelUps` service.

---

## `src/screens/UnificationScreen.tsx`

**Líneas:** ~130 | Severidad: 🟡

### [CR-060] `activeGame` completo — necesita `id`, `seed`, `seedHash` 🟡

> **Línea:** 14  
> **Referencia audit:** PERF-001

```ts
const activeGame = useGameStore(s => s.activeGame);
// Usados: activeGame.id, activeGame.seed, activeGame.seedHash
```

UnificationScreen gestiona el evento de "unificación" del jugador con una party IA derrotada.
Necesita `id`, `seed`, y `seedHash` — tres propiedades. Granular es posible:
```ts
const gameId   = useGameStore(s => s.activeGame?.id ?? null);
const seed     = useGameStore(s => s.activeGame?.seed ?? '');
const seedHash = useGameStore(s => s.activeGame?.seedHash ?? '');
```

**Patrones positivos:** Lógica de navegación correcta — usa `endGame` al finalizar.
