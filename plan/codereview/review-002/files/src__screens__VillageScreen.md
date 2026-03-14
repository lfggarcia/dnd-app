# Code Review: `src/screens/VillageScreen.tsx`

**Revisado:** 2026-03-14  
**Líneas de código:** 508  
**Severidad general:** 🟡 Media  
**Comentarios:** 3 hallazgos

---

## Resumen

VillageScreen usa correctamente selectores granulares de Zustand (gold, cycle, phase, etc.
— todos granulares). La función `deterministicPick` es un helper PRNG reutilizable que 
podría estar en `src/utils/`, pero funciona correctamente donde está. Los issues son de 
i18n y un cast `as any` en la navegación.

---

## [CR-016] `navigation.navigate(screen as any)` — tipo de route name no verificado

> **Línea(s):** 200  
> **Tipo:** TypeScript  
> **Severidad:** 🟡 Media

**Código actual:**
```tsx
const screen = BUILDING_NAV[key];
if (screen) navigation.navigate(screen as any);
```

**Problema:** `BUILDING_NAV` está tipado como `Partial<Record<string, keyof RootStackParamList>>`.
El tipo ya es correcto — el cast `as any` es innecesario. El compilador debería aceptar
`navigation.navigate(screen)` directamente si el tipo del valor es `keyof RootStackParamList`.

**Raíz real:** El problema está en que `navigation` no está tipado explícitamente con el
tipo de navegación. VillageScreen recibe `{ navigation }: ScreenProps<'Village'>` que da
el tipo correcto.

**Solución:**
```tsx
// BUILDING_NAV ya retorna keyof RootStackParamList (sin params undefined)
// Solo funciona para pantallas sin params requeridos:
const navKey = BUILDING_NAV[key];
if (navKey) {
  // Para pantallas sin params, navigate acepta solo el nombre
  navigation.navigate(navKey as any); // 'as any' sigue siendo necesario si la screen tiene params opcionales
}
```

**Alternativa limpia — tipar solo las screens sin params:**
```ts
type ScreensWithoutParams = {
  [K in keyof RootStackParamList]: RootStackParamList[K] extends undefined ? K : never
}[keyof RootStackParamList];

const BUILDING_NAV: Partial<Record<string, ScreensWithoutParams>> = {
  guild: 'Guild',
  market: 'Market',
  blacksmith: 'Blacksmith',
};
// Ahora navigate(screen) es type-safe
```

**Tiempo estimado:** 15 min

---

## [CR-017] 3 strings hardcodeados en JSX

> **Línea(s):** 431, 495, 501  
> **Tipo:** i18n  
> **Severidad:** 🟡 Media

**Código:**
```tsx
// línea 431
<Text style={{ ... }}>CERRAR</Text>

// línea 495
<Text style={{ ... }}>INICIAR NUEVA TEMPORADA</Text>

// línea 501
<Text style={{ ... }}>VER HISTORIAL DE LA TORRE</Text>
```

También en línea 393 hay un string completo "TODOS LOS MIEMBROS ESTÁN VIVOS" que debe
estar en i18n.

**Solución:** Agregar keys a `es.ts`/`en.ts` y usar `t('key')`.

**Tiempo estimado:** 20 min  
**Referencia:** I18N-001 en audit-002

---

## [CR-018] `deterministicPick` debería estar en `src/utils/` ✅ (leve)

> **Línea(s):** 18-35  
> **Tipo:** Mantenibilidad  
> **Severidad:** 🟢 Baja

**Observación:**
`deterministicPick` es un helper PRNG reutilizable definido dentro del archivo de la screen.
Si otros screens necesitan selección determinista de elementos de una lista, duplicarán
esta lógica.

El proyecto ya tiene `src/utils/prng.ts` — este helper encajaría ahí.

**Solución:**
```ts
// src/utils/prng.ts — agregar:
export function deterministicPick<T>(pool: T[], seedKey: string, count: number): T[] { ... }
```

**Tiempo estimado:** 10 min (mover + actualizar import)
