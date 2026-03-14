# 🏗️ Arquitectura — Auditoría TORRE (dnd3) — audit-002

> **Severidad general:** 🟡 Media  
> **Archivos afectados:** 6 archivos principales  
> **Esfuerzo estimado:** 3-5 días  
> **Fecha:** 2026-03-14

---

## Resumen ejecutivo

La arquitectura general de TORRE es sólida: Zustand para estado, op-sqlite para persistencia
sincrónica, React Navigation con lazy loading. Los problemas identificados son de escala:
archivos demasiado grandes (BattleScreen.tsx con 1571 líneas), 15 casts de tipo en el
navegador que ocultan incompatibilidades, y falta de `ErrorBoundary`. Ninguno de estos
bloquea el desarrollo actual, pero aumentan el costo de mantenimiento.

---

## Hallazgos

### [ARCH-001] BattleScreen.tsx con 1571 líneas — violación de SRP

> **Fuente:** 🤖 Auto-descubierto (BRF-008)

**Archivo(s):** `src/screens/BattleScreen.tsx` (1571 líneas)  
**Severidad:** 🟡 Media  
**Impacto:** El archivo mezcla: lógica de UI del combate, máquina de estados del combate,
animaciones de combate, rendering de health bars, y lógica de turnos. Dificulta testing,
debugging y onboarding de nuevos desarrolladores.

**Archivos afectados y su tamaño:**
| Archivo | Líneas | Límite recomendado | Exceso |
|---------|--------|-------------------|--------|
| `BattleScreen.tsx` | 1571 | 400 | 4x |
| `CharacterDetailScreen.tsx` | 1279 | 400 | 3x |
| `combatEngine.ts` | 983 | 300 (service) | 3x |
| `PartyScreen.tsx` | 923 | 400 | 2x |
| `MapScreen.tsx` | 769 | 400 | 2x |
| `GuildScreen.tsx` | 762 | 400 | 2x |

**Refactoring propuesto para BattleScreen:**

1. Extraer lógica de combate a un hook custom:
```tsx
// src/hooks/useBattleEngine.ts
export function useBattleEngine(roomId: string, roomType: RoomType) {
  // Estado del combate: turno, fase, resultado
  // Acciones: attack, useItem, flee
  // Retorna: { turnState, executeAction, combatLog }
}
```

2. Extraer componentes visuales:
```tsx
// src/components/battle/BattleHealthBar.tsx
// src/components/battle/BattleLog.tsx
// src/components/battle/BattleCharacterSlot.tsx
// src/components/battle/BattleActionBar.tsx
```

3. BattleScreen queda como orchestrador:
```tsx
// BattleScreen.tsx — solo coordinación, < 200 líneas
export const BattleScreen = () => {
  const { roomId, roomType } = useRoute<ScreenProps<'Battle'>['route']>().params;
  const { turnState, executeAction } = useBattleEngine(roomId, roomType);
  
  return (
    <View style={styles.container}>
      <BattleLog log={turnState.log} />
      <BattleCharacterSlot character={turnState.enemy} side="enemy" />
      <BattleCharacterSlot character={turnState.player} side="player" />
      <BattleActionBar actions={turnState.availableActions} onAction={executeAction} />
    </View>
  );
};
```

**Tiempo estimado:** 2 días (BattleScreen refactor completo)  
**Prioridad:** P2 — Antes de añadir más features de combate

---

### [ARCH-002] 15 casts `as React.ComponentType<object>` en AppNavigator

> **Fuente:** 🤖 Auto-descubierto (BRF-007)

**Archivo(s):** `src/navigation/AppNavigator.tsx` (15 ocurrencias)  
**Severidad:** 🟡 Media  
**Impacto:** Los casts ocultan incompatibilidades de tipos entre pantallas lazy-loaded y
el stack navigator. Si una pantalla tiene params requeridos y se navega sin ellos, TypeScript
no lo detecta en tiempo de compilación.

**Código actual (problema):**
```tsx
<Stack.Screen name="Battle" component={BattleScreen as React.ComponentType<object>} />
```

**Causa raíz:** El componente `lazy()` retorna `React.ComponentType<P>` pero el type del
Stack.Screen espera exactamente el tipo correcto de params.

**Solución paso a paso:**

1. En cada screen, declarar el tipo de Props correctamente:
```tsx
// src/screens/BattleScreen.tsx
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'Battle'>;

export const BattleScreen: React.FC<Props> = ({ route, navigation }) => {
  const { roomId, roomType } = route.params;
  // ...
};
```

2. El cast en AppNavigator desaparece naturalmente porque el tipo ya es compatible:
```tsx
// ANTES
<Stack.Screen name="Battle" component={BattleScreen as React.ComponentType<object>} />

// DESPUÉS (sin cast)
<Stack.Screen name="Battle" component={BattleScreen} />
```

3. Hacer esto para las 15 pantallas con casts.

**Tiempo estimado:** 2-3 horas  
**Prioridad:** P2 — Previene bugs de navegación silenciosos

---

### [ARCH-003] Sin ErrorBoundary — crashes no capturados producen pantalla en blanco

> **Fuente:** 🤖 Auto-descubierto (BRF-005)

**Archivo(s):** `App.tsx`, `src/navigation/AppNavigator.tsx`  
**Severidad:** 🟡 Media  
**Impacto:** Un error no capturado en cualquier componente React dismounts el árbol entero.
En producción, el usuario ve pantalla en blanco sin mensaje de error y no puede recuperarse
sin reiniciar la app.

**Solución paso a paso:**

1. Crear `src/components/ErrorBoundary.tsx`:
```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    __DEV__ && console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Algo salió mal</Text>
          <Text style={styles.message}>{this.state.error?.message}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.buttonText}>Intentar de nuevo</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: '#FF4444', fontFamily: 'RobotoMono-Bold', fontSize: 18, marginBottom: 12 },
  message: { color: '#ccc', fontFamily: 'RobotoMono-Regular', fontSize: 12, textAlign: 'center', marginBottom: 24 },
  button: { borderWidth: 1, borderColor: '#FFB000', paddingHorizontal: 24, paddingVertical: 12 },
  buttonText: { color: '#FFB000', fontFamily: 'RobotoMono-Bold', fontSize: 14 },
});
```

2. En `App.tsx`, envolver el navigator:
```tsx
import { ErrorBoundary } from './src/components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <DatabaseGate>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </DatabaseGate>
    </ErrorBoundary>
  );
}
```

**Tiempo estimado:** 30 min  
**Prioridad:** P1 — Crítico para UX en producción

---

### [ARCH-004] `console.log` sin `__DEV__` guard en producción

> **Fuente:** Análisis estático

**Archivo(s):** `src/services/aiProfileEngine.ts:163`  
**Severidad:** 🟢 Baja  
**Impacto:** Un `console.log` en producción tiene overhead mínimo pero puede exponer datos
de estado del juego en logs accesibles (por ejemplo en Android via `adb logcat`).

**Evidencia:**
```ts
// src/services/aiProfileEngine.ts:163
console.log(
```

**Solución:**
```ts
// ANTES
console.log(someData);

// DESPUÉS
__DEV__ && console.log(someData);
```

**Tiempo estimado:** 5 min  
**Prioridad:** P3 — Limpieza

---

## Checklist de verificación

- [ ] ARCH-001: BattleScreen refactorizado en hook + componentes
- [ ] ARCH-002: 15 casts en AppNavigator eliminados con tipado correcto
- [ ] ARCH-003: ErrorBoundary creado y wrapeando el Navigator
- [ ] ARCH-004: console.log en aiProfileEngine protegido con __DEV__
