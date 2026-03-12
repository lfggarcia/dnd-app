# TORRE — Best Practices del Stack Tecnológico
> React Native 0.84 · Reanimated v4 · Skia v2.5.1 · NativeWind v4 · TypeScript 5
> Auditoría v3.0 · 2026-03-11 · Específico para el stack real del proyecto

---

## Introducción

Este documento responde a la pregunta: **¿qué hay que saber del stack específico que usa TORRE?** No es una referencia exhaustiva de cada librería — es un mapa de los puntos donde este stack en particular tiene trampas no obvias, breaking changes recientes, y patrones que el equipo debe conocer para no romper cosas.

---

## 1. React Native 0.84 — New Architecture (Fabric + JSI)

### ¿Qué cambió y por qué importa?

RN 0.84 usa **New Architecture por defecto**: Fabric (nuevo renderer) + JSI (JavaScript Interface, reemplaza el Bridge). El Bridge antiguo era asíncrono con JSON serialization. JSI es síncrono y usa referencias directas a objetos C++.

**Implicación práctica:** Las dependencias que usaban el Bridge antiguo pueden fallar silenciosamente o con crashes nativos si no tienen soporte explícito para New Architecture. Antes de añadir cualquier dependencia nueva, verificar que tenga `"newArchEnabled": true` en su README o que sea pure JS.

### Patrón 1 — Verificar compatibilidad New Architecture

```bash
# Al añadir una dep nueva, verificar en su package.json:
cat node_modules/nueva-dep/package.json | grep -E '"fabric|newArch|turbomodule"'

# O buscar en su código nativo:
ls node_modules/nueva-dep/ios/*.mm  # .mm = Objective-C++ = puede soportar JSI
ls node_modules/nueva-dep/android/src/main/jni/  # JNI = turbomodule Android
```

### Patrón 2 — No mezclar componentes Fabric con el renderer antiguo

En RN 0.84 con New Arch, los componentes nativos deben ser **Fabric components** (TurboModules). `react-native-svg`, `@shopify/react-native-skia`, y `react-native-gesture-handler` ya los soportan en sus versiones actuales del proyecto.

Si el equipo añade una lib nativa que usa el renderer antiguo y no tiene Fabric support, verán errores como:
```
ERROR  Invariant Violation: TurboModuleRegistry.getEnforcing(...): 
'RNSomeModule' could not be found
```

### Patrón 3 — Fabric y Animated API

Con New Architecture, `Animated` de React Native usa Fabric internamente. Para animaciones simples (fade, slide), `Animated` sigue siendo válido. Para animaciones complejas o basadas en gestos, usar Reanimated v4 (ver sección 2).

```typescript
// ✅ OK para animaciones simples (SimulationLoadingScreen ya usa esto correctamente)
const pulseAnim = useRef(new Animated.Value(0.4)).current;
Animated.loop(Animated.sequence([...])).start();

// ✅ MEJOR para animaciones interactivas o con físicas
// → Usar Reanimated v4 (ver sección 2)
```

### Patrón 4 — Metro bundler y New Architecture

`metro.config.js` del proyecto ya tiene la configuración correcta. No modificar `transformer.unstable_allowRequireContext` sin entender las implicaciones. Si se añaden assets nuevos (fuentes, íconos SVG), registrarlos en `react-native.config.js`.

---

## 2. React Native Reanimated v4

### ¿Qué cambió en v4 respecto a v3?

Reanimated v4 reescribió la API con un modelo más cercano a Signals/reactivo. Los cambios más importantes para el proyecto:

1. **`useSharedValue` sigue siendo la base**, pero la reactividad es más automática
2. **`useAnimatedStyle` ya no necesita `runOnJS`** para la mayoría de casos
3. **Worklets deben ser funciones puras** — no acceder a variables del closure de React directamente

### Patrón 1 — Worklets y closures

El error más común en Reanimated v4: acceder a estado de React dentro de un worklet sin pasarlo como argumento.

```typescript
// ❌ INCORRECTO — worklet accede a variable de React closure
const isVisible = useState(false)[0];
const animatedStyle = useAnimatedStyle(() => ({
  opacity: withTiming(isVisible ? 1 : 0), // ← isVisible no está en el worklet thread
}));

// ✅ CORRECTO — pasar como shared value
const isVisibleSV = useSharedValue(false);
const animatedStyle = useAnimatedStyle(() => ({
  opacity: withTiming(isVisibleSV.value ? 1 : 0), // ← SV es accesible en worklet
}));

// Cuando el estado cambia:
useEffect(() => {
  isVisibleSV.value = isVisible;
}, [isVisible]);
```

### Patrón 2 — `runOnJS` solo cuando realmente se necesita

`runOnJS` permite llamar funciones de React (setState, callbacks) desde el worklet thread. Tiene overhead de marshaling. Usarlo solo para actualizar estado de React desde gestos, no para lógica de animación.

```typescript
// ✅ CORRECTO — runOnJS para setState desde gesto
const onDragEnd = useAnimatedGestureHandler({
  onEnd: (event) => {
    if (event.translationX > THRESHOLD) {
      runOnJS(setSwipedRight)(true); // ← necesario, setState es función JS
    }
  }
});

// ❌ INCORRECTO — runOnJS innecesario dentro de animación
const animatedStyle = useAnimatedStyle(() => {
  const opacity = runOnJS(calculateOpacity)(progress.value); // ← calculateOpacity debería ser worklet
  return { opacity };
});
```

### Patrón 3 — `withSpring` vs `withTiming`

En el contexto de TORRE (estética CRT, transiciones bruscas):

```typescript
// Para transiciones de UI tipo CRT (snap instantáneo o muy rápido):
withTiming(targetValue, { duration: 150, easing: Easing.step0 })

// Para elementos que "rebotan" (íconos, botones de acción):
withSpring(targetValue, { damping: 20, stiffness: 200 })

// Para la mayoría de transiciones del proyecto (CRT feel):
withTiming(targetValue, { duration: 200, easing: Easing.linear })
```

### Patrón 4 — `cancelAnimation` en cleanup

Todo `useEffect` que inicie una animación debe cancelarla en el cleanup para evitar memory leaks y actualizaciones de estado en componentes desmontados.

```typescript
// ✅ CORRECTO — ya implementado en SimulationLoadingScreen y TypewriterText
useEffect(() => {
  const loop = Animated.loop(...); // o Reanimated equivalent
  loop.start();
  return () => loop.stop(); // ← cleanup
}, []);

// Con Reanimated shared values:
useEffect(() => {
  sharedValue.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  return () => {
    cancelAnimation(sharedValue); // ← cancelar en cleanup
  };
}, []);
```

### Patrón 5 — Evitar crear shared values en render

Los `useSharedValue` deben ser estables. No crearlos dentro de condicionales o loops.

```typescript
// ✅ CORRECTO
const opacity = useSharedValue(0);
const scale = useSharedValue(1);

// ❌ INCORRECTO — crea un SV nuevo en cada render donde condition cambia
if (condition) {
  const opacity = useSharedValue(0); // ← viola Rules of Hooks + crea SV huérfano
}
```

---

## 3. @shopify/react-native-skia v2.5.1

### ¿Qué es Skia y cuándo usarlo?

Skia es un motor de gráficos 2D de Google que React Native Skia expone como componentes React. Opera en su propio thread (Skia thread) sin pasar por el hilo JS.

**Cuándo usar Skia en TORRE:**
- Efectos visuales CRT complejos (glitch, noise, phosphor glow)
- Gráficos de stats en tiempo real que se actualizan frecuentemente
- Sprite rendering con transformaciones complejas
- Canvas-based UI elements que no son posibles con View/SVG

**Cuándo NO usar Skia:**
- Layouts estándar (usar NativeWind/View)
- Listas y texto estático (FlatList es más eficiente)
- Íconos simples (usar react-native-svg)

### Patrón 1 — Canvas y el Skia thread

Los componentes de Skia se renderizan en el **Skia thread**, no en el hilo JS ni en el hilo UI de React Native. Esto significa:

```typescript
// ✅ CORRECTO — datos pasados como props simples al Canvas
<Canvas style={{ width: 200, height: 200 }}>
  <Circle cx={cx} cy={cy} r={r} color="green" />
</Canvas>

// ⚠️ ATENCIÓN — actualizar valores frecuentemente desde JS tiene overhead
// Para animaciones fluidas en Canvas, usar Skia + Reanimated juntos:
const cx = useSharedValue(100);
// El valor se interpola en el Skia thread directamente
<Canvas>
  <Circle cx={cx} ... />  {/* Reanimated SV funciona como prop de Skia */}
</Canvas>
```

### Patrón 2 — Skia + Reanimated para animaciones performantes

La integración nativa entre Skia y Reanimated permite animar propiedades del Canvas **sin pasar por el hilo JS**:

```typescript
import { useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Canvas, Circle, useComputedValue } from '@shopify/react-native-skia';

// ✅ PATRÓN RECOMENDADO para animaciones en Canvas
const progress = useSharedValue(0);

useEffect(() => {
  progress.value = withRepeat(withTiming(1, { duration: 2000 }), -1, true);
  return () => cancelAnimation(progress);
}, []);

// useComputedValue deriva valores en el Skia thread
const radius = useComputedValue(() => {
  return 10 + progress.value * 20; // interpolación en Skia thread
}, [progress]);

return (
  <Canvas style={{ flex: 1 }}>
    <Circle cx={100} cy={100} r={radius} color="cyan" />
  </Canvas>
);
```

### Patrón 3 — Shaders y filtros CRT

Para el efecto CRT phosphor glow del proyecto, Skia permite shaders GLSL:

```typescript
import { Canvas, Paint, RuntimeShader, Skia } from '@shopify/react-native-skia';

// Shader GLSL para efecto de glow phosphor
const glowShader = Skia.RuntimeEffect.Make(`
  uniform float intensity;
  uniform vec2 resolution;
  
  half4 main(vec2 fragCoord) {
    vec2 uv = fragCoord / resolution;
    // Efecto scanline + vignette
    float scanline = sin(uv.y * resolution.y * 3.14159) * 0.5 + 0.5;
    float vignette = 1.0 - length(uv - 0.5) * 1.5;
    return half4(0.0, intensity * scanline * vignette, 0.0, 1.0);
  }
`);

// Usar con cuidado — los shaders tienen costo de compilación al primer uso
// Compilar en el init del componente, no en cada render
```

> **Nota para el proyecto:** El `CRTOverlay` actual usa SVG pattern (solución correcta para el efecto de scanlines estático). Skia shaders serían el paso siguiente si se quiere añadir animación al efecto (parpadeo, glitch dinámico).

### Patrón 4 — Font loading en Skia

Si se usan fonts en Canvas de Skia (diferente a NativeWind/StyleSheet):

```typescript
// Las fonts de NativeWind/StyleSheet NO son automáticamente disponibles en Skia
// Hay que cargarlas explícitamente:
import { useFonts } from '@shopify/react-native-skia';

const fonts = useFonts({
  RobotoMono: [require('./assets/fonts/RobotoMono-Regular.ttf')],
});

// Solo usar después de que fonts !== null
if (!fonts) return null;
```

### Patrón 5 — Evitar re-renders del Canvas

El Canvas de Skia es costoso de re-crear. Memoizar el componente que lo contiene:

```typescript
// ✅ CORRECTO — Canvas no se re-crea en cada render del padre
const CharacterPortrait = React.memo(({ character }: Props) => {
  return (
    <Canvas style={{ width: 64, height: 64 }}>
      {/* sprite rendering */}
    </Canvas>
  );
});

// ❌ INCORRECTO — Canvas se destruye y recrea cuando el padre hace setState
const PartyScreen = () => {
  const [selected, setSelected] = useState(0);
  return (
    <View>
      <Canvas>{/* Este Canvas se recrea cada vez que selected cambia */}</Canvas>
    </View>
  );
};
```

---

## 4. NativeWind v4

### ¿Qué cambió en v4?

NativeWind v4 usa el **compiler de Tailwind CSS directamente** en build time. Las clases se resuelven en tiempo de compilación y se convierten a StyleSheet de React Native. Esto elimina el parsing en runtime de v3.

**Implicación:** No se pueden generar clases dinámicamente como strings. Tailwind necesita ver las clases completas en el código.

### Patrón 1 — Clases dinámicas

```typescript
// ❌ INCORRECTO — Tailwind no puede analizar strings dinámicos
const color = isError ? 'red' : 'green';
<Text className={`text-${color}-500`} /> // ← 'text-red-500' nunca aparece en el código

// ✅ CORRECTO — clases completas en condicional
<Text className={isError ? 'text-red-500' : 'text-green-500'} />

// ✅ TAMBIÉN CORRECTO — objeto con claves completas
const colorClass = {
  error: 'text-destructive',
  warning: 'text-yellow-500',
  ok: 'text-primary',
} as const;
<Text className={colorClass[status]} />
```

### Patrón 2 — Temas y variables CSS

El proyecto usa variables CSS en `global.css` para el tema CRT (colores `primary`, `background`, `destructive`, `accent`). Estas se mapean automáticamente a NativeWind.

```css
/* global.css — ya configurado en el proyecto */
:root {
  --color-primary: #00ff41;      /* Verde terminal */
  --color-background: #0a0a0a;   /* Negro profundo */
  --color-destructive: #ff3333;  /* Rojo de error */
  --color-accent: #00ccff;       /* Cyan de acento */
}
```

```typescript
// Usar siempre variables semánticas, no valores hardcoded
<Text className="text-primary" />          // ✅
<Text className="text-[#00ff41]" />        // ❌ hardcoded, no respeta theming
```

### Patrón 3 — `className` vs `style` — cuándo usar cada uno

```typescript
// NativeWind (className): para layout, tipografía, colores, espaciado estático
<View className="flex-1 bg-background p-4 border border-primary/30 rounded" />

// StyleSheet (style): para valores calculados o dinámicos que NativeWind no puede expresar
<View style={{ width: `${progress}%`, transform: [{ rotate: `${angle}deg` }] }} />

// Ambos pueden coexistir en el mismo componente
<View
  className="absolute inset-0 rounded"
  style={{ opacity: animatedOpacity }}
/>
```

### Patrón 4 — `nativewind-env.d.ts`

El archivo ya existe en el proyecto. No eliminar. Es la declaración de tipos que permite autocomplete de `className` en TypeScript.

---

## 5. TypeScript 5 — Features usadas en el proyecto

### Patrón 1 — `satisfies` operator (TS 4.9+)

Útil para validar objetos contra un tipo sin perder la inferencia del tipo literal:

```typescript
// Sin satisfies — pierde los tipos literales
const CYCLE_COSTS: Record<string, number> = {
  MOVE: 0.5,
  REST_SHORT: 0.5,
};
// CYCLE_COSTS.MOVE es 'number', no '0.5'

// Con satisfies — valida el tipo Y mantiene los literales
const CYCLE_COSTS = {
  MOVE: 0.5,
  REST_SHORT: 0.5,
  REST_LONG: 2.0,
} satisfies Record<string, number>;
// CYCLE_COSTS.MOVE es '0.5', TypeScript lo sabe
```

### Patrón 2 — Template Literal Types para keys de store

Usado en `makePRNG` para namespacing de seeds:

```typescript
type PRNGContext = `${string}_${string}`;
// Permite: 'seedHash_moral_cycle', 'seedHash_encounter_floor'
// Rechaza: 'sin_underscore'

// En el proyecto, siempre seguir el patrón:
const rng = makePRNG(`${seedHash}_${context}_${identifier}`);
```

### Patrón 3 — `const` assertions para arrays de opciones

```typescript
// ✅ CORRECTO — TypeScript infiere el tipo literal del array
const AI_PROFILES = ['AGGRESSIVE', 'DEFENSIVE', 'OPPORTUNISTIC', 'EXPANSIONIST', 'SURVIVALIST'] as const;
type AIProfile = typeof AI_PROFILES[number];
// AIProfile = 'AGGRESSIVE' | 'DEFENSIVE' | 'OPPORTUNISTIC' | 'EXPANSIONIST' | 'SURVIVALIST'

// Si alguien añade un sexto perfil sin actualizar el type:
const newProfile: AIProfile = 'PACIFIST'; // ← TypeScript error inmediato
```

### Patrón 4 — Discriminated unions para estados de pantalla

El proyecto usa este patrón en `seedUnificationService`:

```typescript
// ✅ PATRÓN EXISTENTE — type-safe con narrowing automático
export type SeedStatus =
  | { type: 'NEW' }
  | {
      type: 'EXISTING';
      previousGame: SavedGame;
      inheritedLevel: number;
      previousPartyNames: string[];
    };

// Narrowing automático en consumidor:
const status = checkSeedStatus(hash);
if (status.type === 'EXISTING') {
  console.log(status.inheritedLevel); // ✅ TypeScript sabe que existe
  console.log(status.previousGame);   // ✅ TypeScript sabe que existe
}
// status.inheritedLevel fuera del if → TS Error (correcto)
```

Aplicar este patrón siempre que un objeto pueda tener "formas" distintas.

### Patrón 5 — `strictNullChecks` y op-sqlite

op-sqlite devuelve `rows` donde los valores de columna son `any`. Hacer narrowing explícito al leer:

```typescript
// ✅ CORRECTO — narrow explícito con fallback
const row = rows[0];
const level = (row.level as number | null) ?? 1;
const name = (row.name as string | null) ?? 'Unknown';

// ❌ PELIGROSO — asumir el tipo sin verificar
const level = row.level; // 'any' → errores silenciosos en runtime
```

---

## 6. op-sqlite v15 — Patrones críticos

### Patrón 1 — Transacciones para operaciones múltiples

```typescript
// ✅ CORRECTO — atomic write, rollback automático si algo falla
const db = getDB();
db.transaction(() => {
  db.execute('UPDATE saved_games SET gold = ? WHERE id = ?', [newGold, gameId]);
  db.execute('INSERT INTO transactions (game_id, amount) VALUES (?, ?)', [gameId, delta]);
});

// ❌ INCORRECTO — dos escrituras independientes, si la segunda falla el gold queda desincronizado
db.execute('UPDATE saved_games SET gold = ? WHERE id = ?', [newGold, gameId]);
db.execute('INSERT INTO transactions ...'); // si esto falla, gold ya se actualizó
```

### Patrón 2 — Queries en el hilo JS son síncronas

op-sqlite v15 (a diferencia de better-sqlite3 en Node) corre síncronamente en el hilo JS de React Native. Esto es conveniente pero significa que queries lentas bloquean el UI thread.

**Regla:** Queries simples (SELECT por PK, INSERT/UPDATE de 1 fila) son OK síncronas. Queries con JOINs complejos o sobre tablas grandes deben moverse a `useEffect` o incluso a un `setTimeout(0)` para ceder el hilo entre frames.

### Patrón 3 — `execute` vs `executeBatch`

```typescript
// Para múltiples INSERTs del mismo tipo, usar executeBatch:
db.executeBatch([
  ['INSERT INTO rival_states (...) VALUES (?, ...)', [id1, ...]],
  ['INSERT INTO rival_states (...) VALUES (?, ...)', [id2, ...]],
  // ... hasta 10 rivales
]);
// Una sola call nativa vs N calls → significativamente más rápido para lotes
```

---

## Checklist de PR para código nuevo con este stack

- [ ] ¿Las nuevas deps nativas tienen soporte para New Architecture (Fabric)?
- [ ] ¿Los worklets de Reanimated no acceden a closures de React directamente?
- [ ] ¿Las animaciones en Canvas usan `useSharedValue` + `useComputedValue` en vez de setState?
- [ ] ¿Las clases de NativeWind son strings completos (no interpolados con variables)?
- [ ] ¿Los valores de columnas de SQLite hacen cast explícito y tienen fallback?
- [ ] ¿Las transacciones SQL agrupan writes relacionados?
- [ ] ¿Se usa `satisfies` o `as const` en lugar de `as Type` donde sea posible?
- [ ] ¿`cancelAnimation` se llama en el cleanup de effectos con Reanimated?
- [ ] ¿Los Canvas de Skia están en componentes `React.memo`?
