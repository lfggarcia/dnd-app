# Code Review: `src/screens/CampScreen.tsx`

**Revisado:** 2026-03-14  
**Líneas de código:** 341  
**Severidad general:** 🟡 Observaciones moderadas  
**Comentarios:** 3 observaciones (2🟡, 1✅)

---

## Resumen

Pantalla de campamento — rest, level-up, e inventario. Gestiona descansos cortos y largos con
efectos de HP y avance de ciclo. Bien estructurada pero tiene la mayor concentración de strings
hardcodeados del proyecto (~20 ternarios `lang === 'es'`) y suscripción `activeGame` completa.

---

## [CR-047] `activeGame` completo — mismo patrón que GuildScreen 🟡

> **Línea:** 25  
> **Tipo:** Performance  
> **Referencia audit:** PERF-001

```ts
const activeGame = useGameStore(s => s.activeGame);
// Derivaciones manuales:
const partyData = activeGame?.partyData ?? [];
const gold      = activeGame?.gold ?? 0;
const cycle     = activeGame?.cycle ?? 1;
```

**Propuesta de selectores granulares:**
```ts
const partyData = useGameStore(s => s.activeGame?.partyData ?? []);
const gold      = useGameStore(s => s.activeGame?.gold ?? 0);
const cycle     = useGameStore(s => s.activeGame?.cycle ?? 1);
const gameId    = useGameStore(s => s.activeGame?.id ?? null);      // para getItemsByGame
const seedHash  = useGameStore(s => s.activeGame?.seedHash ?? '');  // para checkForAbandonment
// activeGame: solo necesario si se hace null-check en handleLongRest
```

El mayor riesgo de re-renders es durante combate: cada cambio de HP en `partyData` de cualquier
personaje dispara re-render de `CampScreen`. Aunque el usuario no ve CampScreen durante combate,
este componente puede estar montado si no se desmonta al navegar.

---

## [CR-048] ~20 strings hardcodeados con ternario `lang === 'es'` — mayor deuda i18n del proyecto 🟡

> **Líneas:** 58, 59, 77, 99–100, 121–122, 138, 142, 183, 215, 231, 243, 246, 251, 261, 264, 269, 280, 283  
> **Tipo:** i18n  
> **Referencia audit:** I18N-001

CampScreen tiene la mayor concentración de strings hardcodeados del proyecto. Ejemplos:
```ts
lang === 'es' ? 'Descanso corto'   : 'Short rest'
lang === 'es' ? 'DESCANSO LARGO'   : 'LONG REST'
lang === 'es' ? 'La party recuperó 25% de HP.' : 'The party recovered 25% HP.'
lang === 'es' ? 'Costo: 0G · 0 ciclos' : 'Cost: 0G · 0 cycles'
lang === 'es' ? 'Ya estás en el ciclo 60.' : 'You are already at cycle 60.'
```

**Propuesta:** Mover todos a `es.ts`/`en.ts` bajo namespace `camp.*` y usar `t('camp.shortRest')`, etc.
Esto eliminaría el 60% de las apariciones de `I18N-001` del proyecto.

**Prioridad:** P2 — CampScreen es una de las pantallas más usadas del juego.

---

## [CR-049] Lógica de descanso bien separada en callbacks ✅

> **Tipo:** Positivo

```ts
const handleShortRest = useCallback(() => { ... }, [partyData, updateProgress, lang]);
const handleLongRest  = useCallback(async () => { ... }, [partyData, updateProgress, advanceCycle, navigation, cycle, activeGame, lang]);
```

- Deps declaradas correctamente (sin eslint-disable)
- Callbacks separados por responsabilidad
- `checkForAbandonment` llamado antes de commitir el long rest — correcto per SYSTEMS.MD

---

## Patrones positivos adicionales

- ✅ Sin eslint-disable
- ✅ Tab `useMemo` para TABS array — evita recreación en cada render
- ✅ `getItemsByGame(activeGame.id)` en el render — síncrono de SQLite, correcto para inventario
