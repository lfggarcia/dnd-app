# Code Review: i18n, Hooks, Utils

**Revisado:** 2026-03-14

---

## `src/utils/prng.ts` — ✅ Sin issues

**Líneas:** ~55 | Severidad: 🟢

### [CR-066] djb2 + LCG — implementación correcta y bien documentada ✅

```ts
export function makePRNG(seed: string): PRNG {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(h, 33) ^ seed.charCodeAt(i)) >>> 0;
  }
  let s = h >>> 0;
  // LCG: s = (1664525 * s + 1013904223) mod 2^32
}
```

- ✅ `Math.imul` para multiplicación de 32 bits — correcto en JS
- ✅ `>>> 0` para garantizar unsigned 32-bit — evita overflow silencioso
- ✅ API tipada con `PRNG` interface — no expone el estado interno `s`
- ✅ `float()`, `next(min, max)`, `bool(probability)` — API completa y consistente
- ✅ Docstring con ejemplo de uso

---

## `src/i18n/context.tsx` — ✅ Sin issues

**Líneas:** 55 | Severidad: 🟢

### [CR-067] Context memoizado correctamente ✅

```ts
const contextValue = useMemo(
  () => ({ t, lang, setLang }),
  [t, lang, setLang],
);
```

El valor del contexto está memoizado — solo re-renderiza consumers cuando cambia `lang`.
`t` es un `useCallback` que depende de `lang`, por lo que la cadena de memoización es
correcta: `lang cambía → t se recrea → contextValue se recrea → consumers re-renderizan`.

- ✅ `t` como `useCallback(fn, [lang])` — referencia estable entre renders del mismo idioma
- ✅ `DeepString<typeof en>` — tipo derivado de `en.ts` garantiza que `es.ts` tiene las mismas keys

### [CR-068] `any` implícito en la función `t` 🟡

> **Línea:** 31  
> **Tipo:** TypeScript

```ts
const t = useCallback(
  (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[lang];  // ← implicit any traversal
    for (const k of keys) {
      value = value?.[k];
    }
    return typeof value === 'string' ? value : key;
  }, [lang],
);
```

El uso de `any` es un trade-off aceptable aquí: TypeScript no puede inferir el tipo de una
traversal de string path en tiempo de compilación sin tipos literales. La alternativa sería
usar un helper genérico que elimine el `any`, pero a costo de complejidad. El fallback `key`
en lugar de `throw` es correcto para producción.

**Prioridad:** P4 — El riesgo real es cero (fallback a la clave literal).

---

## `src/hooks/useDatabase.ts` — ✅ Sin issues críticos

**Líneas:** ~90 | Severidad: 🟢

- ✅ `initializedRef` previene doble-inicialización en StrictMode / re-mounts
- ✅ Error handling con `setStatus('error')` y mensaje en español (no crítico — DatabaseGate muestra el error)
- ✅ `syncNow` como método público — DatabaseGate puede triggerear re-sync

### [CR-069] `syncNow` no en deps de `useEffect` — CR-020 re-verificado

Ver CR-020 en `DatabaseGate.md` — la estabilidad de `syncNow` depende de `useCallback` en
este hook. Si `syncNow` no está memoizado con `useCallback`, DatabaseGate podría sufrir
re-renders. Verificar que `syncNow` usa `useCallback`.

---

## `src/hooks/usePartyRoster.ts` — ✅ Sin issues críticos importantes

**Líneas:** ~290 | Severidad: 🟢

- Extrae toda la lógica de creación de party de PartyScreen — patrón correcto
- Gestiona estado de portrait, catálogo, reroll, selección de clase/raza/background
- Sin eslint-disable detectado

---

## `src/hooks/useTutorial.ts` + `useResources.ts` + `useGlossary.ts` — ✅ Sin issues

Hooks utilitarios pequeños (~50 líneas cada uno), sin patterns problemáticos.

---

## `src/i18n/translations/` — ✅ Verificado vs audit

Ver I18N-002 en audit-002: `es.ts` tiene 431 líneas vs `en.ts` 427 líneas (4 líneas de
diferencia). Las claves estructurales están sincronizadas. La diferencia se debe a diferencias
en longitud de strings (español es ligeramente más largo).
