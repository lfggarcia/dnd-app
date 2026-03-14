# Code Review: `src/screens/MainScreen.tsx`

**Revisado:** 2026-03-14  
**Líneas de código:** 330  
**Severidad general:** 🟡 Observaciones menores  
**Comentarios:** 3 observaciones (1🟡, 2✅)

---

## Resumen

Pantalla principal del juego — menú de inicio, boot sequence animado, load/delete de partidas.
Bien estructurada: `MENU_ITEMS` memoizado, callbacks estables, crash recovery para combate
interrumpido. Usa `activeGame` completo aunque solo accede a unas pocas propiedades.

---

## [CR-050] `activeGame` completo — 5 propiedades usadas, granular es posible 🟡

> **Línea:** 24  
> **Tipo:** Performance  
> **Referencia audit:** PERF-001

```ts
const activeGame = useGameStore(s => s.activeGame);
// Propiedades usadas:
// - activeGame !== null && activeGame.status === 'active'  (hasActive)
// - activeGame?.combatRoomId
// - activeGame.combatRoomType
// - activeGame?.location
// - activeGame.seed
// - activeGame.floor
// - activeGame.cycle
```

**Propuesta:**
```ts
const activeGame = useGameStore(s => s.activeGame);  // mantener para null-check en hasActive
// O bien, selector derivado:
const hasActive    = useGameStore(s => s.activeGame?.status === 'active' && s.activeGame !== null);
const combatRoomId = useGameStore(s => s.activeGame?.combatRoomId ?? null);
const activeSeed   = useGameStore(s => s.activeGame?.seed ?? '');
// etc.
```

MainScreen es la pantalla de inicio — solo está activa cuando NO hay juego en curso.
El impacto de re-renders es menor aquí (el usuario no juega mientras ve este menú).
Prioridad más baja que otros screens que están activos durante gameplay.

**Prioridad:** P4 — Bajo impacto real, refactorizar junto con los otros screens PERF-001.

---

## [CR-051] Crash recovery para combate interrumpido — diseño correcto ✅

> **Líneas:** 60–69  
> **Tipo:** Positivo — Robustez

```ts
if (activeGame?.combatRoomId != null) {
  // Crash recovery: a combat was in progress — go directly to Battle
  navigation.reset({
    index: 0,
    routes: [{ name: 'Battle', params: { roomId: activeGame.combatRoomId, roomType: ... } }],
  });
} else if (activeGame?.location === 'map') {
  navigation.reset({ index: 0, routes: [{ name: 'Map' }] });
} else {
  navigation.reset({ index: 0, routes: [{ name: 'Village' }] });
}
```

La lógica de recuperación de crash funciona correctamente: si el app se cierra durante combate,
al reiniciar y presionar "Continue" el usuario vuelve directamente a la sala donde estaba.

---

## [CR-052] Boot sequence con `useFocusEffect` + `hydrate` — patrón correcto ✅

> **Líneas:** 42–46  
> **Tipo:** Positivo

```ts
useFocusEffect(
  useCallback(() => {
    hydrate();
  }, [hydrate]),
);
```

Re-hidratar al ganar focus es el patrón correcto para reflejar cambios cuando el usuario
vuelve a la MainScreen después de jugar (e.g. partida terminada). `hydrate` está memoizado
en Zustand, por lo que el callback es estable.

---

## Patrones positivos adicionales

- ✅ Sin eslint-disable
- ✅ Solo 1 ternario `lang === 'es'` — el toggle de idioma, que es correcto no usar `t()`
- ✅ `MENU_ITEMS` con `useMemo` — evita recreación en cada render
- ✅ `handleLoadGame` / `handleDeleteGame` / `confirmDelete` con deps declaradas correctamente
- ✅ `formatDate` es función pura fuera del componente — no causa re-renders
