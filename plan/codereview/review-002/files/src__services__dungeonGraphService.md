# Code Review: `src/services/dungeonGraphService.ts`

**Revisado:** 2026-03-14  
**Líneas de código:** 383  
**Severidad general:** 🟢 Excelente implementación  
**Comentarios:** 3 observaciones (1🟡, 2✅)

---

## Resumen

Generador de grafos de mazmorras deterministas. Produce pisos de 12–20 salas con layout
tipo DAG por capas, tipos distribuidos probabilísticamente, salas secretas, y mutaciones por
ciclo. La arquitectura es limpia: funciones puras, PRNG semillado por namespace, sin accesos
a Zustand ni DB. Uno de los archivos mejor implementados del proyecto.

---

## [CR-044] `rollGroupPerception` — `narratorHint` strings hardcodeados en español 🟡

> **Líneas:** 363–368  
> **Tipo:** i18n  
> **Referencia audit:** I18N-001

```ts
const hints = success
  ? [
      'Entras al piso… pero algo se siente diferente. El aire es más denso.',
      'Tus sentidos se agudizan. Algo ha cambiado aquí desde la última vez.',
      'El tiefling de tu party percibe movimiento inusual al fondo del corredor.',
    ]
  : undefined;
```

Los 3 hints de percepción están solo en español, sin versión inglesa. Dado que
`rollGroupPerception` retorna un `narratorHint?` que se mostraría en UI, afecta la
experiencia en inglés.

**Propuesta:**
```ts
// Pasar lang como parámetro, o retornar la clave y traducir en el caller:
narratorHint: hintKey  // e.g. 'dungeon.perception.hint1'
// Caller traduce con t()
```

**Prioridad:** P3 — No urgente, se muestra solo cuando perception roll pasa.

---

## [CR-045] `serializeExplorationState` — optimización single-pass correcta ✅

> **Línea:** 325  
> **Tipo:** Positivo — Performance

```ts
// Un solo recorrido para extraer visitadas y reveladas en lugar de cuatro pasadas
const visitedRoomIds: number[] = [];
const revealedRoomIds: number[] = [];
for (const r of floor.rooms) {
  if (r.visited) visitedRoomIds.push(r.id);
  if (r.revealed) revealedRoomIds.push(r.id);
}
```

El comentario documenta la razón de la optimización. El bucle único evita 4 pasadas con
`filter().map()`. Patrón correcto en funciones que se llaman en cada movimiento de sala.

---

## [CR-046] Algoritmo de generación de layout de grafo — diseño sólido ✅

> **Tipo:** Arquitectura positiva

```ts
// Estructura: START (capa 0) → capas medias → BOSS (última capa)
// Salas secretas en y > 0.93 — zona reservada, sin overlap con layout principal
// Conexiones: cada sala se conecta a 1–2 salas en la siguiente capa
// 40% de probabilidad de segunda conexión — branching controlado
```

El diseño por capas garantiza:
1. Siempre existe un camino de START a BOSS
2. El layout es visual (posiciones normalizadas 0–1)
3. Las salas secretas están visualmente separadas
4. El determinismo es perfecto: misma seed + floor siempre produce el mismo grafo

Destacable: `secretsSet = new Set<number>(secretIds)` para O(1) lookup en el `map`.
Uso de `makePRNG` namespaced por funcionalidad (`_dungeon_`, `_mutations_`, `_perception_`).

---

## Patrones positivos adicionales

- ✅ Todas las funciones son puras — sin side effects ni acceso a Zustand/DB
- ✅ `applyExplorationState` / `revealAdjacentRooms` / `applyFloorMutations` siguen el patrón immutable (retornan nuevo objeto)
- ✅ `mutationChance = min(0.1 × (cycle - 1), 0.6)` — cap en 60%, diseño consciente
- ✅ Tipos exportados (`RoomType`, `DungeonRoom`, `DungeonFloor`, `FloorExplorationState`, `PerceptionResult`) — API pública clara
- ✅ Comentarios de diseño en funciones públicas (JSDoc)
