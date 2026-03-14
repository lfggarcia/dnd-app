# 🏗️ Arquitectura — Auditoría RN

> **Severidad general:** 🟡 Media  
> **Archivos afectados:** 5  
> **Esfuerzo estimado:** 4–8 horas

---

## Resumen ejecutivo

La arquitectura general es sólida: Zustand para estado global, SQLite vía `op-sqlite` para persistencia, separación clara en capas (screens → services → database), TypeScript estricto con 0 `@ts-ignore`, sin dependencias circulares, y lazy loading en navegación. Los problemas identificados son: (1) ausencia de `ErrorBoundary` global — un crash inesperado tumba toda la app sin feedback al usuario; (2) tres pantallas con archivos de más de 900 líneas que mezclan lógica de presentación con lógica de negocio; (3) uso moderado de `as any` en algunas áreas que podría tipurarse mejor.

---

## Hallazgos

### [ARQ-001] Ausencia de `ErrorBoundary` global en `App.tsx`
**Archivo:** `App.tsx` (toda la app)  
**Severidad:** 🟡 Media — Un error de renderizado no capturado tumba toda la app con una pantalla en blanco  

**Código actual (problema):**
```tsx
export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <I18nProvider>
          <NavigationContainer>
            {/* ← No hay ErrorBoundary aquí */}
            <DatabaseGate>
              <AppNavigator />
            </DatabaseGate>
          </NavigationContainer>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

**Por qué es un problema:**
Si cualquier screen lanza un error de renderizado (ej: `partyData` llega como `null` en un componente que no lo espera), React desmonta todo el árbol y muestra una pantalla en blanco. El usuario no tiene forma de volver al menú principal.

**Solución paso a paso:**

1. Crear `src/components/AppErrorBoundary.tsx`:
```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type State = { hasError: boolean; error?: Error };

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Aquí se puede integrar Sentry u otro servicio de crash reporting
    if (__DEV__) {
      console.error('[AppErrorBoundary]', error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Algo salió mal</Text>
          <Text style={styles.subtitle}>
            {__DEV__ ? this.state.error?.message : 'Error inesperado. Por favor reinicia la app.'}
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ hasError: false })}
          >
            <Text style={styles.buttonText}>REINTENTAR</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E0A', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title:     { color: '#FF3E3E', fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  subtitle:  { color: '#00FF41', fontSize: 13, textAlign: 'center', marginBottom: 24 },
  button:    { borderColor: '#00FF41', borderWidth: 1, paddingHorizontal: 24, paddingVertical: 12 },
  buttonText:{ color: '#00FF41', fontSize: 12, letterSpacing: 2 },
});
```

2. Usar en `App.tsx`:
```tsx
import { AppErrorBoundary } from './src/components/AppErrorBoundary';

export default function App() {
  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        ...
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
```

**Tiempo estimado:** 1 hora  
**Prioridad:** P2 — Antes del próximo release

---

### [ARQ-002] Archivos de pantalla extremadamente largos — mezcla de UI y lógica
**Archivos afectados:**
- `src/screens/BattleScreen.tsx` — **1571 líneas**
- `src/screens/CharacterDetailScreen.tsx` — **1279 líneas**
- `src/screens/PartyScreen.tsx` — **923 líneas**
- `src/services/combatEngine.ts` — **983 líneas**

**Severidad:** 🟡 Media — Dificulta el mantenimiento, testing, y revisión de código  

**Por qué es un problema:**
`BattleScreen.tsx` con 1571 líneas contiene: sub-componentes (`TurnToken`, `EnemyCard`, `PartyCard`, `LogStrip`, `DefeatAnimation`), lógica de combate derivada (`deriveEventsFromLogLines`), constantes de estilo, y la pantalla principal. Esto viola el principio de responsabilidad única y hace que el archivo sea difícil de navegar y testear individualmente.

**Solución recomendada para `BattleScreen.tsx`:**

Extraer gradualmente los sub-componentes a sus propios archivos:
```
src/components/battle/
  TurnToken.tsx         ← ~50 líneas
  TurnTimeline.tsx      ← ~30 líneas  
  EnemyCard.tsx         ← ~95 líneas
  PartyCard.tsx         ← ~85 líneas
  LogStrip.tsx          ← ~35 líneas
  DefeatAnimation.tsx   ← ~45 líneas
```

Extraer la lógica de detección de eventos:
```
src/services/battleEventService.ts
  deriveEventsFromLogLines()
```

Resultado estimado: `BattleScreen.tsx` quedaría en ~600–700 líneas (solo el screen principal).

**Tiempo estimado:** 3–4 horas (por archivo, hacerlo gradualmente)  
**Prioridad:** P3 — Backlog técnico, no urgente

---

### [ARQ-003] `as any` en navegación de `VillageScreen`
**Archivo:** `src/screens/VillageScreen.tsx` línea 200  
**Severidad:** 🟢 Baja — Evita el tipado de navegación en una operación de alto uso  

**Código actual (problema):**
```ts
if (screen) navigation.navigate(screen as any);
```

**Por qué es un problema:**
`screen` es probablemente un string libre que debería tipuparse como `keyof RootStackParamList`. El `as any` bypasea la validación de TypeScript y permite navegar a una ruta que no existe.

**Solución:**
```ts
import type { RootStackParamList } from '../navigation/types';

// En el lugar donde se define `screen`:
const screen = someValue as keyof RootStackParamList | undefined;

// En la navegación:
if (screen) navigation.navigate(screen as never); // o usar type assertion correcta
```

O mejor, tipar el origen de `screen` correctamente para que el cast no sea necesario.

**Tiempo estimado:** 20 min  
**Prioridad:** P3 — Mejora de type-safety

---

### [ARQ-004] `as any` en `formData.append` de servicios de imagen
**Archivos:**
- `src/services/geminiImageService.ts` línea 455
- `src/services/enemySpriteService.ts` línea 223

**Severidad:** 🟢 Baja — Workaround conocido de React Native para `FormData` con `blob` nativo  

**Código actual:**
```ts
(formData as any).append('image', {
  uri: localUri,
  type: 'image/png',
  name: filename,
});
```

**Por qué existe:**
React Native's `FormData` tiene una API extendida para enviar archivos que no está en los tipos estándar de `FormData`. Es un patrón aceptado en la comunidad RN.

**Solución (opcional):**
```ts
// Crear una declaración de tipo para evitar el cast
declare global {
  interface FormData {
    append(name: string, value: { uri: string; type: string; name: string }): void;
  }
}
```

**Tiempo estimado:** 10 min  
**Prioridad:** P3 — Solo si se quiere eliminar los `as any`

---

## Lo que está bien ✅

- **Sin dependencias circulares**: `npx madge --circular` reporta ✅ en todos los 105 archivos TS/TSX
- **Navegación bien tipurada**: `RootStackParamList` con todos los params definidos en `types.ts` ✅
- **Zustand store limpio**: separación clara de `GameState` + `GameActions`, acciones atómicas ✅
- **Sin prop drilling excesivo**: el estado global vía Zustand evita drilling en pantallas ✅
- **Capa de servicios clara**: screens no hacen llamadas directas a DB — todo pasa por servicios/store ✅
- **0 `@ts-ignore` / `@ts-nocheck`** en todo el codebase ✅
- **Lazy loading** en AppNavigator para pantallas pesadas ✅
- **`DatabaseGate`** como guarda de inicialización de SQLite ✅

---

## Checklist de verificación

- [ ] ARQ-001: `AppErrorBoundary` creado y aplicado en `App.tsx`
- [ ] ARQ-002: (Backlog) Extraer sub-componentes de `BattleScreen`, `CharacterDetailScreen`
- [ ] ARQ-003: Tipar `screen` en `VillageScreen` sin `as any`
- [ ] ARQ-004: (Opcional) Declaración de tipo para `FormData` RN
