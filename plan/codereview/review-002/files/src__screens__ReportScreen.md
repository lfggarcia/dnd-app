# Code Review: `src/screens/ReportScreen.tsx`

**Revisado:** 2026-03-14  
**Líneas de código:** 267  
**Severidad general:** 🟢 Bien implementado  
**Comentarios:** 2 observaciones (1🟡, 1✅)

---

## Resumen

Pantalla de reporte post-combate — muestra resultados de la batalla, loot drops, XP, y
eventos de simulación IA. Usa selectores granulares de Zustand correctamente. Solo un
`eslint-disable` denotando una inicialización de loot que intencionalmente omite deps.

---

## [CR-053] `eslint-disable exhaustive-deps` en useEffect de loot — justificado con riesgo de double-run 🟡

> **Línea:** 78  
> **Tipo:** Hooks / Correctness  
> **Referencia audit:** PERF-003

```ts
useEffect(() => {
  if (outcome !== 'VICTORY' || !roomType || !activeGameId) return;
  // ... genera loot, crea items en DB, actualiza gold
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**Problema:** `[]` (array vacío) ejecuta el efecto solo una vez — intención: generar loot
solo al montar. Las deps reales (`outcome`, `roomType`, `activeGameId`, `gold`, `seedHash`, etc.)
están intencionalmente omitidas. El riesgo: si el componente re-monta (navegación idempotente),
el loot se genera dos veces y los items se duplican en DB.

**Propuesta:** Usar un `useRef` como guard o verificar si el loot ya existe antes de insertar:
```ts
const lootGeneratedRef = useRef(false);
useEffect(() => {
  if (lootGeneratedRef.current) return;
  lootGeneratedRef.current = true;
  // ... generate loot
}, [/* safe: deps needed */]);
```

**Prioridad:** P2 — Potencial duplicación de items en DB si el componente re-monta.

---

## [CR-054] Selectores granulares correctos ✅

> **Líneas:** 19–24  
> **Tipo:** Positivo — Performance

```ts
const activeFloor  = useGameStore(s => s.activeGame?.floor ?? 1);
const activeCycle  = useGameStore(s => s.activeGame?.cycle ?? 1);
const seedHash     = useGameStore(s => s.activeGame?.seedHash ?? '0');
const activeGameId = useGameStore(s => s.activeGame?.id ?? null);
const gold         = useGameStore(s => s.activeGame?.gold ?? 0);
```

Patrón de referencia — cada selector solo subscribe a la propiedad que necesita.
ReportScreen es un ejemplo positivo del selector pattern correcto, a diferencia de
GuildScreen, CampScreen, MapScreen, CharacterDetailScreen.

---

## Patrones positivos adicionales

- ✅ `BackHandler` cleanup correcto en `useEffect` — `return () => sub.remove()`
- ✅ Validación de `roomType` contra lista blanca antes de pasarlo a `generateRoomLoot`
- ✅ Boss loot con `isBossLootClaimed` check — evita duplicar loot único de boss
