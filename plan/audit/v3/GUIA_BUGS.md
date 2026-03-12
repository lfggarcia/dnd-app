# TORRE — Bugs Identificados y Correcciones
> Auditoría v4.0 · 2026-03-12 · Basado en screenshots del release actual + revisión de código
> **Estos bugs deben resolverse después de las features pendientes (FEAT-01 a FEAT-05)**

---

## Índice de bugs

| ID | Severidad | Pantalla | Descripción corta |
|----|-----------|----------|-------------------|
| BUG-01 | 🔴 Alta | BattleScreen | Solo 2 acciones en la barra (ATACAR + 1 habilidad) aunque en party creation había más |
| BUG-02 | 🔴 Alta | MapScreen | "Volver a la villa" aparece en salas que no deberían tenerlo (RELIC, TREASURE visitadas) |
| BUG-03 | 🟠 Media | ReportScreen | Clase de personaje muestra key i18n cruda ("party.class_paladin") en vez de traducción |
| BUG-04 | 🔴 Alta | BattleScreen / App | Cerrar la app durante un combate hace que al volver se marque el combate como ganado |
| BUG-05 | 🔴 Alta | MapScreen / Boss | Igual que BUG-04 pero con jefe: cerrar app durante pelea con boss = jefe muerto al volver |
| BUG-06 | 🟠 Media | BattleScreen | Animación de derrota: card no centrada en pantalla; en derrota total no simula ciclos |
| BUG-07 | 🔴 Alta | ExtractionScreen | Datos completamente mockeados (oro hardcodeado 120G, loot hardcodeado) |
| BUG-08 | 🔴 Alta | VillageScreen | Armería sin funcionalidad; Mercado/Herrería sin acción; Posada no restaura HP |

---

## BUG-01 🔴 — BattleScreen: solo 2 acciones en la barra de 4 slots

### Descripción
En la imagen 1, la barra de acciones muestra solo ATACAR y MISIL_MAGI... (la habilidad de clase del wizard). Los otros 2 slots están vacíos (`<View style={S.slotEmpty} />`). El jugador creó la party eligiendo habilidades en `CharacterActionsPanel`, pero esas elecciones no se traducen a acciones adicionales en combate.

### Root cause
`BattleScreen.tsx` tiene los 4 slots hardcodeados: 1 para ataque básico, 1 para la habilidad de clase de `CLASS_ABILITIES`, y 2 views vacías. Las elecciones de `featureChoices` (backgrounds, rasgos de raza) en `CharacterSave` no se mapean a acciones de combate.

### Archivos involucrados
- `src/screens/BattleScreen.tsx` — líneas 891–908 (action bar)
- `src/services/combatEngine.ts` — `CLASS_ABILITIES` y `LiveCombatState`

### Step-by-step

**Paso 1 — Entender el diseño correcto**

Los 4 slots representan las 4 categorías de acción en combate DnD 5e:
1. **Ataque básico** — ya existe
2. **Habilidad de clase** — ya existe (CLASS_ABILITIES)
3. **Acción estándar táctica** — DODGE / DASH / HELP (nuevo)
4. **Ítem consumible** — usar poción / scroll (nuevo, requiere FEAT-01 primero)

Por ahora, implementar el slot 3 (acciones tácticas) que no requiere datos externos.

**Paso 2 — Agregar tipos a `combatEngine.ts`**

```typescript
// Dentro de LivePartyMember — añadir campos
export type LivePartyMember = {
  // ... campos existentes ...
  standardActionUsed: boolean;     // NUEVO: acción táctica usada este turno
  dodging: boolean;                // NUEVO: posición defensiva activa
  dashing: boolean;                // NUEVO: maniobra táctica activa
};

// En initCombat — inicializar nuevos campos
partyState: party.filter(c => c.alive).map(c => ({
  name: c.name,
  charClass: c.charClass,
  baseStats: c.baseStats,
  maxHp: c.hp,
  hpBefore: c.hp,
  currentHp: c.hp,
  abilityUsed: false,
  standardActionUsed: false,  // NUEVO
  dodging: false,             // NUEVO
  dashing: false,             // NUEVO
  rageActive: false,
  inspiredBonus: 0,
  justRevived: false,
}))

// En el inicio de cada turno de party member — resetear acciones
// Buscar la función que resetea abilityUsed al inicio del turno y añadir:
standardActionUsed: false,
dodging: false,
dashing: false,
```

**Paso 3 — Implementar `applyStandardAction` en `combatEngine.ts`**

```typescript
export type TacticalAction = 'DODGE' | 'DASH' | 'HELP';

export function applyStandardAction(
  state: LiveCombatState,
  actorIdx: number,
  action: TacticalAction,
  targetIdx: number | undefined,
): { newState: LiveCombatState; logLine: string } {
  const member = state.partyState[actorIdx];
  const newParty = [...state.partyState];

  switch (action) {
    case 'DODGE': {
      // Próximo ataque enemigo contra este personaje tiene desventaja
      newParty[actorIdx] = { ...member, dodging: true, standardActionUsed: true };
      return {
        newState: { ...state, partyState: newParty },
        logLine: `  ${member.name.toUpperCase()} TOMA POSICIÓN DEFENSIVA`,
      };
    }
    case 'DASH': {
      // Maniobra táctica: +2 AC efectiva este turno (representación abstracta)
      newParty[actorIdx] = { ...member, dashing: true, standardActionUsed: true };
      return {
        newState: { ...state, partyState: newParty },
        logLine: `  ${member.name.toUpperCase()} MANIOBRA (+2 AC efectiva)`,
      };
    }
    case 'HELP': {
      // El aliado targetIdx tiene ventaja en su próximo ataque
      if (targetIdx !== undefined && state.partyState[targetIdx]) {
        const target = state.partyState[targetIdx];
        newParty[actorIdx] = { ...member, standardActionUsed: true };
        newParty[targetIdx] = { ...target, inspiredBonus: Math.max(target.inspiredBonus, 4) }; // reutilizar inspiredBonus como flag de ventaja
        return {
          newState: { ...state, partyState: newParty },
          logLine: `  ${member.name.toUpperCase()} ASISTE A ${target.name.toUpperCase()} (+ventaja)`,
        };
      }
      return { newState: state, logLine: '' };
    }
  }
}
```

**Paso 4 — Conectar `dodging` en `resolveEnemyAttack`**

En la función que resuelve ataques enemigos, verificar si el objetivo está esquivando:

```typescript
// Dentro de resolveEnemyAttack — buscar donde se calcula el attackRoll
const targetMember = state.partyState[targetIdx];

// Si el objetivo está esquivando, el enemigo tiene desventaja (tira 2d20 y toma el menor)
let attackRoll: number;
if (targetMember.dodging) {
  const roll1 = rng.int(1, 20);
  const roll2 = rng.int(1, 20);
  attackRoll = Math.min(roll1, roll2); // desventaja = menor
} else {
  attackRoll = rng.int(1, 20);
}
```

**Paso 5 — Actualizar la action bar en BattleScreen**

```typescript
// BattleScreen.tsx — estado para acción táctica
const [showTacticalPicker, setShowTacticalPicker] = useState(false);

// Reemplazar los 2 empty slots
const TACTICAL_OPTIONS: { id: TacticalAction; label: string; icon: string; desc: string }[] = [
  { id: 'DODGE',  label: lang === 'es' ? 'ESQUIVAR'  : 'DODGE',  icon: '⊕', desc: lang === 'es' ? 'Desventaja al enemigo' : 'Enemy disadvantage' },
  { id: 'DASH',   label: lang === 'es' ? 'AVANZAR'   : 'DASH',   icon: '→', desc: lang === 'es' ? '+2 AC este turno'     : '+2 AC this turn' },
  { id: 'HELP',   label: lang === 'es' ? 'AYUDAR'    : 'HELP',   icon: '↑', desc: lang === 'es' ? 'Ventaja al aliado'    : 'Ally advantage' },
];

// En el JSX — reemplazar los 2 slotEmpty
{/* Slot 3 — Acción táctica */}
<TouchableOpacity
  onPress={() => setShowTacticalPicker(true)}
  disabled={!!currentPartyMember?.standardActionUsed}
  style={[
    S.actionSlot,
    { borderColor: 'rgba(0,229,255,0.4)', backgroundColor: 'rgba(0,229,255,0.06)' },
    currentPartyMember?.standardActionUsed && S.slotDisabled,
  ]}
>
  <Text style={[S.slotIcon, { color: 'rgba(0,229,255,0.7)' }]}>⊕</Text>
  <Text style={[S.slotLabel, { color: 'rgba(0,229,255,0.7)' }]} numberOfLines={1}>
    {currentPartyMember?.standardActionUsed
      ? (lang === 'es' ? 'USADA' : 'USED')
      : (lang === 'es' ? 'TÁCTICA' : 'TACTIC')}
  </Text>
</TouchableOpacity>

{/* Slot 4 — Ítem (placeholder hasta FEAT-01) */}
<View style={[S.actionSlot, S.slotDisabled, { borderColor: 'rgba(0,255,65,0.1)' }]}>
  <Text style={[S.slotIcon, { color: 'rgba(0,255,65,0.2)' }]}>⚗</Text>
  <Text style={[S.slotLabel, { color: 'rgba(0,255,65,0.2)' }]}>ÍTEM</Text>
</View>

{/* Modal picker de acciones tácticas */}
<Modal visible={showTacticalPicker} transparent animationType="fade">
  <TouchableOpacity
    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', padding: 12 }}
    onPress={() => setShowTacticalPicker(false)}
    activeOpacity={1}
  >
    <View style={{ borderWidth: 1, borderColor: 'rgba(0,229,255,0.3)', backgroundColor: '#0A0E0A' }}>
      {TACTICAL_OPTIONS.map(opt => (
        <TouchableOpacity
          key={opt.id}
          style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,229,255,0.1)' }}
          onPress={() => {
            setShowTacticalPicker(false);
            // Si HELP necesita target, pedir selección de aliado
            if (opt.id === 'HELP') { setTacticalPendingHelp(true); return; }
            dispatch({ type: 'STANDARD_ACTION', action: opt.id });
          }}
        >
          <Text style={{ fontFamily: 'RobotoMono-Bold', fontSize: 11, color: 'rgba(0,229,255,0.9)' }}>
            {opt.icon}  {opt.label}
          </Text>
          <Text style={{ fontFamily: 'RobotoMono-Regular', fontSize: 9, color: 'rgba(0,229,255,0.4)', marginTop: 2 }}>
            {opt.desc}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  </TouchableOpacity>
</Modal>
```

**Checklist:**
- [ ] Slot 3 muestra TÁCTICA y abre modal con 3 opciones
- [ ] ESQUIVAR aplica desventaja al siguiente ataque enemigo en este turno
- [ ] AVANZAR otorga +2 AC efectiva este turno
- [ ] AYUDAR selecciona un aliado y le otorga ventaja en su próximo ataque
- [ ] Después de usar la acción táctica, el slot muestra "USADA" y está deshabilitado
- [ ] Los flags `dodging`, `dashing` se resetean al inicio del siguiente turno
- [ ] Slot 4 muestra ÍTEM deshabilitado (placeholder hasta FEAT-01)
- [ ] El log de combate refleja la acción con el formato existente

---

## BUG-02 🔴 — MapScreen: "Volver a la villa" en salas incorrectas

### Descripción
En la imagen 2, una sala RELIC (tipo TREASURE) visitada muestra el botón "Volver a la villa". Esto rompe la mecánica de exploración: el jugador puede extraerse desde cualquier sala visitada, saltándose la penalización de tiempo de `RETURN_VILLAGE`.

### Root cause
`MapScreen.tsx` línea ~637:
```typescript
// ESTADO ACTUAL — condición demasiado amplia
{selectedRoom.visited && (
  selectedRoom.type === 'START' || selectedRoom.type === 'TREASURE' || selectedRoom.type === 'SECRET'
) && (
  <TouchableOpacity onPress={handleReturnToVillage} style={styles.returnBtn}>
    <Text>{t('extraction.returnVillage')}</Text>
  </TouchableOpacity>
)}
```

El botón debería aparecer **solo en START** (la sala de entrada al piso). El jugador siempre puede regresar desde la sala inicial, pero no desde cualquier sala visitada.

### Archivos involucrados
- `src/screens/MapScreen.tsx` — ~línea 637

### Step-by-step

**Paso 1 — Entender la intención de diseño**

Según el spec de doc 12 (Seed y Parties) y el flujo de extracción:
- El jugador puede retirarse voluntariamente **solo desde la sala START del piso actual**
- Desde cualquier otra sala: debe volver al START primero (moviéndose por el mapa, gastando ciclos)
- El botón "Volver a la villa" desde una TREASURE o SECRET es un exploit que evita el costo de tiempo

**Paso 2 — Corregir la condición**

```typescript
// MapScreen.tsx — reemplazar la condición del botón de retorno
// ANTES:
{selectedRoom.visited && (
  selectedRoom.type === 'START' || selectedRoom.type === 'TREASURE' || selectedRoom.type === 'SECRET'
) && (
  <TouchableOpacity onPress={handleReturnToVillage}>...</TouchableOpacity>
)}

// DESPUÉS:
{selectedRoom.visited && selectedRoom.type === 'START' && (
  <TouchableOpacity onPress={handleReturnToVillage} style={styles.returnBtn}>
    <Text style={styles.returnBtnText}>{t('extraction.returnVillage')}</Text>
  </TouchableOpacity>
)}
```

**Paso 3 — Agregar indicador visual en salas no-START**

Para que el jugador sepa que debe volver al inicio, agregar un hint en el panel de sala:

```typescript
// En el panel de sala visitada (tipo !== START)
{selectedRoom.visited && selectedRoom.type !== 'START' && (
  <Text style={styles.roomPanelDesc}>
    {lang === 'es'
      ? 'Sala explorada. Regresa al INICIO para extraerte.'
      : 'Room cleared. Return to START to extract.'}
  </Text>
)}
```

**Paso 4 — Verificar que el START siempre es accesible**

Confirmar que el jugador puede navegar de vuelta al START. `handleRoomPress` solo permite seleccionar salas accesibles. Verificar que las conexiones del grafo siempre permiten el retorno.

```typescript
// En dungeonGraphService — verificar que el grafo es bidireccional para retorno
// O que existe siempre una ruta de vuelta al START desde cualquier nodo visitado
// Esto es una verificación de diseño, no requiere cambio de código si el grafo ya lo garantiza
```

**Checklist:**
- [ ] Botón "Volver a la villa" solo aparece en salas de tipo `START`
- [ ] Salas TREASURE, SECRET, EVENT visitadas NO muestran el botón
- [ ] El panel de sala visitada no-START muestra el hint de "regresa al INICIO"
- [ ] Navegar de vuelta al START y pulsar "Volver a la villa" funciona correctamente
- [ ] El grafo de dungeon permite siempre llegar de vuelta al START desde nodos visitados

---

## BUG-03 🟠 — ReportScreen: clase de personaje sin traducir

### Descripción
En la imagen 3, bajo el nombre de los personajes aparece "party.class_paladin", "party.class_rogue", etc. en texto crudo. La clave de traducción no se resuelve.

### Root cause
`ReportScreen.tsx`:
```typescript
// clave generada: t('party.class_paladin') — en lowercase
t(`party.class_${c.charClass}`)
```

Las translation keys en `es.ts` usan uppercase:
```typescript
// es.ts
class_FIGHTER: 'Guerrero',
class_ROGUE: 'Pícaro',
// etc — pero NO hay class_PALADIN, class_CLERIC, class_BARD, etc.
```

Hay dos problemas: (1) se genera la key en lowercase pero las keys son uppercase, y (2) faltan varias clases en el diccionario.

### Archivos involucrados
- `src/screens/ReportScreen.tsx`
- `src/i18n/translations/es.ts`
- `src/i18n/translations/en.ts`
- Buscar en otros screens: `BattleScreen`, `CharacterDetailScreen`, `CampScreen`

### Step-by-step

**Paso 1 — Completar el diccionario de clases en `es.ts` y `en.ts`**

```typescript
// es.ts — section 'party' — asegurarse que están TODOS los classes del API 5e
party: {
  // ... claves existentes ...
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
}

// en.ts — mismas keys, valores en inglés
party: {
  class_BARBARIAN: 'Barbarian',
  class_BARD:      'Bard',
  class_CLERIC:    'Cleric',
  class_DRUID:     'Druid',
  class_FIGHTER:   'Fighter',
  class_MONK:      'Monk',
  class_PALADIN:   'Paladin',
  class_RANGER:    'Ranger',
  class_ROGUE:     'Rogue',
  class_SORCERER:  'Sorcerer',
  class_WARLOCK:   'Warlock',
  class_WIZARD:    'Wizard',
}
```

**Paso 2 — Normalizar el uso en todos los archivos afectados**

```bash
# Buscar todos los puntos con el bug
grep -rn "party.class_\${c.charClass}" src/
grep -rn "party.class_\${char.charClass}" src/
grep -rn "t(\`party.class_" src/
```

**Paso 3 — Corregir cada punto de uso**

```typescript
// Patrón de corrección en TODOS los archivos donde aparezca:
// ANTES:
t(`party.class_${c.charClass}`)

// DESPUÉS:
t(`party.class_${c.charClass.toUpperCase()}`) ?? c.charClass
// El ?? c.charClass es fallback si la key no existe aún
```

**Paso 4 — Documentar NI-07 en el código**

```typescript
// Añadir un comentario en gameRepository.ts cerca de la definición de charClass:
/** charClass: index del API 5e en lowercase (ej: 'paladin', 'wizard').
 *  Para i18n: usar `t(`party.class_${charClass.toUpperCase()}`)`.
 *  NI-07: Nunca cambiar a uppercase en DB — el API 5e usa lowercase. */
charClass: string;
```

**Checklist:**
- [ ] `es.ts` y `en.ts` tienen las 12 clases DnD del proyecto
- [ ] Todos los usos de `t(\`party.class_${charClass}\`)` usan `.toUpperCase()`
- [ ] En el ReportScreen, los personajes muestran "Paladín", "Pícaro", etc.
- [ ] En el BattleScreen (turno indicator), también muestra correctamente
- [ ] NI-07 documentado en gameRepository.ts

---

## BUG-04 & BUG-05 🔴 — App cerrada durante combate = combate auto-ganado

### Descripción
Imágenes 4 y 5: se inició un combate (sala NORMAL y sala BOSS), se cerró la app, y al reabrir:
- La sala aparece como visitada y el combate como ganado
- El mapa muestra al boss como derrotado ("PISO 1 CONQUISTADO") sin haberlo peleado

### Root cause
En `handleEnterRoom` (MapScreen):

```typescript
// MapScreen.tsx ~línea 325 — EL PROBLEMA
const afterVisit: DungeonFloor = {
  rooms: floor.rooms.map(r => r.id === room.id ? { ...r, visited: true } : r),
};
// ⬆ La sala se marca visited: true ANTES de navegar a Battle
// Si la app se cierra durante el combate, mapState tiene visited:true
// Al reabrir: MainScreen → Map → sala visitada = combate completado
updateProgress({ location: 'map', mapState: JSON.stringify(savedState) }); // persiste visited:true
navigation.navigate('Battle', { roomId: String(room.id), roomType: room.type });
```

### Archivos involucrados
- `src/screens/MapScreen.tsx` — `handleEnterRoom`
- `src/database/gameRepository.ts` — `SavedGame` type
- `src/screens/MainScreen.tsx` — routing al reanudar
- `src/stores/gameStore.ts`

### Step-by-step

**Paso 1 — Agregar campo `combatRoomId` a `SavedGame`**

```typescript
// gameRepository.ts — añadir campo al tipo
export interface SavedGame {
  // ... campos existentes ...
  /** ID de la sala donde hay un combate activo.
   *  null = no hay combate pendiente.
   *  Si la app se cierra con este valor != null, al reabrir se retoma el combate. */
  combatRoomId: string | null;
  combatRoomType: string | null;
}

// DEFAULT_SAVED_GAME — inicializar
combatRoomId: null,
combatRoomType: null,
```

**Paso 2 — Agregar migration 16**

```typescript
// migrations.ts
const CURRENT_VERSION = 16;

16: [
  `ALTER TABLE saved_games ADD COLUMN combat_room_id TEXT DEFAULT NULL`,
  `ALTER TABLE saved_games ADD COLUMN combat_room_type TEXT DEFAULT NULL`,
],
```

**Paso 3 — Agregar a `rowToSavedGame` y `updateSavedGame`**

```typescript
// rowToSavedGame
combatRoomId:   (row.combat_room_id as string | null) ?? null,
combatRoomType: (row.combat_room_type as string | null) ?? null,

// updateSavedGame — Pick
| 'combatRoomId' | 'combatRoomType'

// updateSavedGame — handler
if (updates.combatRoomId !== undefined) {
  sets.push('combat_room_id = ?');
  values.push(updates.combatRoomId ?? null as unknown as string);
}
if (updates.combatRoomType !== undefined) {
  sets.push('combat_room_type = ?');
  values.push(updates.combatRoomType ?? null as unknown as string);
}
```

**Paso 4 — Modificar `handleEnterRoom` en MapScreen**

```typescript
// MapScreen.tsx — handleEnterRoom — para salas de combate
if (isCombat) {
  // ✅ NUEVO ORDEN:
  // 1. Marcar que hay un combate activo en esta sala
  // 2. NO marcar la sala como visited todavía
  // 3. Navegar a Battle
  
  setFloor(floor); // NO afterVisit — sin visited:true aún
  setCurrentRoomId(room.id);
  setSelectedRoom(null);
  
  const savedState = serializeExplorationState(floor, room.id); // sin visited
  updateProgress({
    location: 'map',
    mapState: JSON.stringify(savedState),
    combatRoomId: String(room.id),       // ← NUEVO: marcar combate activo
    combatRoomType: room.type,           // ← NUEVO
  });
  
  navigation.navigate('Battle', { roomId: String(room.id), roomType: room.type });
  return;
}
```

**Paso 5 — Limpiar `combatRoomId` al terminar el combate**

En BattleScreen, cuando el combate termina (victoria O derrota), limpiar el campo:

```typescript
// BattleScreen.tsx — en el useEffect que detecta cs.outcome
useEffect(() => {
  if (!cs.outcome) return;
  
  // Marcar la sala como visitada AHORA que el combate terminó
  if (cs.outcome === 'VICTORY') {
    // Actualizar mapState con la sala marcada como visited
    const updatedMapState = /* deserializar el mapState actual y marcar la sala */;
    updateProgress({
      combatRoomId: null,    // ← limpiar combate activo
      combatRoomType: null,
      mapState: updatedMapState,
    });
  } else {
    // En derrota, también limpiar (la sala queda sin visited para poder reintentarla)
    updateProgress({
      combatRoomId: null,
      combatRoomType: null,
    });
  }
  
  setUiPhase('ENDED');
}, [cs.outcome]);
```

**Paso 6 — Routing de recuperación en MainScreen**

```typescript
// MainScreen.tsx — handleMenuPress 'continue'
if (key === 'continue' && hasActive) {
  if (activeGame?.combatRoomId !== null && activeGame?.combatRoomId !== undefined) {
    // Hay un combate pendiente — retomar
    navigation.reset({
      index: 0,
      routes: [{
        name: 'Battle',
        params: {
          roomId: activeGame.combatRoomId,
          roomType: activeGame.combatRoomType ?? 'NORMAL',
        }
      }]
    });
  } else if (activeGame?.location === 'map') {
    navigation.reset({ index: 0, routes: [{ name: 'Map' }] });
  } else {
    navigation.reset({ index: 0, routes: [{ name: 'Village' }] });
  }
}
```

**Nota importante sobre BUG-05 (boss):** El mismo fix resuelve el caso del boss. Al reanudar el combate contra el boss, `BossRoomEntryUI` no se mostrará (navegación directa a Battle), pero el boss sí tendrá su HP completo porque el combate se reinicializa con `initCombat`.

**Checklist:**
- [ ] `SavedGame` tiene campos `combatRoomId` y `combatRoomType`
- [ ] Migration 16 aplicada correctamente
- [ ] `handleEnterRoom` escribe `combatRoomId` ANTES de navegar a Battle
- [ ] `handleEnterRoom` NO marca `visited: true` antes del combate
- [ ] Al terminar el combate (victoria), la sala se marca `visited: true`
- [ ] Al terminar (derrota), la sala queda sin visited (se puede reintentar)
- [ ] Al terminar, `combatRoomId` se limpia en DB
- [ ] `MainScreen` detecta `combatRoomId !== null` y navega directo a Battle
- [ ] Reanudar la app durante un combate normal: battle se reinicia con el enemigo correcto
- [ ] Reanudar la app durante combate con boss: battle se reinicia con el boss correcto
- [ ] El boss NO aparece como derrotado al reanudar

---

## BUG-06 🟠 — BattleScreen: animación de derrota descentrada + sin simulación de ciclos en wipe total

### Parte A — Animación descentrada

**Root cause:**

```typescript
// ~línea 1359
defeatOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(0,0,0,0.72)',
  zIndex: 10,
  // ❌ falta alignItems y justifyContent
},
```

La card empieza escalada a 0.4 desde la esquina superior izquierda y crece hacia abajo-derecha. El `scale` toma su origen en el punto de origen del View, que sin centering es la esquina superior izquierda.

**Fix:**

```typescript
// DESPUÉS
defeatOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(0,0,0,0.72)',
  zIndex: 10,
  alignItems: 'center',       // ← añadir
  justifyContent: 'center',   // ← añadir
},
```

Además, ajustar la animación de escala:

```typescript
// DefeatAnimation component — cambiar valores
const scale  = useRef(new Animated.Value(0.6)).current;  // era 0.4
const rotDeg = useRef(new Animated.Value(-5)).current;   // era -8

Animated.parallel([
  Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
  Animated.spring(scale, {
    toValue: 1.0,        // era 2.0 — centrada a tamaño natural, no overscaled
    damping: 18,         // era 10
    stiffness: 70,       // era 55
    useNativeDriver: true
  }),
  Animated.timing(rotDeg, { toValue: 4, duration: 800, useNativeDriver: true }),
]).start();
```

### Parte B — Sin simulación de ciclos en wipe total

**Descripción:** Cuando toda la party muere en combate, el flujo es:
`BattleScreen → ReportScreen → ExtractionScreen(fromDefeat:true) → VillageScreen`

`ExtractionScreen` con `fromDefeat:true` hace:
```typescript
// ACTUAL — sin simulación
const handleReturnToVillage = useCallback(() => {
  updateProgress({ cycle: cycle + 1, location: 'village' }); // solo +1 ciclo
  navigation.reset({ index: 0, routes: [{ name: 'Village' }] });
}, []);
```

El mundo IA no sabe que el jugador fue eliminado. No simula los ciclos que pasaron mientras el jugador yacía muerto. La Villa se ve igual que antes del combate.

**Fix — en ExtractionScreen (depende parcialmente de FEAT-01):**

```typescript
// ExtractionScreen.tsx — handleReturnToVillage con fromDefeat:true
const advanceToVillage = useGameStore(s => s.advanceToVillage);
const [isSimulating, setIsSimulating] = useState(false);

const handleReturnToVillage = useCallback(async () => {
  if (fromDefeat) {
    // Mostrar pantalla de espera mientras se simula
    setIsSimulating(true);
    try {
      // advanceToVillage simula todos los ciclos hasta el fin de temporada
      // y persiste los rivales actualizados
      await advanceToVillage();
    } catch { /* non-critical */ }
  }
  updateProgress({ location: 'village' });
  navigation.reset({ index: 0, routes: [{ name: 'Village' }] });
}, [fromDefeat, advanceToVillage, updateProgress, navigation]);

// En el JSX — mostrar indicador de simulación
{isSimulating && (
  <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: '#00FF41', fontFamily: 'RobotoMono-Regular', fontSize: 12 }}>
      ⟳ EL MUNDO CONTINÚA SIN TI...
    </Text>
  </View>
)}
```

**Checklist:**
- [ ] Parte A: card de derrota centrada en la pantalla
- [ ] Parte A: escala de 0.6 a 1.0 (no 0.4 a 2.0)
- [ ] Parte A: rotación suavizada (-5 a 4 grados)
- [ ] Parte B: `fromDefeat:true` llama `advanceToVillage()` antes de ir a la villa
- [ ] Parte B: indicador visual "EL MUNDO CONTINÚA SIN TI..." durante la simulación
- [ ] Parte B: WorldLog en la villa tras una muerte total muestra eventos de otras parties

---

## BUG-07 🔴 — ExtractionScreen: datos mockeados

*Ver `FEAT-01` en `GUIA_COMPLETAR_PROYECTO.md` — este bug es idéntico a esa feature. La solución completa está documentada ahí.*

**Puntos de mock a eliminar:**

```typescript
// ELIMINAR estas constantes del módulo:
const LOOT_ITEMS = [...]; // hardcodeado
const LOOT_TOTAL_QTY = ...; // derivado de mock
const LOOT_MATERIAL_QTY = ...; // derivado de mock
const targetGold = 120; // hardcodeado

// REEMPLAZAR por:
// - getRecentItems(activeGameId, activeCycle - 1) para el loot
// - activeGame.gold para el oro (ya está actualizado tras los combates)
```

**Checklist:**
- [ ] `LOOT_ITEMS` array hardcodeado eliminado
- [ ] `targetGold = 120` eliminado
- [ ] Items mostrados coinciden con `itemRepository` para ese gameId y ciclo
- [ ] Contador de oro muestra el gold real de `activeGame`
- [ ] En derrota, `advanceToVillage()` se llama (ver BUG-06 parte B)

---

## BUG-08 🔴 — VillageScreen: Armería, Mercado, Herrería no funcionales; Posada no restaura HP

*Los subbugs de Mercado y Herrería son features nuevas (MarketScreen, BlacksmithScreen). La Armería y la Posada son fixes en VillageScreen existente.*

### Parte A — Armería: callbacks vacíos

```typescript
// ACTUAL — no-ops
<InventoryGrid
  items={inventoryItems}
  onItemPress={() => {}}   // ← no hace nada
  onItemEquip={() => {}}   // ← no hace nada
/>

// CORRECTO
const [selectedItem, setSelectedItem] = useState<Item | null>(null);

const handleItemEquip = useCallback((item: Item, charName: string) => {
  try {
    equipItem(item.id, charName, activeGameId); // itemRepository.equipItem
    refreshInventory();
  } catch (e) { console.warn('Equip failed', e); }
}, [activeGameId]);

<InventoryGrid
  items={inventoryItems}
  onItemPress={(item) => setSelectedItem(item)}
  onItemEquip={handleItemEquip}
/>

{/* Modal de detalle de ítem */}
{selectedItem && (
  <ItemDetailModal
    item={selectedItem}
    party={partyData}
    onClose={() => setSelectedItem(null)}
    onEquip={(charName) => { handleItemEquip(selectedItem, charName); setSelectedItem(null); }}
  />
)}
```

### Parte B — Posada: no restaura HP

*Ver `FEAT-03` en `GUIA_COMPLETAR_PROYECTO.md` para el fix completo.*

```typescript
// Fix rápido en handleBuildingPress 'inn':
const restedParty = partyData.map(c => ({
  ...c,
  hp: c.alive ? c.maxHp : c.hp,
  morale: Math.min(100, (c.morale ?? 80) + 15),
}));
updateProgress({ gold: gold - REST_INN_COST, partyData: restedParty });
advanceCycle('REST_LONG').then(...);
```

### Parte C — Mercado y Herrería: pantallas nuevas requeridas

*Ver `UI-03` en `GUIA_UI_FALTANTE.md` y `FEAT-02` en `GUIA_COMPLETAR_PROYECTO.md`.*

**Checklist:**
- [ ] Armería: `onItemEquip` llama `equipItem` en `itemRepository`
- [ ] Armería: `onItemPress` abre modal con detalle del ítem y lista de personajes para equipar
- [ ] Posada: HP de personajes vivos se restaura a `maxHp` al pagar
- [ ] Posada: Moral sube +15 (cap 100)
- [ ] Mercado: navega a `MarketScreen` (nueva)
- [ ] Herrería: navega a `BlacksmithScreen` (nueva)
- [ ] El recibo de la posada indica tanto el costo en oro como los beneficios (HP recuperado, moral)
