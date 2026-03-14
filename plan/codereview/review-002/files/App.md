# Code Review: `App.tsx`

**Revisado:** 2026-03-14  
**Líneas de código:** 28  
**Severidad general:** 🟡 Media  
**Comentarios:** 1 hallazgo

---

## Resumen

App.tsx está limpio y bien estructurado. El árbol de providers está correcto (GestureHandler → 
SafeArea → I18n → Navigation → DB). Solo falta un `ErrorBoundary` como primera capa de 
defensa ante crashes inesperados.

---

## [CR-001] Falta ErrorBoundary como primera capa del árbol

> **Línea(s):** 16-27  
> **Tipo:** Arquitectura  
> **Severidad:** 🟡 Media

**Código actual:**
```tsx
export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        ...
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

**Problema:**
Sin `ErrorBoundary`, cualquier error no capturado en el árbol React produce pantalla en
blanco. El usuario no puede recuperarse sin reiniciar la app.

**Solución:**
```tsx
import { ErrorBoundary } from './src/components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          ...
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
```

**Tiempo estimado:** 5 min (una vez creado ErrorBoundary)  
**Referencia:** ARCH-003 en audit-002
