# Code Review: `src/navigation/AppNavigator.tsx`

**Revisado:** 2026-03-14  
**Líneas de código:** 107  
**Severidad general:** 🟡 Media  
**Comentarios:** 2 hallazgos

---

## Resumen

El navigator implementa lazy loading correctamente para 15 de 22 pantallas — esto es bueno
para TTI. Sin embargo, las 15 pantallas lazy-loaded usan casts `as React.ComponentType<object>`
que deshabilitan el type-checking de los params de navegación.

---

## [CR-002] 15 casts `as React.ComponentType<object>` deshabilitan type-safety

> **Línea(s):** 86-105  
> **Tipo:** TypeScript / Bug potencial  
> **Severidad:** 🟡 Media

**Código actual:**
```tsx
<Stack.Screen name="Map" component={MapScreen as React.ComponentType<object>} />
<Stack.Screen name="Battle" component={BattleScreen as React.ComponentType<object>} />
// ... 13 más
```

**Problema:**
El cast silencia TypeScript. Si se navega a "Battle" sin `roomId` o `roomType`, el compilador
no lo detecta. Esto puede causar crashes en runtime que son difíciles de depurar.

**Causa raíz:**
Los componentes `lazy()` retornan `React.ComponentType<P>` pero React Navigation espera que
las pantallas declaren sus props de forma que el stack pueda verificarlas. La solución es que
cada screen declare sus props usando `ScreenProps<'Name'>`.

**Solución — en cada screen lazy:**
```tsx
// src/screens/BattleScreen.tsx
import type { ScreenProps } from '../navigation/types';
type Props = ScreenProps<'Battle'>;
export const BattleScreen: React.FC<Props> = ({ route, navigation }) => {
  const { roomId, roomType } = route.params;
  // ...
};
```

**Una vez todas las screens tienen tipo correcto:**
```tsx
// AppNavigator.tsx — sin cast
<Stack.Screen name="Battle" component={BattleScreen} />
```

**Tiempo estimado:** 2-3 horas  
**Referencia:** ARCH-002 en audit-002

---

## [CR-003] `LazyFallback` con inline style — crear StyleSheet

> **Línea(s):** 64-68  
> **Tipo:** Performance / Style  
> **Severidad:** 🟢 Baja

**Código actual:**
```tsx
const LazyFallback = () => (
  <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator color="#FFB000" />
  </View>
);
```

**Problema:**
Inline object style se crea en cada render. Para un fallback que puede mostrarse durante
transiciones de screen, es mejor usar StyleSheet.create().

**Solución:**
```tsx
const lazyStyles = StyleSheet.create({
  fallback: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
});
const LazyFallback = () => (
  <View style={lazyStyles.fallback}>
    <ActivityIndicator color="#FFB000" />
  </View>
);
```

**Tiempo estimado:** 5 min
