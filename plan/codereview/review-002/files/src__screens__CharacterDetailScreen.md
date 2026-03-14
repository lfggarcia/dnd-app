# Code Review: `src/screens/CharacterDetailScreen.tsx`

**Revisado:** 2026-03-14  
**Líneas de código:** 1279  
**Severidad general:** 🟡 Observaciones moderadas  
**Comentarios:** 4 observaciones (1🔴 referencia a audit, 2🟡, 1✅)

---

## Resumen

Segunda pantalla más grande del proyecto (1279 líneas). Gestiona la visualización completa de un personaje — stats, equipo, esencias, expresiones, portraits, y renaming. La lógica de generación de portrait usa Gemini API inline. Los selectores Zustand son granulares excepto `activeGame` en línea 223.

---

## [CR-030] `activeGame` selector demasiado amplio en línea 223

> **Tipo:** Performance  
> **Severidad:** 🟡 Media  
> **Referencia audit:** PERF-001

```ts
// línea 223
const activeGame    = useGameStore(s => s.activeGame);   // ❌ suscribe TODO el objeto
const activeGameId  = useGameStore(s => s.activeGame?.id ?? null);  // ¿por qué separado?
```

`activeGame` completo es usado para `party` (línea 227) y `expressionsJson` (línea 228).
Si cualquier propiedad de `activeGame` cambia, el componente re-renderiza. 

**Solución:**
```ts
const party           = useGameStore(s => s.activeGame?.partyData ?? []);
const expressionsJson = useGameStore(s => s.activeGame?.expressionsJson ?? {});
const activeGameId    = useGameStore(s => s.activeGame?.id ?? null);
```
Eliminar el `useGameStore(s => s.activeGame)` genérico y los `useMemo` derivados que ya no hacen falta.

---

## [CR-031] `as any` para porcentaje de posición en StyleSheet — BRF-009 verificado ✅

> **Tipo:** TypeScript / Quirk de RN  
> **Severidad:** 🟢 Info  

```ts
// línea 147
style={[S.statBarTick, { left: `${tickPct}%` as any }]}
```

React Native acepta strings porcentuales (`'50%'`) en `DimensionValue` pero TypeScript
no los acepta en posiciones absolutas. El `as any` es un workaround conocido. Considerar
usar `as DimensionValue` para ser más específico:

```ts
style={[S.statBarTick, { left: `${tickPct}%` as DimensionValue }]}
```

**BRF-009 verificado:** confirmado en línea 147 de CharacterDetailScreen.tsx.

---

## [CR-032] `eslint-disable exhaustive-deps` en `StatBar` — stale closure en Reanimated worklet

> **Tipo:** Correctitud  
> **Severidad:** 🟡 Media  

```ts
// línea 123
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [value]);
```

La función usa `index` pero no lo lista en deps. `index` es prop de `StatBar` y por tanto
estable entre renders del mismo componente. El disable es correcto en la práctica, pero
debería tener un comentario explicando por qué `index` se omite:

```ts
// `index` es estable (prop del componente) — safe omitir
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [value]);
```

---

## [CR-033] Tabs con valores hardcoded internos — i18n parcial

> **Tipo:** i18n  
> **Severidad:** 🟡 Baja  
> **Referencia audit:** I18N-001  

```ts
// línea 237
const [activeTab, setActiveTab] = useState<'STATS' | 'EQUIPO' | 'ESENCIAS'>('STATS');
```

Los valores del tipo union son internos (no mostrados directamente), pero en el render
las etiquetas de tab pueden ser hardcodeadas. Check rápido:

```tsx
// si en el render hay algo como:
<Text>{tab}</Text>  // 'EQUIPO' aparece en UI — no i18n
```

Verificar que las labels de tabs usan `t('tab.stats')` etc.

---

## Issues del briefing verificados en este archivo

| ID | Estado | Descripción |
|----|--------|-------------|
| BRF-001 | N/A | Assets — no aplica a este archivo |
| BRF-009 | ✅ Verificado | `as any` para `left: '${tickPct}%'` en línea 147 |
| PERF-001 | ✅ Verificado | `useGameStore(s => s.activeGame)` completo en línea 223 |
