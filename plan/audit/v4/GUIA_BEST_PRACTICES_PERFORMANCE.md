# TORRE — Best Practices, Performance y Stack
> Auditoría v5.0 · 2026-03-12  
> Stack: React Native 0.84 (New Architecture) · Reanimated v4 · NativeWind v4 · TypeScript 5 · op-sqlite v15

---

## Inventario de patrones establecidos (no cambiar sin justificación)

| Patrón | Dónde se aplica | Por qué |
|--------|----------------|---------|
| DB queries en `useEffect`, no en `useMemo` | `VillageScreen`, `GuildScreen`, `GlossaryModal` | op-sqlite es síncrono en hilo JS — bloquea si se ejecuta durante render |
| Lookup O(1) con `Map` memoizado | `MapScreen` (roomMap) | Elimina `find()` en flatMap SVG — de O(n²) a O(n) |
| Selectores granulares de Zustand | `BattleScreen`, `VillageScreen`, `ExtractionScreen` | Evita re-render por cambios en otros campos del store |
| `React.lazy` en `AppNavigator` | 10 pantallas | Bundle inicial más pequeño — pantallas no usadas no cargan |
| `React.memo` en componentes puros | `ConfirmModal`, `ConnectionLines`, `TurnToken` | Evita re-renders cuando el padre cambia pero las props no |
| SVG pattern en `CRTOverlay` | `CRTOverlay.tsx` | 1 nodo SVG vs 100 Views — reduce árbol de nodos nativo |
| `useCallback` con deps correctas | Handlers en todas las pantallas | Estabilidad de referencias para memo y efectos |

---

## PF-01 🔴 — Imágenes de personajes: 23 por personaje × ~3MB = crash en DB

### El problema real

El sistema de personajes genera hasta 23 imágenes por personaje (1 portrait base + expresiones). Cada imagen pesa ~3MB en promedio. Con una party de 4 personajes:

```
4 personajes × 23 imágenes × 3 MB = 276 MB en DB
```

**op-sqlite** almacena estas imágenes como strings base64 en el campo `portrait` y en `expressions_json` de `saved_games`. Cuando la DB crece a este tamaño, los siguientes problemas emergen:

- `getActiveSavedGame()` deserializa todo el JSON en el hilo JS
- `JSON.parse(row.party_data)` con 276MB de base64 bloquea el hilo JS hasta 2-3 segundos
- En Android, SQLite tiene un límite por defecto de 100MB de tamaño de archivo — la app crashea

### Por qué se almacena así

Las imágenes se guardan como base64 en el JSON de `party_data` porque fue la solución más simple inicialmente. No hay un sistema de caché de archivos separado.

### Solución recomendada — Filesystem + DB como índice

**Concepto:** Las imágenes se guardan en el filesystem local (`RNFS` o `expo-file-system`), y la DB solo almacena las rutas de archivo.

```typescript
// ANTES — base64 en DB (problemático)
portrait: "/9j/4AAQSkZJRgABAQ..." // 3MB como string

// DESPUÉS — ruta en DB (liviano)
portrait: "file:///data/user/0/com.torre/files/portraits/char_uuid_base.jpg"
```

### Paso 1 — Instalar react-native-fs

```bash
yarn add react-native-fs
# o si ya está en el proyecto, verificar:
cat package.json | grep -i "fs\|file"
```

### Paso 2 — Crear imageStorageService

```typescript
// src/services/imageStorageService.ts
import RNFS from 'react-native-fs';
import { uuidv4 } from 'uuid'; // ya requerido por FEAT-07

const PORTRAITS_DIR = `${RNFS.DocumentDirectoryPath}/portraits`;
const EXPRESSIONS_DIR = `${RNFS.DocumentDirectoryPath}/expressions`;

/** Garantiza que el directorio existe antes de escribir */
async function ensureDir(dir: string): Promise<void> {
  const exists = await RNFS.exists(dir);
  if (!exists) await RNFS.mkdir(dir);
}

/**
 * Guarda una imagen base64 en el filesystem y retorna la ruta local.
 * Si la imagen ya existe (misma ruta), no vuelve a escribir.
 */
export async function savePortraitToFS(
  characterId: string,
  base64Data: string,
  expressionKey?: string, // undefined = portrait base; 'angry', 'happy', etc.
): Promise<string> {
  const dir = expressionKey ? EXPRESSIONS_DIR : PORTRAITS_DIR;
  await ensureDir(dir);

  const filename = expressionKey
    ? `${characterId}_${expressionKey}.jpg`
    : `${characterId}_base.jpg`;
  const filePath = `${dir}/${filename}`;

  // Eliminar header data URI si existe
  const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

  await RNFS.writeFile(filePath, cleanBase64, 'base64');
  return `file://${filePath}`;
}

/** Elimina todas las imágenes de un personaje (al morir permanentemente) */
export async function deleteCharacterImages(characterId: string): Promise<void> {
  try {
    const portraitPath = `${PORTRAITS_DIR}/${characterId}_base.jpg`;
    if (await RNFS.exists(portraitPath)) await RNFS.unlink(portraitPath);

    // Eliminar expresiones
    const files = await RNFS.readDir(EXPRESSIONS_DIR);
    const charFiles = files.filter(f => f.name.startsWith(characterId));
    await Promise.all(charFiles.map(f => RNFS.unlink(f.path)));
  } catch (e) {
    console.warn('[imageStorageService] delete failed', e);
  }
}

/** Verifica si el archivo local sigue existiendo (por si se limpió el cache) */
export async function portraitExists(localUri: string): Promise<boolean> {
  if (!localUri.startsWith('file://')) return false;
  return RNFS.exists(localUri.replace('file://', ''));
}
```

### Paso 3 — Migrar la carga de imágenes

```typescript
// PartyScreen.tsx — al generar retratos
// ANTES: guardaba base64 directamente
saveCharacterPortraits({ [String(idx)]: base64Uri });

// DESPUÉS: guarda en filesystem, persiste ruta
const localUri = await savePortraitToFS(char.characterId, base64Uri);
saveCharacterPortraits({ [String(idx)]: localUri }); // ← guarda ruta, no base64
```

```typescript
// CharacterSave — el campo portrait ya es string
// Solo cambia de contener base64 a contener 'file://...'
// Compatibilidad: si portrait empieza con 'data:' o '/9j/', es base64 viejo
// Si empieza con 'file://', es la nueva ruta

export function resolvePortraitSource(portrait: string | undefined): { uri: string } | null {
  if (!portrait) return null;
  if (portrait.startsWith('file://') || portrait.startsWith('http')) {
    return { uri: portrait };
  }
  // Retrocompatibilidad: base64 viejo — mostrar pero no guardar de vuelta
  return { uri: `data:image/jpeg;base64,${portrait}` };
}
```

### Paso 4 — Limpiar base64 de saves existentes (migración lazy)

No hacer una migración masiva que bloqueé el inicio. En cambio, migración lazy:

```typescript
// gameRepository.ts — en rowToSavedGame
// Para cada personaje con portrait en base64, migrar en background
const migratePartyImagesLazy = async (party: CharacterSave[]): Promise<CharacterSave[]> => {
  return Promise.all(party.map(async c => {
    if (!c.portrait || c.portrait.startsWith('file://')) return c; // ya migrado
    try {
      const localUri = await savePortraitToFS(c.characterId ?? 'legacy', c.portrait);
      return { ...c, portrait: localUri };
    } catch {
      return c; // si falla, mantener base64 (degradado graceful)
    }
  }));
};
```

### Paso 5 — Comprimir imágenes antes de guardar

El tamaño de 3MB por imagen es un problema de origen. La generación debe comprimir:

```typescript
// geminiImageService.ts o donde se genera/recibe la imagen
// Al recibir el base64 de la API:

// Con react-native-image-manipulator (o similar)
import ImageManipulator from 'react-native-image-manipulator';

const compressed = await ImageManipulator.manipulateAsync(
  tempUri,
  [{ resize: { width: 512 } }], // reducir de ~1024 a 512px — igual de útil en pantalla
  { compress: 0.7, format: 'jpeg' } // 70% calidad JPEG — visual y físicamente acceptable
);
// Resultado esperado: 3MB → ~150-200KB (reducción 15x)
```

**Impacto esperado:**
- 200KB × 23 imágenes × 4 personajes = ~18MB en filesystem (vs 276MB en DB)
- `party_data` en SQLite: solo rutas de texto, ~500 bytes por personaje
- Tiempo de carga de `getActiveSavedGame()`: de ~2s a <10ms

**Checklist:**
- [ ] `react-native-fs` instalado y enlazado
- [ ] `imageStorageService.ts` creado con `savePortraitToFS` y `deleteCharacterImages`
- [ ] `PartyScreen` guarda ruta en lugar de base64
- [ ] `resolvePortraitSource` maneja retrocompatibilidad base64/file URI
- [ ] Compresión aplicada al recibir imágenes de la API (512px, 70% JPEG)
- [ ] DB no almacena base64 en nuevas sesiones
- [ ] Imágenes antiguas en base64 se migran lazy en background

---

## PF-02 🟠 — MapScreen: performance del canvas SVG

### Diagnóstico actual

`MapScreen` usa un `Svg` para las líneas de conexión y Views absolutas para los nodos. Con 15-20 rooms, el render es aceptable. Pero hay patrones que podrían degradar en pisos con más rooms.

**Patrón costoso actual:**
```typescript
// ConnectionLines — se re-renderiza cuando cambia floor, roomMap, currentRoomId, accessibleIds, reverseIds
// Esto pasa cada vez que el jugador mueve el cursor sobre el mapa
```

**El componente ya usa `React.memo`** — correcto. Pero sus props cambian con cada press de sala porque `accessibleIds` y `reverseIds` son `Set`/`Map` recreados en cada render del padre.

### Fix — memoizar los Sets con `useMemo`

```typescript
// MapScreen.tsx — las deps de accessibleIds ya son estables
// Verificar que accessibleIds se computa con useMemo de deps estables:
const accessibleIds = useMemo(() => {
  if (!floor || !currentRoomId) return new Set<number>();
  return new Set(
    (floor.rooms.find(r => r.id === currentRoomId)?.connections ?? [])
  );
}, [floor, currentRoomId]); // ← solo cambia cuando el jugador se mueve

// Si actualmente es un cálculo inline en el render, moverlo a useMemo
```

### PF-03 🟠 — MarketScreen: regenerar stock en cada render

Al crear `MarketScreen`, evitar llamar `generateMarketStock` en el render:

```typescript
// ✅ CORRECTO — memoizar con deps estables
const marketStock = useMemo(
  () => generateMarketStock(seedHash, cycle, maxFloor),
  [seedHash, cycle, maxFloor] // solo cambia cuando el ciclo avanza
);

// ❌ INCORRECTO — se regenera en cada re-render
const marketStock = generateMarketStock(seedHash, cycle, maxFloor); // sin memo
```

### PF-04 🟠 — ExtractionScreen: getItemsByGame sin paginación

Al implementar FEAT-01, no cargar todos los ítems del juego. En late game puede haber 200+ registros.

```typescript
// ✅ CORRECTO — solo ítems del ciclo actual y anterior
const sessionItems = getRecentItems(activeGameId, activeCycle - 1); // LIMIT 50

// ❌ INCORRECTO — trae todo el historial
const allItems = getItemsByGame(activeGameId); // sin filtro de ciclo
```

---

## PF-05 🔴 — worldSimulator: ejecución en el hilo JS principal

### El problema

`simulateWorld()` puede ejecutar miles de iteraciones de PRNG y actualizar múltiples registros en DB. Se llama sincrónicamente en el hilo JS, bloqueando el UI thread durante la simulación.

### Diagnóstico

```typescript
// MapScreen.tsx — llamada que puede bloquear
useEffect(() => {
  if (!activeGame || newCycleInt === prevCycleInt) return;
  simulateWorld(activeGame.seedHash, prevCycleInt, newCycleInt); // ← sync en JS thread
}, [activeCycle]);
```

### Fix preventivo — envolver en batch y yielding

```typescript
// El fix ideal es mover simulateWorld a un Worker (react-native-worker o worklet de Reanimated)
// Como fix inmediato: usar InteractionManager para diferir la simulación

import { InteractionManager } from 'react-native';

useEffect(() => {
  if (!activeGame || newCycleInt === prevCycleInt) return;
  
  // Esperar a que terminen las animaciones antes de simular
  const handle = InteractionManager.runAfterInteractions(() => {
    simulateWorld(activeGame.seedHash, prevCycleInt, newCycleInt);
  });
  
  return () => handle.cancel();
}, [activeCycle]);
```

---

## React Native 0.84 — Reglas del stack

### New Architecture (Fabric + JSI)

RN 0.84 activa New Architecture por defecto. Las llamadas nativas son síncronas por JSI (ya no hay Bridge asíncrono).

**Regla:** Antes de añadir una nueva dependencia nativa, verificar soporte de New Architecture:

```bash
cat node_modules/nueva-dep/package.json | grep -E '"newArch|fabric|turbomodule"'
```

Las deps existentes del proyecto ya tienen soporte: `react-native-svg`, `react-native-reanimated`, `react-native-gesture-handler`.

### Reanimated v4 — Reglas

**Regla 1 — Worklets no pueden leer state de React directamente:**

```typescript
// ❌ runtime error en UI thread
const [isActive] = useState(false);
const style = useAnimatedStyle(() => ({ opacity: isActive ? 1 : 0 }));

// ✅ pasar como shared value
const isActiveSV = useSharedValue(false);
useEffect(() => { isActiveSV.value = isActive; }, [isActive]);
const style = useAnimatedStyle(() => ({ opacity: isActiveSV.value ? 1 : 0 }));
```

**Regla 2 — Siempre cancelar animaciones en cleanup:**

```typescript
useEffect(() => {
  sharedValue.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  return () => cancelAnimation(sharedValue); // ← obligatorio para evitar memory leak
}, []);
```

**Regla 3 — Para la estética CRT del proyecto, usar `withTiming` lineal:**

```typescript
withTiming(1, { duration: 150, easing: Easing.linear }) // rápido y lineal = CRT feel
// Evitar withSpring — demasiado orgánico
```

### op-sqlite v15 — Reglas

**Regla 1 — Siempre usar transacciones para múltiples escrituras:**

```typescript
// ✅ CORRECTO — múltiples writes en una transacción
db.transaction(() => {
  db.executeSync('INSERT INTO items ...', []);
  db.executeSync('UPDATE saved_games ...', []);
  db.executeSync('INSERT INTO events ...', []);
});
// Si una falla, todas hacen rollback automáticamente

// ❌ INCORRECTO — tres writes separados sin transacción
db.executeSync('INSERT INTO items ...', []);
db.executeSync('UPDATE saved_games ...', []);
db.executeSync('INSERT INTO events ...', []);
// Si la segunda falla, la primera queda huérfana
```

**Regla 2 — Queries en `useEffect`, no en `useMemo`:**

op-sqlite usa JSI para acceso síncrono. Si se llama dentro de `useMemo`, se ejecuta durante el render phase y puede causar inconsistencias en el árbol de React.

```typescript
// ✅ CORRECTO
useEffect(() => {
  const result = getItemsByGame(activeGameId);
  setItems(result);
}, [activeGameId]);

// ❌ INCORRECTO
const items = useMemo(() => getItemsByGame(activeGameId), [activeGameId]);
```

### Zustand — Selectores granulares (obligatorio)

```typescript
// ❌ INCORRECTO — re-render en cualquier cambio del store
const store = useGameStore();
const { partyData, gold, cycle } = store;

// ✅ CORRECTO — solo re-render cuando cambia el campo específico
const partyData = useGameStore(s => s.activeGame?.partyData);
const gold      = useGameStore(s => s.activeGame?.gold);
const cycle     = useGameStore(s => s.activeCycle);
```

### TypeScript — Convenciones del proyecto

```typescript
// NI-03: PRNG nunca inline
// ❌
const rng = { int: (a, b) => Math.floor(Math.random() * (b - a + 1)) + a };
// ✅
import { makePRNG } from '../utils/prng';
const rng = makePRNG(`${seedHash}_my_context`);

// NI-02: Nuevos campos a CharacterSave van en gameRepository.ts primero
// NI-07: charClass en DB siempre lowercase; para i18n siempre .toUpperCase()
// NI-09: Nunca usar name como key — siempre characterId
```

---

## Checklist de seguridad antes de hacer merge

- [ ] No hay `console.log` de datos sensibles (portraits, tokens)
- [ ] No hay base64 largo en strings de log
- [ ] Toda nueva DB query usa parámetros `?` — nunca string concatenation (SQL injection)
- [ ] Todo nuevo `useEffect` tiene cleanup (animaciones, intervals, timeouts)
- [ ] Todo nuevo `setTimeout`/`setInterval` tiene referencia para clearear
- [ ] Todo nuevo servicio está en `src/services/index.ts` (barrel)
- [ ] Todo nuevo tipo público está exportado desde su archivo de servicio o `gameRepository.ts`
- [ ] Nuevas deps verificadas con New Architecture antes de instalar
