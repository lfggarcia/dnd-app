# 🏗️ Arquitectura — Auditoría RN

> **Severidad general:** 🟡 Media  
> **Archivos afectados:** 15  
> **Esfuerzo estimado:** 8-12 horas

---

## Resumen ejecutivo
La arquitectura tiene buenos fundamentos: lazy loading, Zustand con selectors granulares, separación services/screens/components, y tipado de navegación. Los problemas principales son: ausencia de ErrorBoundary, archivos masivos (BattleScreen 1571 líneas), empty catch blocks que ocultan errores, y business logic escapando hacia los stores y screens.

---

## Hallazgos

### [ARCH-001] No existe ErrorBoundary en la app
**Archivo(s):** `App.tsx`, `src/navigation/AppNavigator.tsx`  
**Severidad:** 🔴 Alta  
**Impacto:** Cualquier error de render crashea la app completa sin pantalla de fallback y sin posibilidad de recovery.

> **Fuente:** 🤖 Auto-descubierto (BRF-003)

**Solución paso a paso:**
1. Crear `src/components/ErrorBoundary.tsx`:
```tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(): State { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    __DEV__ && console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Algo salió mal</Text>
          <TouchableOpacity onPress={() => this.setState({ hasError: false })} style={styles.btn}>
            <Text style={styles.btnText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}
```
2. Wrappear el NavigationContainer en App.tsx con `<ErrorBoundary>`.

**Tiempo estimado:** 30 min  
**Prioridad:** P1 — Antes de cualquier release

---

### [ARCH-002] 15+ empty catch blocks suprimen errores reales
**Archivo(s):** `gameRepository.ts` L169/173/205/236/250, `VillageScreen.tsx` L83, `ExtractionScreen.tsx` L51/75, `ReportScreen.tsx` L68/77, `GuildScreen.tsx` L205/210/219/305  
**Severidad:** 🟡 Media  
**Impacto:** Errores de DB, parsing, y operaciones de juego fallan silenciosamente. El usuario ve datos inconsistentes sin saber que algo falló.

**Ejemplo:**
```ts
// GuildScreen.tsx L205
try { return getAllActiveBounties(activeGame.seedHash); } catch { return []; }
```

**Solución:** Para cada catch:
- Si es un fallback intencional → documentar: `catch { /* fallback: no bounties if DB fails */ return []; }`
- Si el error importa → agregar `__DEV__ && console.warn(...)` al menos
- En producción → considerar logging service (Sentry, etc.)

**Tiempo estimado:** 1 hora  
**Prioridad:** P2

---

### [ARCH-003] Archivos masivos sin separación (5 pantallas > 700 líneas)
**Archivo(s):** 
- `BattleScreen.tsx` — 1,571 líneas
- `CharacterDetailScreen.tsx` — 1,279 líneas  
- `PartyScreen.tsx` — 923 líneas
- `MapScreen.tsx` — 769 líneas
- `GuildScreen.tsx` — 762 líneas

> **Fuente:** 🤖 Auto-descubierto (BRF-005)

**Severidad:** 🟡 Media  
**Impacto:** Difícil de navegar, testear, y mantener. Riesgo de re-renders por estado compartido en un solo componente.

**Solución:** Para BattleScreen (el más crítico):
1. Extraer `useBattleState` hook con toda la lógica de combate
2. Extraer `BattleHUD`, `TurnActions`, `DefeatOverlay` como sub-componentes
3. Extraer `useBattleAnimations` para la lógica de animación

**Tiempo estimado:** 4+ horas por pantalla  
**Prioridad:** P3 — Refactor incremental

---

### [ARCH-004] Lógica de negocio en Zustand store actions
**Archivo(s):** `src/stores/gameStore.ts`  
**Severidad:** 🟡 Media  
**Impacto:** El store contiene lógica de simulación, persistencia, y cálculos de juego mezclados con state management.

**Solución:** Mover lógica compleja a services y mantener el store como pure state container + simple setters.

**Tiempo estimado:** 2 horas  
**Prioridad:** P3

---

### [ARCH-005] `as React.ComponentType<object>` casts en 12 rutas de navegación
**Archivo(s):** `src/navigation/AppNavigator.tsx`

> **Fuente:** 🤖 Auto-descubierto (BRF-007)

**Severidad:** 🟡 Media  
**Impacto:** Los casts eliminan la validación de props en compile time. Si una pantalla espera params, TypeScript no te avisa si no los pasas.

**Solución:**
1. Ya existe `RootStackParamList` bien tipada (✅ pass en la investigación)
2. El problema es que las pantallas exportan named exports con props tipadas diferente a lo que React Navigation espera
3. Fix: ajustar los exports de las pantallas para ser compatibles sin cast, o usar el tipo inferido de `NativeStackScreenProps<RootStackParamList, 'ScreenName'>`.

**Tiempo estimado:** 2 horas  
**Prioridad:** P2

---

### [ARCH-006] Mezcla de StyleSheet.create + NativeWind + inline styles
**Archivo(s):** Proyecto completo

> **Fuente:** 🤖 Auto-descubierto (BRF-006)

**Severidad:** 🟢 Baja  
**Impacto:** Inconsistencia. NativeWind (601 usos className) es el pattern dominante. StyleSheet.create aparece en 15 archivos. Algunos screens usan inline style={{ }} extensivamente.

**Solución:** Aceptar la coexistencia — migrar gradualmente en refactors futuros. NativeWind no soporta todos los casos (ej: animated styles necesitan StyleSheet).

**Tiempo estimado:** N/A — gradual  
**Prioridad:** P4

---

### [ARCH-007] Repositorios sin transacciones en writes multi-statement
**Archivo(s):** `src/database/eventRepository.ts`, `src/database/itemRepository.ts`, `src/database/rivalRepository.ts`, `src/database/bountyRepository.ts`, `src/database/allianceRepository.ts`  
**Severidad:** 🟡 Media  
**Impacto:** `repository.ts` y `migrations.ts` usan transacciones correctamente (BEGIN/COMMIT/ROLLBACK), pero los repositorios secundarios hacen writes sin transaction wrapper. Si la app crashea mid-write, données quedan inconsistentes.

**Solución:** Wrappear writes multi-statement en los repositorios secundarios con la misma pattern de `repository.ts`.

**Tiempo estimado:** 1 hora  
**Prioridad:** P2

---

## Checklist de verificación
- [ ] ARCH-001 — ErrorBoundary creado y wrappeado en App
- [ ] ARCH-002 — Empty catch blocks documentados o con logging
- [ ] ARCH-003 — BattleScreen refactored (al menos hooks extraídos)
- [ ] ARCH-005 — Navigation casts eliminados
- [ ] ARCH-007 — Transacciones en repositorios secundarios
