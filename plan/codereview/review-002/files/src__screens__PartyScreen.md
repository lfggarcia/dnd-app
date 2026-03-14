# Code Review: `src/screens/PartyScreen.tsx`

**Revisado:** 2026-03-14  
**Líneas de código:** 923  
**Severidad general:** 🟢 Bien estructurado  
**Comentarios:** 3 observaciones (1🟡, 1🟢, 1✅)

---

## Resumen

Pantalla de creación de party — gestiona selección de raza/clase/background, generación de stats,
portraits (Gemini + catálogo), y lanzamiento del juego. Está bien descompuesta: `usePartyRoster`
extrae toda la lógica, los subcomponentes están memoizados, y las deps de `useCallback` son
explícitas. No usa `activeGame` (✅). El tamaño (923 líneas) es alto pero justificado por la
complejidad de la pantalla.

---

## [CR-034] `eslint-disable exhaustive-deps` en `AnimatedStatBar` — riesgo bajo pero documentar 🟡

> **Línea:** 88  
> **Tipo:** Hooks / Correctness  
> **Referencia audit:** PERF-003

```ts
useEffect(() => {
  barWidth.value = withDelay(index * 80, withTiming(pct, { ... }));
  barGlow.value = withDelay(/* ... */);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [final]);
```

**Problema:** `index`, `pct`, `barWidth`, `barGlow` están omitidos de las deps. `barWidth` y
`barGlow` son shared values de Reanimated (refs estables), por lo que omitirlos es seguro.
`index` y `pct` se derivan de `final`, así que en la práctica el efecto se ejecuta cuando cambia
lo relevante. El disable está justificado, pero sin comentario explicativo.

**Propuesta:** Añadir comentario breve:
```ts
// barWidth/barGlow son refs estables de Reanimated, no necesitan ser deps
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [final]);
```

---

## [CR-035] `handleLaunch` — strings de progreso hardcodeados sin i18n 🟡

> **Líneas:** 255–310 (aprox.)  
> **Tipo:** i18n  
> **Referencia audit:** I18N-001

```ts
setLaunchStep(lang === 'es' ? 'Iniciando partida...' : 'Initializing game...');
setLaunchStep(lang === 'es' ? `Creando ilustración para ${party[i].name}` : `Creating portrait for ${party[i].name}`);
setLaunchStep(lang === 'es' ? `Generando expresiones para ${party[i].name}` : `Generating expressions for ${party[i].name}`);
setLaunchStep(lang === 'es' ? 'Guardando ilustraciones...' : 'Saving portraits...');
setLaunchStep(lang === 'es' ? 'Entrando a la aldea...' : 'Entering the village...');
```

5 strings de progreso hardcodeados con ternario `lang === 'es'` en lugar de `t()`. Este patrón
es el mismo que en otros screens — ver I18N-001. No es urgente (solo visible durante launch),
pero deberían moverse a `es.ts`/`en.ts`.

---

## [CR-036] Arquitectura: `usePartyRoster` extrae correctamente la lógica de estado ✅

> **Tipo:** Positivo

```ts
const {
  races, classes, roster, activeSlot, updateCurrent, handleGeneratePortrait,
  buildPartySaves, /* ... */
} = usePartyRoster(lang);
```

La separación entre lógica (`usePartyRoster`) y presentación (`PartyScreen`) es excelente.
El hook concentra ~15 callbacks y ~12 estados derivados, dejando la pantalla limpia. Patrón
correcto a seguir en refactors de BattleScreen y CharacterDetailScreen.

---

## Patrones positivos adicionales

- ✅ No usa `activeGame` — selectores granulares correctos (solo `startNewGame`)
- ✅ Subcomponentes memoizados: `AnimatedStatBar`, `SectionCard`, `SectionHeader`, `SectionHint`, `DescriptionBox`, `SubclassAbilitiesPanel`
- ✅ `featureChoicesRef` + `useEffect` estabiliza callback evitando invalids en `CharacterActionsPanel`
- ✅ `StyleSheet.create` para estilos estáticos (objeto `S`)
- ✅ Catalog-first portrait (evita AI en runtime si hay catálogo pre-generado)
- ✅ Portrait/expression generation individual es non-blocking (try/catch por item)
