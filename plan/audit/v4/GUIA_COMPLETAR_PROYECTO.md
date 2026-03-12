# TORRE — Guía Completa de Implementación
> Auditoría v5.0 · 2026-03-12 · Fase final — integración de dudas reportadas + nuevos bugs  
> Basada en: código fuente real + plan/sprints/00_INDICE.md + auditorías v3 + sesión de QA equipo

---

## ⚡ Estado ejecutivo

| Categoría | Estado |
|-----------|--------|
| Sprints 4C–7 | ✅ Implementados |
| Pantallas críticas | ⚠️ 3 pendientes (MarketScreen, BlacksmithScreen, EventResolutionScreen) |
| FEAT-01 a FEAT-05 (v3) | 🔴 Abiertos — ver sección correspondiente |
| **FEAT-06 — Party Name en DB** | 🔴 Nuevo — ranking muestra seedHash en vez de nombre |
| **FEAT-07 — Character UUID** | 🔴 Nuevo — bug de muerte doble por nombre duplicado |
| **FEAT-08 — Rename de personaje** | 🔴 Nuevo — no existe funcionalidad de renombrar |
| **FEAT-09 — IA Parties en la app** | 🟡 Parcial — ver análisis completo abajo |
| **FEAT-10 — Event Room resolution** | 🔴 Nuevo — salas EVENT no tienen resolución real |
| Bugs UI/Gameplay (v3 + v5) | 🔴 11 bugs abiertos — ver GUIA_BUGS.md |

---

## Reglas de integridad vigentes (NI)

| Código | Regla |
|--------|-------|
| NI-01 | `MAX_LEVEL_MVP = 20`. Esencias activas desde Sprint 7. |
| NI-02 | `CharacterSave` canónico en `gameRepository.ts`. Campo nuevo → ahí primero. |
| NI-03 | `makePRNG()` **nunca** inline. Siempre `import { makePRNG } from '../utils/prng'`. |
| NI-04 | `AIProfile`: `AGGRESSIVE \| DEFENSIVE \| OPPORTUNISTIC \| EXPANSIONIST \| SURVIVALIST`. |
| NI-05 | `CYCLE_COST` en `timeService.ts` es la fuente de verdad para costos de tiempo. |
| NI-06 | `CombatResult.essenceDrops` sincronizado entre `combatEngine.ts` y `essenceService.ts`. |
| NI-07 | `charClass` en DB en lowercase. Para i18n: `t(\`party.class_${charClass.toUpperCase()}\`)`. |
| NI-08 | `room.visited = true` se persiste en `mapState` **después** del combate, nunca antes. |
| **NI-09** | `CharacterSave.characterId` es el identificador canónico. **Nunca usar `name` como key**. |
| **NI-10** | `SavedGame.partyName` es el nombre visible de la party en ranking y UI. Campo obligatorio. |

---

## Análisis de dudas del equipo

### ¿Ya se generan las IA parties en la app?

**Respuesta: Sí, parcialmente.** El sistema existe pero hay una brecha de visibilidad.

**Lo que SÍ está implementado:**
- `worldSimulator.ts` simula parties IA cada vez que el jugador realiza una acción (`simulateWorld`).
- `rivalGenerator.ts` genera nombres y perfiles para las parties rivales usando el `seedHash`.
- `rivalRepository.ts` persiste el estado de los rivales con migration 14.
- `WorldLogScreen.tsx` muestra los eventos de simulación (`lastSimEvents`).
- `GuildScreen` muestra rivales vivos con sus perfiles.

**Lo que FALTA:**
- La simulación no se activa automáticamente al abrir la app si hay ciclos transcurridos (solo se llama al ejecutar acciones).
- En `MainScreen`, al hacer "Continuar", no se simula el mundo desde el último ciclo guardado.
- Los eventos de simulación no tienen feedback visual en tiempo real (solo el `WorldLogScreen` muestra el log posterior).

**Conclusión técnica:** Las parties IA existen y actúan. El jugador las ve en el Guild y en el WorldLog. Lo que puede percibirse como "no generadas" es que no hay notificación proactiva al abrir la app de qué pasó en el mundo mientras el jugador no estaba.

**Acción recomendada:** Al hacer "Continuar" en MainScreen, si `lastActionAt` + ciclos transcurridos > 0, ejecutar `simulateWorld` con `fromCycle=lastCycle` y mostrar un resumen en `CycleTransitionScreen`.

---

## FEAT-01 🔴 — ExtractionScreen: datos mockeados

**Archivo:** `src/screens/ExtractionScreen.tsx`

La pantalla de extracción usa datos hardcodeados sin relación con el estado real del juego.

**Por qué existe este problema:**  
ExtractionScreen fue creada como placeholder visual antes de que `itemRepository` existiera. Ahora que `items` y `saved_games.gold` son reales, el mock debe eliminarse.

### Paso 1 — Identificar los mocks a eliminar

```typescript
// ExtractionScreen.tsx — ELIMINAR estas constantes
const LOOT_ITEMS = [...];       // hardcodeado
const targetGold = 120;         // hardcodeado
```

### Paso 2 — Crear función paginada en itemRepository

Razón: en late game pueden existir 200+ ítems. No cargar todo.

```typescript
// src/database/itemRepository.ts — añadir
export function getRecentItems(gameId: string, sinceCycle: number): Item[] {
  return getDB().execute(
    'SELECT * FROM items WHERE owner_game_id = ? AND obtained_cycle >= ? ORDER BY obtained_cycle DESC LIMIT 50',
    [gameId, sinceCycle]
  ).rows.map(rowToItem);
}
```

### Paso 3 — Conectar datos reales en ExtractionScreen

```typescript
// ExtractionScreen.tsx
const activeGameId = useGameStore(s => s.activeGameId);
const activeGame   = useGameStore(s => s.activeGame);
const activeCycle  = useGameStore(s => s.activeCycle);

const sessionItems = useMemo(
  () => {
    if (!activeGameId) return [];
    try { return getRecentItems(activeGameId, activeCycle - 1); }
    catch { return []; }
  },
  [activeGameId, activeCycle]
);

const realGold = activeGame?.gold ?? 0;
```

### Paso 4 — Simular ciclos del mundo en derrota

Cuando `fromDefeat: true`, el mundo debe avanzar antes de regresar.

```typescript
const [isSimulating, setIsSimulating] = useState(false);

const handleReturnToVillage = useCallback(async () => {
  if (fromDefeat) {
    setIsSimulating(true);
    try { await advanceToVillage(); } catch { /* non-critical */ }
    setIsSimulating(false);
  }
  updateProgress({ location: 'village' });
  navigation.reset({ index: 0, routes: [{ name: 'Village' }] });
}, [fromDefeat]);

// En JSX
{isSimulating && (
  <View style={StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: '#00FF41', fontFamily: 'RobotoMono-Regular', fontSize: 12 }}>
      ⟳ EL MUNDO CONTINÚA SIN TI...
    </Text>
  </View>
)}
```

**Checklist:**
- [ ] `LOOT_ITEMS` mock eliminado
- [ ] `targetGold = 120` eliminado
- [ ] Items muestran los del `itemRepository` para ese gameId y ciclo
- [ ] Contador de oro muestra `activeGame.gold`
- [ ] `fromDefeat: true` llama `advanceToVillage()` antes de navegar

---

## FEAT-02 🔴 — MarketScreen y BlacksmithScreen inexistentes

**Archivos a crear:**  
- `src/screens/MarketScreen.tsx`  
- `src/screens/BlacksmithScreen.tsx`

**Por qué no existen:**  
Documentadas en sprint 6 (doc 07) pero no se implementaron las pantallas.

### MarketScreen — Paso 1: Agregar a la navegación

```typescript
// src/navigation/types.ts — añadir
Market: undefined;
Blacksmith: undefined;

// src/navigation/AppNavigator.tsx — añadir lazy imports y Screen
const MarketScreen    = React.lazy(() => import('../screens/MarketScreen'));
const BlacksmithScreen = React.lazy(() => import('../screens/BlacksmithScreen'));
```

### MarketScreen — Paso 2: Crear la pantalla

```typescript
// src/screens/MarketScreen.tsx
// El stock se genera determinísticamente con el seed+ciclo
// Razón: garantiza que dos jugadores con mismo seed ven el mismo mercado

const marketStock = useMemo(
  () => generateMarketStock(seedHash, cycle, maxFloor),
  [seedHash, cycle, maxFloor] // solo se regenera cuando avanza el ciclo
);
```

### BlacksmithScreen — Paso 2: Crear la pantalla

```typescript
// src/screens/BlacksmithScreen.tsx
// Permite upgradeItem (mejorar stats de armas equipadas)
// y repairItem (restaurar durabilidad si se implementa)
```

### Paso 3 — Conectar desde VillageScreen

```typescript
// VillageScreen.tsx — en handleBuildingPress
if (key === 'market')     { navigation.navigate('Market');     return; }
if (key === 'blacksmith') { navigation.navigate('Blacksmith'); return; }
```

**Checklist:**
- [ ] `MarketScreen` creada con stock generado por `generateMarketStock`
- [ ] `BlacksmithScreen` creada con lista de ítems equipados del inventario
- [ ] Ambas añadidas en `AppNavigator.tsx` como lazy imports
- [ ] Ambas añadidas en `types.ts`
- [ ] `VillageScreen` navega a ellas correctamente

---

## FEAT-03 🟠 — Posada no restaura HP

**Archivo:** `src/screens/VillageScreen.tsx`

La Posada cobra 50G y avanza 1 ciclo pero no restaura HP. Bug de regresión: el código que debería hacerlo está comentado.

### Paso 1 — Identificar la lógica actual

```typescript
// VillageScreen.tsx ~línea 172 — estado actual
if (key === 'inn') {
  updateProgress({ gold: gold - REST_INN_COST });
  advanceCycle('REST_LONG').then(/* ... */);
  return;
}
```

### Paso 2 — Aplicar el fix

```typescript
if (key === 'inn') {
  if (gold < REST_INN_COST) {
    Alert.alert('Fondos insuficientes', `Necesitas ${REST_INN_COST}G para descansar`);
    return;
  }
  // Restaurar HP completo de personajes vivos + subir moral
  const restedParty = partyData.map(c => ({
    ...c,
    hp:     c.alive ? c.maxHp : c.hp,
    morale: Math.min(100, (c.morale ?? 80) + 15),
  }));
  updateProgress({
    gold:      gold - REST_INN_COST,
    partyData: restedParty,
  });
  advanceCycle('REST_LONG').then(/* feedback visual */);
  return;
}
```

**Checklist:**
- [ ] HP se restaura a `maxHp` en personajes con `alive: true`
- [ ] Moral sube +15 (cap 100)
- [ ] Se descuenta el gold correctamente
- [ ] Si no hay suficiente gold, muestra alerta

---

## FEAT-04 🟠 — Clases de personaje sin traducir (NI-07)

**Archivos:** `src/screens/ReportScreen.tsx`, `src/i18n/translations/es.ts`, `src/i18n/translations/en.ts`

### Paso 1 — Completar el diccionario en es.ts y en.ts

```typescript
// es.ts — sección party
class_BARBARIAN: 'Bárbaro',
class_BARD:      'Bardo',
class_CLERIC:    'Clérigo',
class_DRUID:     'Druida',
class_FIGHTER:   'Guerrero',
class_MONK:      'Monje',
class_PALADIN:   'Paladín',
class_RANGER:    'Explorador',
class_ROGUE:     'Pícaro',
class_SORCERER:  'Hechicero',
class_WARLOCK:   'Brujo',
class_WIZARD:    'Mago',
```

### Paso 2 — Normalizar todos los puntos de uso

```bash
# Buscar todos los puntos afectados
grep -rn "party.class_\${" src/
```

```typescript
// En TODOS los archivos encontrados — reemplazar
t(`party.class_${c.charClass}`)              // ❌ genera key en lowercase
t(`party.class_${c.charClass.toUpperCase()}`) // ✅ key correcta
```

**Checklist:**
- [ ] 12 clases DnD presentes en `es.ts` y `en.ts`
- [ ] Todos los usos usan `.toUpperCase()`
- [ ] `ReportScreen` muestra "Paladín", "Mago", etc.

---

## FEAT-05 🟠 — ReportScreen: evento mundial hardcodeado

**Archivo:** `src/screens/ReportScreen.tsx`

### Paso 1 — Conectar lastSimulationEvents

```typescript
const lastSimEvents = useGameStore(s => s.lastSimulationEvents);

const notableEvent = lastSimEvents?.find(e =>
  e.type === 'AI_ELIMINATED' || e.type === 'ALLIANCE_FORMED' || e.type === 'BOSS_KILLED'
);
```

### Paso 2 — Reemplazar texto hardcodeado

```typescript
// ELIMINAR:
<Text>PARTY "LAST_LIGHT" ELIMINATED · FLOOR 03 · CYCLE 01</Text>

// REEMPLAZAR CON:
{notableEvent ? (
  <Text>{notableEvent.type} · FLOOR {notableEvent.floor} · CYCLE {notableEvent.cycle}</Text>
) : (
  <Text style={{ color: 'rgba(255,255,255,0.3)' }}>NO WORLD EVENTS THIS CYCLE</Text>
)}
```

**Checklist:**
- [ ] Evento mundial viene de `lastSimulationEvents` del store
- [ ] Si no hay eventos, muestra texto neutro (no texto hardcodeado)

---

## FEAT-06 🔴 — Party Name: ranking muestra seedHash en lugar de nombre

**Contexto:**  
En `GuildScreen`, el ranking muestra `g.seedHash` como identificador de la party. Esto es ilegible para el jugador — no sabe en qué posición está su party.

**Root cause:**  
`SavedGame` no tiene campo `partyName`. El jugador ingresa una seed en `SeedScreen`, pero ese valor no se guarda como nombre visible. En `PartyScreen` hay un `TextInput` con `namePlaceholder` pero su valor no se persiste en la DB.

### Paso 1 — Agregar `partyName` a SavedGame y a la DB

```typescript
// gameRepository.ts — añadir campo al tipo SavedGame
export interface SavedGame {
  // ... campos existentes ...
  /** Nombre visible de la party (ingresado en PartyScreen o SeedScreen). */
  partyName: string | null;
}

// DEFAULT_SAVED_GAME
partyName: null,
```

### Paso 2 — Agregar migration 17

```typescript
// migrations.ts — CURRENT_VERSION = 17
17: [
  `ALTER TABLE saved_games ADD COLUMN party_name TEXT DEFAULT NULL`,
],
```

### Paso 3 — Actualizar rowToSavedGame y updateSavedGame

```typescript
// rowToSavedGame — añadir campo
partyName: (row.party_name as string | null) ?? null,

// updateSavedGame — añadir al Pick
| 'partyName'

// updateSavedGame — handler
if (updates.partyName !== undefined) {
  sets.push('party_name = ?');
  values.push(updates.partyName ?? null as unknown as string);
}
```

### Paso 4 — Persistir el nombre en PartyScreen

```typescript
// PartyScreen.tsx — el TextInput con namePlaceholder ya existe
// Solo necesita persistir en createNewGame o en updateProgress

// En el handler de crear la party (antes de navegar):
createNewGame({
  seed,
  seedHash,
  partyName: partyNameInput || `PARTY_${seed.slice(0, 6).toUpperCase()}`,
  partyData: finalParty,
});
```

### Paso 5 — Usar partyName en el ranking de GuildScreen

```typescript
// GuildScreen.tsx — en la sección de rankings
{rankings.map((g, i) => (
  <View key={g.id}>
    <Text>#{i + 1}</Text>
    {/* ANTES: g.seedHash — ilegible */}
    {/* AHORA: nombre visible con fallback al seedHash */}
    <Text>{g.partyName ?? g.seedHash.slice(0, 8)}</Text>
    <Text>Floor {g.floor}</Text>
  </View>
))}
```

**Checklist:**
- [ ] `SavedGame` tiene campo `partyName: string | null`
- [ ] Migration 17 aplicada
- [ ] `rowToSavedGame` mapea `party_name` → `partyName`
- [ ] `updateSavedGame` acepta `partyName`
- [ ] `PartyScreen` persiste el nombre ingresado al crear
- [ ] Ranking en `GuildScreen` muestra `partyName` (fallback a `seedHash.slice(0, 8)`)
- [ ] El jugador puede ver su posición en el ranking por nombre de party

---

## FEAT-07 🔴 — Character UUID: muerte doble por nombre duplicado

**Este es el bug más crítico del sistema de combate.**

**Contexto:**  
Cuando dos personajes de la party tienen el mismo nombre (posible porque el jugador elige el nombre manualmente), `combatEngine.ts` usa el nombre como identificador único para parsear el log de combate. Resultado: cuando uno muere, el motor interpreta que ambos mueren. Además, React lanza warnings de "duplicate key" porque algunos componentes usan `char.name` como `key`.

**Root cause técnico:**  
En `combatEngine.ts`, las funciones de análisis de eventos usan búsquedas por nombre:
```typescript
// combatEngine.ts ~línea 924 — usa nombre para identificar actor en log
const actorName = state.partyState.find(m => line.startsWith(`  ${m.name.toUpperCase()}`))?.name
// Si hay 2 personajes llamados "ARIA", `.find()` siempre retorna el primero
// → los turnos y efectos del segundo ARIA se aplican al primero

// En BattleScreen ~línea 886 — key duplicada
key={`${char.name}-${i}`}   // el `-${i}` mitiga pero no elimina el problema semántico
```

### Paso 1 — Agregar `characterId` a CharacterSave (NI-09)

```typescript
// gameRepository.ts — CharacterSave — añadir campo al inicio de CORE
export type CharacterSave = {
  // ── CORE ────────────────────────────────────────────────
  /** UUID único e inmutable del personaje. Nunca usar `name` como clave. (NI-09) */
  characterId: string;
  name:        string;
  // ... resto de campos ...
};
```

### Paso 2 — Generar UUID al crear el personaje

```typescript
// En el punto de creación de personajes (CharacterActionsPanel o donde se arma la party final)
// React Native no tiene `crypto.randomUUID` en entornos sin Hermes; usar uuid v4

// package.json ya tiene 'uuid'? Si no: yarn add uuid @types/uuid
import { v4 as uuidv4 } from 'uuid';

const newCharacter: CharacterSave = {
  characterId: uuidv4(),
  name: chosenName,
  // ... resto ...
};
```

**Nota de performance:** `uuidv4()` se llama solo en creación de personaje (1 vez por personaje). No hay impacto en renders.

### Paso 3 — Actualizar LivePartyMember en combatEngine

```typescript
// combatEngine.ts — LivePartyMember
export type LivePartyMember = {
  characterId: string; // ← NUEVO: identificador canónico
  name:        string; // se mantiene para display en logs
  // ... resto de campos ...
};

// En initCombat — mapear characterId
partyState: party.filter(c => c.alive).map(c => ({
  characterId: c.characterId, // ← mapear
  name: c.name,
  // ... resto ...
})),
```

### Paso 4 — Reemplazar búsquedas por nombre en combatEngine

```typescript
// Buscar TODOS los .find(m => ... m.name ...) en combatEngine.ts
// Reemplazar por búsquedas por characterId donde sea semánticamente correcto

// ANTES — puede fallar con nombres duplicados
const actorName = state.partyState.find(m => line.startsWith(`  ${m.name.toUpperCase()}`))?.name

// DESPUÉS — el log incluye characterId como prefijo (ver paso 5)
// O usar un Map para lookup O(1) por characterId
const memberMap = new Map(state.partyState.map(m => [m.characterId, m]));
```

### Paso 5 — Usar characterId en logs de combate (opcional pero robusto)

Si el log es solo para display humano, el nombre está bien. Pero para parseo interno:

```typescript
// En funciones que generan log lines — añadir characterId como tag oculto
logLine: `  [${member.characterId}] ${member.name.toUpperCase()} ATACA`,

// En funciones que parsean el log — usar el tag
const match = line.match(/^\s+\[([a-f0-9-]{36})\]\s+(.+)/);
if (match) {
  const [, charId, action] = match;
  const actor = memberMap.get(charId);
  // actor es único — sin ambigüedad
}
```

### Paso 6 — Actualizar keys en todos los componentes afectados

```typescript
// BattleScreen.tsx — reemplazar key basada en nombre
// ANTES
key={`${char.name}-${i}`}
// DESPUÉS
key={char.characterId}

// GuildScreen.tsx — mismo fix
key={`${char.name}-${i}`}  →  key={char.characterId}

// CampScreen.tsx — verificar y corregir
// ReportScreen.tsx — verificar y corregir
// CharacterDetailScreen.tsx — verificar y corregir
```

### Paso 7 — Migration 18: no requerida (campo vive en JSON de party_data)

`characterId` se almacena dentro del JSON de `party_data` en `saved_games`. No requiere columna nueva en SQL. Sin embargo, los juegos guardados existentes no tienen `characterId`. Agregar una función de migración en memoria:

```typescript
// gameRepository.ts — en rowToSavedGame, para compatibilidad con saves viejos
partyData: (JSON.parse(row.party_data) as CharacterSave[]).map(c => ({
  ...c,
  characterId: c.characterId ?? uuidv4(), // retrocompatibilidad: generar UUID si falta
})),
```

**Checklist:**
- [ ] `CharacterSave.characterId: string` añadido (NI-09)
- [ ] `uuidv4()` se llama en creación de personaje, nunca en renders
- [ ] `LivePartyMember.characterId` añadido en `combatEngine.ts`
- [ ] `initCombat` mapea `characterId` desde `CharacterSave`
- [ ] Log parsing usa `characterId` o `Map` por `characterId`
- [ ] Keys de React en todos los componentes usan `characterId`
- [ ] Saves viejos reciben `uuidv4()` de retrocompatibilidad en `rowToSavedGame`
- [ ] No hay más warnings de "duplicate key" en la consola
- [ ] Dos personajes con el mismo nombre pueden morir independientemente

---

## FEAT-08 🟡 — Renombrar personaje

**Contexto:**  
El jugador reporta que querría renombrar personajes. Actualmente el nombre se define en la creación y no puede cambiarse.

**Consideración de diseño importante:**  
Una vez que existe `characterId` (FEAT-07), renombrar es seguro porque el sistema usa el UUID como clave, no el nombre. Antes de FEAT-07, renombrar sería problemático. **Implementar FEAT-07 antes que FEAT-08.**

### Paso 1 — Agregar pantalla o modal de renombrado

El punto más natural es `CharacterDetailScreen.tsx` — ya muestra todos los datos del personaje.

```typescript
// CharacterDetailScreen.tsx — añadir estado de edición
const [isEditingName, setIsEditingName] = useState(false);
const [nameInput, setNameInput] = useState(char.name);

// Handler de guardado
const handleRename = useCallback(() => {
  if (!nameInput.trim() || nameInput.trim() === char.name) {
    setIsEditingName(false);
    return;
  }
  const updatedParty = partyData.map(c =>
    c.characterId === char.characterId
      ? { ...c, name: nameInput.trim().slice(0, 20) }
      : c
  );
  updateProgress({ partyData: updatedParty });
  setIsEditingName(false);
}, [nameInput, char, partyData]);
```

### Paso 2 — UI de edición inline

```typescript
// En el header de CharacterDetailScreen
{isEditingName ? (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <TextInput
      value={nameInput}
      onChangeText={setNameInput}
      maxLength={20}
      autoFocus
      style={S.nameInput}
    />
    <TouchableOpacity onPress={handleRename}><Text>✓</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => setIsEditingName(false)}><Text>✗</Text></TouchableOpacity>
  </View>
) : (
  <TouchableOpacity onLongPress={() => setIsEditingName(true)}>
    <Text style={S.charName}>{char.name.toUpperCase()}</Text>
    <Text style={S.editHint}>mantener presionado para editar</Text>
  </TouchableOpacity>
)}
```

**Checklist:**
- [ ] FEAT-07 implementado primero (characterId en su lugar)
- [ ] `CharacterDetailScreen` permite edición de nombre con long press
- [ ] Nombre se persiste vía `updateProgress({ partyData: updatedParty })`
- [ ] Nombre tiene límite de 20 caracteres
- [ ] Todos los logs y displays usan el nuevo nombre automáticamente
- [ ] El `characterId` NO cambia al renombrar

---

## FEAT-09 🔴 — Event Room: salas de evento sin resolución

**Contexto:**  
Las salas de tipo `EVENT` en el mapa existen como nodos, el jugador puede entrar en ellas (`handleEnterRoom` las procesa), pero cuando entra solo se marcan como `visited: true`. No hay ninguna pantalla, modal ni lógica que resuelva el evento. El jugador entra y sale sin consecuencias.

**Root cause:**  
En `handleEnterRoom`, la rama non-combat incluye EVENT, TREASURE, SECRET. Ninguna tiene navegación específica — todas simplemente actualizan `mapState` y revelan salas adyacentes. No existe un `EventScreen` ni un sistema de resolución inline.

### Paso 1 — Diseñar el sistema de eventos

Los eventos son encuentros narrativos con consecuencias mecánicas. Tipos sugeridos (basados en doc 10):

| Tipo | Descripción | Resultado mecánico |
|------|-------------|-------------------|
| AMBUSH | Emboscada — ataque por sorpresa | Reduce HP de 1 personaje aleatorio en 30% |
| MERCHANT | Mercader errante | Compra/venta con descuento 20% |
| SHRINE | Altar antiguo | Restaura HP completo a 1 personaje |
| TRAP | Trampa oculta | Reduce HP o pierde gold |
| LORE | Inscripción antigua | Revela sala secreta en el mapa |
| ALLY | Aventurero herido | Opcional: unirse a la party |

### Paso 2 — Crear EventResolutionScreen

```typescript
// src/screens/EventResolutionScreen.tsx (nueva pantalla)
// Recibe: roomId, eventType, eventData (generado con PRNG)

// En navigation/types.ts — añadir
EventResolution: {
  roomId: string;
  eventType: EventType;
  eventSeed: string;
};

// En AppNavigator.tsx — añadir lazy import
const EventResolutionScreen = React.lazy(() => import('../screens/EventResolutionScreen'));
```

### Paso 3 — Generar el evento con PRNG (determinístico)

```typescript
// src/services/encounterService.ts — añadir función
export function generateRoomEvent(
  seedHash: string,
  roomId: number,
  floorIndex: number,
): { type: EventType; data: EventData } {
  // PRNG garantiza que el mismo room en el mismo floor siempre da el mismo evento
  // Importante para reproducibilidad de bugs y fair play (NI-03)
  const rng = makePRNG(`${seedHash}_event_${floorIndex}_${roomId}`);
  const types: EventType[] = ['AMBUSH', 'MERCHANT', 'SHRINE', 'TRAP', 'LORE', 'ALLY'];
  const eventType = types[rng.int(0, types.length - 1)];
  return { type: eventType, data: generateEventData(rng, eventType) };
}
```

### Paso 4 — Navegar al resolver un EVENT room

```typescript
// MapScreen.tsx — en handleEnterRoom, rama non-combat
if (room.type === 'EVENT') {
  const event = generateRoomEvent(activeGame?.seedHash ?? '0', room.id, floorIndex);
  setFloor(afterVisit);
  setCurrentRoomId(room.id);
  setSelectedRoom(null);
  const savedState = serializeExplorationState(afterVisit, room.id);
  updateProgress({ location: 'map', mapState: JSON.stringify(savedState) });
  navigation.navigate('EventResolution', {
    roomId:    String(room.id),
    eventType: event.type,
    eventSeed: `${activeGame?.seedHash}_event_${floorIndex}_${room.id}`,
  });
  return;
}
```

### Paso 5 — Resolver el evento y regresar al mapa

```typescript
// EventResolutionScreen.tsx — al confirmar elección
const handleResolve = useCallback((choice: EventChoice) => {
  applyEventOutcome(choice, partyData, gold, updateProgress);
  navigation.goBack(); // regresa al mapa
}, [choice, partyData, gold]);
```

**Checklist:**
- [ ] `EventResolutionScreen` creada con al menos 6 tipos de evento
- [ ] Navegación desde `MapScreen` para salas `EVENT`
- [ ] Evento generado con PRNG determinístico (mismo seed+floor+roomId = mismo evento)
- [ ] Resolución aplica consecuencias mecánicas reales (HP, gold, moral)
- [ ] Panel de sala EVENT en MapScreen muestra descripción del evento (si ya fue visitado)
- [ ] Al regresar al mapa después del evento, la sala queda marcada como visitada

---

## Orden de implementación recomendado

```
SEMANA 1 — Bugs críticos de integridad
  └─ FEAT-07 (UUID personajes)    — 4h — sin esto BattleScreen es inestable
  └─ FEAT-03 (Posada HP)          — 1h — regresión simple
  └─ FEAT-04 (i18n clases)        — 1h — buscar y reemplazar
  └─ FEAT-06 (Party Name)         — 3h — migration + persistencia

SEMANA 2 — Features de UI faltante
  └─ FEAT-08 (Rename)             — 2h — depende de FEAT-07
  └─ FEAT-05 (evento mundial)     — 2h — conectar store
  └─ FEAT-09 (Event rooms)        — 1 día — nueva pantalla

SEMANA 3 — Pantallas faltantes
  └─ FEAT-02 (MarketScreen)       — 2 días — pantalla nueva completa
  └─ FEAT-01 (ExtractionScreen)   — 1 día — conectar itemRepository
```
