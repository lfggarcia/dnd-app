# Code Review: `src/components/DatabaseGate.tsx`

**Revisado:** 2026-03-14  
**Líneas de código:** ~90  
**Severidad general:** 🟡 Media  
**Comentarios:** 2 hallazgos

---

## Resumen

DatabaseGate es un componente de gateway bien conceptualizado. El patrón status → render
es correcto. El problema principal es que los strings de UI están hardcodeados en inglés/español
sin pasar por i18n, y un `useEffect` con una dependencia desconocida que podría ser stale.

---

## [CR-019] Strings de error hardcodeados en español — sin i18n

> **Línea(s):** 28, 46, 48, 58, 62  
> **Tipo:** i18n  
> **Severidad:** 🟡 Media

**Código actual:**
```tsx
<LoadingView message="INICIALIZANDO BASE DE DATOS..." />  // línea 28
// ...
<Text style={styles.errorTitle}>ERROR DE BASE DE DATOS</Text>  // línea 46
<Text style={styles.hint}>Reinicia la aplicación para intentar de nuevo.</Text>  // línea 48
// ...
<Text style={styles.logo}>⚔ TORRE ⚔</Text>  // línea 58
```

**Problema:** DatabaseGate se muestra durante el arranque de la app. Si el usuario tiene
el idioma en EN, verá el error de inicialización en español.

**Nota especial:** Este componente no puede usar `useI18n()` directamente si `I18nProvider` 
está dentro de `DatabaseGate` en el árbol. Verificar la posición en `App.tsx`:
```tsx
// App.tsx — I18nProvider está FUERA de DatabaseGate, por lo que useI18n() SÍ funciona aquí
<I18nProvider>
  <NavigationContainer>
    <DatabaseGate>
```

Si `I18nProvider` está fuera, se puede usar `useI18n()` normalmente.

**Solución:**
```tsx
import { useI18n } from '../i18n';

export function DatabaseGate({ children }: Props) {
  const { t } = useI18n();
  // ...
  if (status === 'error') {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>{t('db.errorTitle')}</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <Text style={styles.hint}>{t('db.errorHint')}</Text>
      </View>
    );
  }
}
```

**Tiempo estimado:** 20 min  
**Referencia:** I18N-001 en audit-002

---

## [CR-020] `useEffect` con `syncNow` referencia — verificar estabilidad

> **Línea(s):** 17-21  
> **Tipo:** Correctness  
> **Severidad:** 🟢 Baja

**Código actual:**
```ts
useEffect(() => {
  if (status === 'ready' && syncStatus && syncStatus.missing.length > 0) {
    syncNow();
  }
}, [status, syncStatus]);
```

**Observación:** `syncNow` se usa en el efecto pero no está en las dependencias.
Si `syncNow` no es una función estable (no está envuelto en `useCallback` en `useDatabase`),
puede capturar una closure desactualizada.

**Verificación:** Revisar `src/hooks/useDatabase.ts` para confirmar si `syncNow` es estable.
Si no lo es, agregar a las dependencias:
```ts
}, [status, syncStatus, syncNow]);
```

**Tiempo estimado:** 15 min (verificar + Fix)
