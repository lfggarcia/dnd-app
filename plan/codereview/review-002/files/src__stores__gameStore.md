# Code Review: `src/stores/gameStore.ts`

**Revisado:** 2026-03-14  
**Líneas de código:** ~200  
**Severidad general:** 🟢 Sin issues críticos  
**Comentarios:** 2 observaciones positivas + 1 mejora menor

---

## Resumen

El store está bien diseñado. Las acciones son directas y síncronas donde corresponde (op-sqlite
es sincrónico). La separación `GameState` / `GameActions` en tipos separados es limpia. El
`advanceCycle` con simulación lazy-imported está correctamente pensado para no inflar el bundle.

---

## [CR-004] ✅ Patrón correcto — lazy imports dinámicos para servicios pesados

> **Línea(s):** 167-193  
> **Tipo:** Positivo  

**Código:**
```ts
advanceCycle: async (action) => {
  const { advanceTime } = await import('../services/timeService');
  const { simulateWorld } = await import('../services/worldSimulator');
  // ...
}
```

**Por qué es correcto:**
Dynamic import asegura que `worldSimulator` (servicio pesado) y `timeService` solo se
cargan cuando se necesiten, no en el bundle inicial. ✅

---

## [CR-005] `updateProgress` no valida estructura de `updates`

> **Línea(s):** 95-103  
> **Tipo:** Correctness  
> **Severidad:** 🟢 Baja

**Código actual:**
```ts
updateProgress: (updates) => {
  const { activeGame } = get();
  if (!activeGame) return;
  updateSavedGame(activeGame.id, updates);
  set({
    activeGame: { ...activeGame, ...updates, updatedAt: new Date().toISOString() },
  });
},
```

**Observación:**
El spread `{ ...activeGame, ...updates }` es correcto, pero si `updates` contiene un campo
`id` o `createdAt` por error, se sobreescribiría silenciosamente. Para un campo interno como
`id`, esto causaría pérdida de referencia al juego guardado.

**Mejora (opción 1 — destructuring defensivo):**
```ts
updateProgress: ({ id: _ignored, createdAt: _c, ...safeUpdates } = updates as any) => {
```
**Mejora (opción 2 — más simple, validación explícita):**
```ts
// Documentar en el tipo que estas keys no deben pasarse
type ProgressUpdates = Partial<Pick<SavedGame, 
  'partyData' | 'floor' | 'cycle' | 'phase' | 'gold' | 'status' | 
  'location' | 'mapState' | 'inSafeZone' | 'safeZoneRoomId' | 'combatRoomId' | 'combatRoomType'
>>;
```
El tipo ya está definido correctamente en la firma — TS previene el abuso si se usa
correctamente. No es un bug real dado que TypeScript protege en compile-time.

**Tiempo estimado:** N/A — es una observación, no requiere cambio urgente

---

## [CR-006] ✅ Granular selectors usados correctamente en la mayoría de screens

> **Tipo:** Positivo  

La mayoría de pantallas usan `useGameStore(s => s.activeGame?.field ?? default)` en lugar
de subscribir el objeto entero, lo cual es correcto y siguiendo el `code_style` del proyecto.

Las 8 excepciones están documentadas en PERF-001 de audit-002.
