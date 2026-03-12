# TORRE — Best Practices del Stack Tecnológico
> React Native 0.84 (New Architecture) · Reanimated v4 · Skia v2.5.1 · NativeWind v4 · TypeScript 5 · op-sqlite v15
> Auditoría v4.0 · 2026-03-12

---

## 1. React Native 0.84 — New Architecture (Fabric + JSI)

### Por qué importa en este proyecto
RN 0.84 activa New Architecture por defecto. JSI reemplaza el Bridge asíncrono — las llamadas nativas son síncronas por referencia directa. Esto cambia cómo se comportan las librerías nativas.

### Patrón 1 — Verificar New Architecture antes de añadir deps

```bash
# Verificar que una nueva dep tiene soporte
cat node_modules/nueva-dep/package.json | grep -E '"newArch|fabric|turbomodule"'
# Si no aparece nada, buscar en su README o issues si soporta RN 0.74+
```

Las deps actuales del proyecto (`react-native-svg`, `@shopify/react-native-skia`, `react-native-reanimated`, `react-native-gesture-handler`) ya tienen soporte completo.

### Patrón 2 — Animated vs Reanimated

**Cuándo usar Animated de RN:**
- Animaciones simples que no requieren gestos ni interpolación compleja
- `SimulationLoadingScreen` ya usa `Animated.loop` correctamente

**Cuándo usar Reanimated:**
- Animaciones interactivas (basadas en gestos)
- Animaciones en Canvas de Skia
- Interpolaciones complejas con `interpolate()`
- Cualquier animación que necesite correr en el hilo UI (no JS)

**Nunca mezclar** en el mismo componente para la misma propiedad — produce comportamientos inconsistentes.

### Patrón 3 — Modal solo una a la vez (iOS)

iOS solo soporta un `Modal` nativo activo simultáneamente. El proyecto ya maneja esto con overlays inline en `VillageScreen` (delete confirmation), `MainScreen` (load game), etc. Mantener este patrón — nunca anidar `<Modal>` dentro de `<Modal>`.

---

## 2. React Native Reanimated v4

### Patrón 1 — Worklets: regla de los closures

Un worklet corre en el hilo UI, no en el hilo JS. Las variables de React (state, props) no son accesibles directamente.

```typescript
// ❌ INCORRECTO — el worklet no puede leer state de React
const [isActive, setIsActive] = useState(false);
const style = useAnimatedStyle(() => ({
  opacity: isActive ? 1 : 0, // runtime error en el UI thread
}));

// ✅ CORRECTO — pasar state como shared value
const isActiveSV = useSharedValue(false);
useEffect(() => { isActiveSV.value = isActive; }, [isActive]);
const style = useAnimatedStyle(() => ({
  opacity: isActiveSV.value ? 1 : 0,
}));
```

### Patrón 2 — `withTiming` para UI con estética CRT

El proyecto usa fuentes monoespaciadas, transiciones abruptas, scanlines. Para mantener la estética:

```typescript
// Transiciones de estado (aparición/desaparición de secciones)
withTiming(1, { duration: 150, easing: Easing.linear }) // rápido y lineal = CRT feel

// Aparición de texto/resultados de combate
withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) })

// Barras de progreso (HP, daño)
withTiming(targetValue, { duration: 500, easing: Easing.out(Easing.cubic) })

// Evitar en este proyecto:
withSpring(...) // demasiado orgánico para estética terminal
```

### Patrón 3 — `cancelAnimation` en cleanup (obligatorio)

```typescript
// ✅ PATRÓN CORRECTO — presente en TypewriterText y SimulationLoadingScreen
useEffect(() => {
  const loop = Animated.loop(...); // o Reanimated equivalent
  loop.start();
  return () => loop.stop(); // ← OBLIGATORIO

  // Con Reanimated:
  sharedValue.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  return () => cancelAnimation(sharedValue); // ← OBLIGATORIO
}, []);
```

Sin el cleanup, la animación continúa en segundo plano, actualiza state de un componente desmontado, y produce el warning "setState on unmounted component".

### Patrón 4 — Animaciones de barras de HP en BattleScreen

Las barras de HP de enemigos se actualizan en cada round. Usar Reanimated para suavizarlas:

```typescript
// EnemyCard — dentro del componente
const hpWidth = useSharedValue(100); // porcentaje inicial

useEffect(() => {
  const pct = Math.round((enemy.currentHp / enemy.hp) * 100);
  hpWidth.value = withTiming(pct, { duration: 300, easing: Easing.out(Easing.quad) });
}, [enemy.currentHp]);

const hpBarStyle = useAnimatedStyle(() => ({
  width: `${hpWidth.value}%`,
}));

// En JSX — usar Animated.View en lugar de View para la barra
<Animated.View style={[S.enemyHpFill, hpBarStyle, { backgroundColor: hpColor }]} />
```

---

## 3. @shopify/react-native-skia v2.5.1

### Cuándo usar Skia en TORRE

Casos justificados en el proyecto actual:
- Efectos de phosphor glow dinámico sobre el CRTOverlay (actualmente SVG estático)
- Sprite rendering de personajes con transformaciones de shader (expresiones faciales)
- Efectos de partículas en momento de derrota o victoria (gotas de sangre, explosión)
- Mini-mapa procedural con path drawing

Casos donde NO usar Skia (usar NativeWind + View):
- Layout estático, texto, listas — más costoso que Views normales
- Cualquier cosa que no requiera pixel-level control

### Patrón 1 — Canvas en React.memo, siempre

```typescript
// ✅ SIEMPRE envolver el Canvas en memo para evitar re-crearlo
const CharacterPortrait = React.memo(({ uri, expression }: Props) => {
  return (
    <Canvas style={{ width: 96, height: 96 }}>
      <Image image={skiaImage} x={0} y={0} width={96} height={96} />
      {/* efectos sobre el sprite */}
    </Canvas>
  );
});
```

### Patrón 2 — Integración Skia + Reanimated para animaciones en Canvas

```typescript
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { Canvas, Circle, useAnimatedImageSampler } from '@shopify/react-native-skia';

// La integración nativa permite animar props del Canvas sin pasar por JS
const glowOpacity = useSharedValue(0);

useEffect(() => {
  glowOpacity.value = withRepeat(
    withTiming(1, { duration: 1200 }),
    -1, true
  );
  return () => cancelAnimation(glowOpacity);
}, []);

// El shared value se pasa directamente como prop — interpolado en el Skia thread
<Canvas>
  <Circle cx={48} cy={48} r={40} opacity={glowOpacity} color="rgba(0,255,65,0.3)" />
</Canvas>
```

### Patrón 3 — Font loading explícito en Canvas

Si se usa texto en Canvas (diferente al texto de NativeWind):

```typescript
import { useFonts } from '@shopify/react-native-skia';

// Las fonts del proyecto NO están disponibles automáticamente en Canvas
const fonts = useFonts({
  RobotoMono: [require('../../assets/fonts/RobotoMono-Regular.ttf')],
});

// NUNCA renderizar texto en Canvas sin esperar que fonts !== null
if (!fonts) return null; // o un placeholder
```

---

## 4. NativeWind v4

### Patrón 1 — Clases completamente estáticas (regla crítica)

NativeWind v4 compila Tailwind en build time. No puede resolver clases dinámicas.

```typescript
// ❌ INCORRECTO — Tailwind no puede analizar strings dinámicos en runtime
const color = isError ? 'red' : 'green';
<Text className={`text-${color}-500`} />

// ✅ CORRECTO — clases completas en condicional
<Text className={isError ? 'text-destructive' : 'text-primary'} />

// ✅ TAMBIÉN CORRECTO — objeto de clases
const RARITY_CLASS = {
  COMMON:    'text-primary/60',
  UNCOMMON:  'text-accent',
  RARE:      'text-secondary',
  LEGENDARY: 'text-destructive',
} as const;
<Text className={RARITY_CLASS[item.rarity] ?? 'text-primary/40'} />
```

### Patrón 2 — `className` vs `style` — cuándo mezclar

```typescript
// NativeWind para valores estáticos y semánticos
<View className="flex-1 bg-background p-4 border border-primary/30 rounded" />

// StyleSheet / style inline para valores calculados en runtime
<View style={{ width: `${progress}%`, opacity: fadeAnim }} />

// Mezcla válida — lo más común en el proyecto
<View
  className="absolute inset-0 rounded"
  style={{ transform: [{ scale: scaleAnim }] }}
/>
```

### Patrón 3 — Variables CSS del tema

El proyecto usa `global.css` con variables CSS. Siempre usar los nombres semánticos, nunca hardcodear hex:

```typescript
// ✅ CORRECTO — respeta el tema
<Text className="text-primary" />   // verde terminal #00FF41
<Text className="text-accent" />    // cyan #00E5FF
<Text className="text-destructive" /> // rojo #FF3E3E
<Text className="text-secondary" /> // dorado #FFB000

// ❌ INCORRECTO — hardcodeado, no cambia con el tema
<Text style={{ color: '#00FF41' }} />
// Excepción aceptable: cuando se necesita transparencia calculada dinámicamente
<Text style={{ color: `rgba(0,255,65,${0.3 + fadeProgress})` }} />
```

---

## 5. TypeScript 5 — Patterns del proyecto

### Patrón 1 — `satisfies` para objetos de configuración

```typescript
// ✅ CORRECTO — valida el tipo Y mantiene los literales exactos
const CYCLE_COST = {
  REST_SHORT:    0.5,
  REST_LONG:     1.0,
  RETURN_VILLAGE: 1.0,
  MOVE:          0.5,
  BATCH_SIMULATE: 0,
} satisfies Record<TimeAction, number>;
// CYCLE_COST.REST_SHORT es 0.5, no number genérico

// ❌ PEOR — pierde los literales
const CYCLE_COST: Record<TimeAction, number> = { ... };
```

### Patrón 2 — Discriminated unions (patrón del proyecto)

Ya usado en `seedUnificationService` y `SeedStatus`. Extender a otros casos:

```typescript
// Para estados de pantalla complejos en lugar de múltiples booleans
type BattlePhase =
  | { kind: 'INITIATIVE' }
  | { kind: 'PLAYER_ACTION'; actor: LivePartyMember }
  | { kind: 'ENEMY_AUTO'; actor: LiveEnemy }
  | { kind: 'ENDED'; outcome: 'VICTORY' | 'DEFEAT' };

// TypeScript hace narrowing automático en cada rama
if (phase.kind === 'PLAYER_ACTION') {
  phase.actor // ✅ TypeScript sabe que actor existe aquí
}
```

### Patrón 3 — `const` assertions para arrays de opciones cerradas

```typescript
// ✅ — TypeScript infiere el tipo literal del tuple
const ROOM_TYPES = ['NORMAL', 'ELITE', 'BOSS', 'TREASURE', 'EVENT', 'SAFE_ZONE', 'SECRET', 'START'] as const;
type RoomType = typeof ROOM_TYPES[number];
// Añadir un tipo sin actualizar el array → TS error en el punto de uso
```

### Patrón 4 — Narrowing seguro de rows SQLite

```typescript
// op-sqlite retorna 'any' — hacer narrowing explícito con fallbacks
function rowToCharacterSave(row: Record<string, unknown>): CharacterSave {
  return {
    name:       (row.name as string | null)        ?? 'Unknown',
    charClass:  (row.char_class as string | null)  ?? 'fighter',
    level:      (row.level as number | null)        ?? 1,
    hp:         (row.hp as number | null)           ?? 10,
    maxHp:      (row.max_hp as number | null)       ?? 10,
    alive:      Boolean(row.alive),
    // ...
  };
}
```

---

## 6. op-sqlite v15 — Patterns críticos

### Patrón 1 — `executeBatch` para múltiples INSERTs

```typescript
// ✅ CORRECTO — ya implementado en rivalRepository
db.executeBatch(
  rivals.map(r => [
    `INSERT OR REPLACE INTO rival_states (...) VALUES (?, ...)`,
    [r.id, r.seedHash, ...]
  ] as [string, unknown[]])
);
// Una llamada nativa para N registros

// ❌ INCORRECTO — N llamadas nativas para N registros
for (const rival of rivals) {
  db.execute('INSERT INTO ...', [...]);
}
```

### Patrón 2 — Transacciones para operaciones atómicas

```typescript
// ✅ CORRECTO — si falla el segundo, el primero se revierte
db.transaction(() => {
  db.execute('UPDATE saved_games SET gold = ? WHERE id = ?', [newGold, gameId]);
  db.execute('INSERT INTO transactions (game_id, amount) VALUES (?, ?)', [gameId, delta]);
});

// ❌ PELIGROSO — si el segundo falla, el gold queda en estado inconsistente
db.execute('UPDATE saved_games SET gold = ?', [newGold]);
db.execute('INSERT INTO transactions ...'); // si esto falla → inconsistencia
```

### Patrón 3 — `executeSync` vs `execute`

```typescript
// executeSync — para migrations (al init de la app, antes de cualquier render)
db.executeSync(`CREATE TABLE IF NOT EXISTS ...`);

// execute — para queries durante el juego (retorna rows de forma síncrona también)
const rows = db.execute('SELECT * FROM ...', [...]).rows;
// IMPORTANTE: aunque la API es síncrona, bloquea el hilo JS
// Queries pesadas → llamar desde useEffect, nunca en render/useMemo
```

### Patrón 4 — `INSERT OR REPLACE` para upserts

```typescript
// ✅ CORRECTO — idempotente y eficiente
db.execute(
  'INSERT OR REPLACE INTO rival_states (id, ...) VALUES (?, ...)',
  [rivalId, ...]
);

// ❌ VERBOSO — dos queries cuando una alcanza
const existing = db.execute('SELECT id FROM rival_states WHERE id = ?', [rivalId]);
if (existing.rows.length > 0) {
  db.execute('UPDATE rival_states SET ... WHERE id = ?', [..., rivalId]);
} else {
  db.execute('INSERT INTO rival_states (...) VALUES (?)', [...]);
}
```
