# Code Review: `src/screens/MapScreen.tsx`

**Revisado:** 2026-03-14  
**Líneas de código:** 769  
**Severidad general:** 🟡 Media  
**Comentarios:** 4 hallazgos

---

## Resumen

MapScreen tiene una arquitectura visual bien pensada: `MapBackground` y `ConnectionLines` 
están memoizados con props estables, lo que evita re-renders del SVG pesado en cada tap.
El patrón de lazy loading + `Suspense` está correcto. Los problemas son: (1) el `activeGame`
completo subscrito de Zustand, (2) 7 `eslint-disable exhaustive-deps`, y (3) strings
hardcodeados en la descripción de rooms.

---

## Issues del briefing verificados en este archivo

**BRF-004 (Strings hardcodeados):** Confirmado — `getRoomActionDesc()` devuelve strings
literales en español (líneas ~57-65). La función retorna directamente:
```ts
case 'NORMAL': return 'Sala de combate · Los enemigos aguardan';
case 'BOSS':   return '[!] BOSS · El guardián te espera';
```
Estas descripciones no pasan por i18n.

---

## [CR-012] `activeGame` completo subscrito de Zustand — causa re-renders innecesarios

> **Línea(s):** 163  
> **Tipo:** Performance  
> **Severidad:** 🟡 Media

**Código actual:**
```ts
const activeGame = useGameStore(s => s.activeGame);
```

MapScreen usa de `activeGame`: `floor`, `seedHash`, `mapState`, `cycle`, `phase`,
`location`, `inSafeZone`, `safeZoneRoomId`, `combatRoomId`, `partyData`.

**Problema:** Cualquier cambio en `activeGame.gold` o `activeGame.portraits_json` (que no 
usa MapScreen) provocará un re-render del mapa SVG entero y recalculará el dungeonFloor.

**Solución:**
```ts
const floor         = useGameStore(s => s.activeGame?.floor ?? 1);
const seedHash      = useGameStore(s => s.activeGame?.seedHash ?? '');
const mapState      = useGameStore(s => s.activeGame?.mapState ?? null);
const cycle         = useGameStore(s => s.activeGame?.cycle ?? 1);
const phase         = useGameStore(s => s.activeGame?.phase ?? 'DAY');
const location      = useGameStore(s => s.activeGame?.location ?? 'village');
const inSafeZone    = useGameStore(s => s.activeGame?.inSafeZone ?? false);
const safeZoneRoomId = useGameStore(s => s.activeGame?.safeZoneRoomId ?? null);
const combatRoomId  = useGameStore(s => s.activeGame?.combatRoomId ?? null);
const partyData     = useGameStore(s => s.activeGame?.partyData ?? []);
```

**Tiempo estimado:** 30 min  
**Referencia:** PERF-001 en audit-002

---

## [CR-013] 7 `eslint-disable exhaustive-deps` — el más crítico en línea 312

> **Línea(s):** 212, 247, 258, 312, 374, 392  
> **Tipo:** Bug potencial  
> **Severidad:** 🟡 Media

El efecto en línea 312 es especialmente relevante — actualiza el dungeonFloor cuando
cambia el piso. Si el selector de `floor` es stale, el mapa puede no regenerarse al
avanzar de piso.

**Verificación necesaria:** Confirmar que todos los efectos que usan `activeGame` como
dependencia sean actualizados para usar los selectores granulares del CR-012.

**Tiempo estimado:** 1 hora

---

## [CR-014] `getRoomActionDesc` — strings hardcodeados sin i18n

> **Línea(s):** 50-66  
> **Tipo:** i18n  
> **Severidad:** 🟡 Media

**Código actual:**
```ts
function getRoomActionDesc(type: RoomType): string {
  switch (type) {
    case 'NORMAL': return 'Sala de combate · Los enemigos aguardan';
    case 'ELITE':  return 'Combate élite · Enemigos poderosos';
    case 'BOSS':   return '[!] BOSS · El guardián te espera';
    // ...
  }
}
```

**Problema:** La función es pura y no tiene acceso a `t()`. En inglés mostraría el texto español.

**Solución:**
```ts
// Convertirla en un hook o pasarle la función t como parámetro:
function getRoomActionDesc(type: RoomType, t: (key: string) => string): string {
  switch (type) {
    case 'NORMAL': return t('map.roomDesc.normal');
    case 'ELITE':  return t('map.roomDesc.elite');
    // ...
  }
}

// En el componente que la llama:
const { t } = useI18n();
const desc = getRoomActionDesc(room.type, t);
```

O bien crear las keys en `es.ts`/`en.ts` y llamar desde el JSX directamente.

**Tiempo estimado:** 30 min  
**Referencia:** I18N-001 en audit-002

---

## [CR-015] `MapBackground` y `ConnectionLines` correctamente memoizados ✅

> **Línea(s):** 70-105, 107-140  
> **Tipo:** Positivo  

```tsx
const MapBackground = React.memo(() => { ... });
const ConnectionLines = React.memo(({ floor, roomMap, ... }: ConnectionLinesProps) => { ... });
```

`MapBackground` no tiene props — nunca se re-renderiza. `ConnectionLines` tiene props
estables granulares — solo se re-renderiza cuando cambian floor/roomMap/currentRoomId.
El comentario explica explícitamente que `selectedRoom` no es prop para no invalidarlas.
Excelente optimización para un SVG pesado. ✅
