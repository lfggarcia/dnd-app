# TORRE — Guía de UI Faltante
> Auditoría v5.0 · 2026-03-12 · Incorpora bugs reportados en QA + análisis de scroll y eventos

---

## Estado de pantallas

| Pantalla | Estado | Notas |
|----------|--------|-------|
| MainScreen | ✅ | Routing correcto |
| MapScreen | 🔴 3 bugs | Scroll horizontal Android (UI-08), eventos sin resolución (UI-07), botón retorno incorrecto (UI-02) |
| BattleScreen | 🔴 3 bugs | Slots vacíos (UI-01), derrota descentrada (UI-06), UUID key warnings (ver GUIA_BUGS) |
| ReportScreen | ⚠️ | Clase sin traducir (FEAT-04), evento hardcodeado (FEAT-05) |
| ExtractionScreen | 🔴 MOCK | Datos completamente hardcodeados (FEAT-01) |
| CampScreen | ✅ | Tabs PARTY / REST / INVENTORY funcionales |
| PartyScreen | ⚠️ | TextInput de nombre existe pero no persiste en DB (FEAT-06) |
| VillageScreen | ⚠️ | Posada no cura HP (FEAT-03); callbacks de Armería vacíos (UI-05) |
| GuildScreen | ⚠️ | Ranking muestra seedHash en vez de nombre (FEAT-06) |
| **MarketScreen** | 🔴 NO EXISTE | Ver GUIA_COMPLETAR_PROYECTO FEAT-02 |
| **BlacksmithScreen** | 🔴 NO EXISTE | Ver GUIA_COMPLETAR_PROYECTO FEAT-02 |
| **EventResolutionScreen** | 🔴 NO EXISTE | Salas EVENT sin resolución (UI-07) |
| CharacterDetailScreen | ✅ | Tab ESENCIAS funcional |
| AllianceScreen | ✅ | |
| NegotiationScreen | ✅ | |
| LevelUpScreen | ✅ | |
| SeedScreen | ✅ | |
| AscensionScreen | ✅ | |
| WorldLogScreen | ✅ | |

---

## UI-01 🔴 — BattleScreen: Action Bar — solo 2 slots activos de 4

### ¿Qué pasa?
La barra de acciones tiene 4 slots, pero slots 3 y 4 son `<View style={S.slotEmpty} />` — sin funcionalidad. El jugador no puede usar acciones tácticas (dodge, dash, help) desde la UI.

### ¿Por qué pasa?
Los resolvers ya existen en `combatEngine.ts` (`resolvePlayerDodge`, `resolvePlayerDash`, `resolvePlayerHelp`). El problema es que `BattleScreen.tsx` los hardcodeó como vacíos en el render y nunca conectó los botones a esas funciones.

### ¿Qué debería verse?

| Slot | Contenido | Estado en código |
|------|-----------|-----------------|
| 1 | ATACAR | ✅ funcional |
| 2 | Habilidad de clase | ✅ funcional |
| 3 | TÁCTICA (DODGE / DASH / HELP) | ❌ vacío — `S.slotEmpty` |
| 4 | ÍTEM consumible | ❌ vacío — pendiente de FEAT-01 |

### Paso 1 — Agregar estado para el picker táctico

```typescript
// BattleScreen.tsx
const [showTacticalPicker, setShowTacticalPicker] = useState(false);
const [tacticalPendingHelp, setTacticalPendingHelp] = useState(false);
```

### Paso 2 — Definir opciones tácticas

```typescript
const TACTICAL_OPTIONS = [
  { id: 'DODGE',  label: lang === 'es' ? 'ESQUIVAR' : 'DODGE',  icon: '⊕',
    desc: lang === 'es' ? 'Desventaja al próximo ataque enemigo' : 'Disadvantage on next enemy attack' },
  { id: 'DASH',   label: lang === 'es' ? 'AVANZAR'  : 'DASH',   icon: '→',
    desc: lang === 'es' ? '+2 AC efectiva este turno' : '+2 effective AC this turn' },
  { id: 'HELP',   label: lang === 'es' ? 'AYUDAR'   : 'HELP',   icon: '↑',
    desc: lang === 'es' ? 'Ventaja al próximo ataque de aliado' : 'Advantage on ally next attack' },
] as const;
```

### Paso 3 — Reemplazar los 2 slotEmpty en el JSX

```typescript
{/* ANTES — slot 3 vacío */}
<View style={[S.actionSlot, S.slotEmpty]} />

{/* DESPUÉS — slot 3 funcional */}
<TouchableOpacity
  onPress={() => setShowTacticalPicker(true)}
  disabled={!!currentPartyMember?.standardActionUsed || uiPhase !== 'PLAYER_ACTION'}
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

{/* Slot 4 — placeholder hasta FEAT-01 */}
<View style={[S.actionSlot, S.slotDisabled, { borderColor: 'rgba(0,255,65,0.1)' }]}>
  <Text style={[S.slotIcon, { color: 'rgba(0,255,65,0.2)' }]}>⚗</Text>
  <Text style={[S.slotLabel, { color: 'rgba(0,255,65,0.2)' }]}>ÍTEM</Text>
</View>
```

### Paso 4 — Modal del picker táctico

```typescript
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
            if (opt.id === 'HELP') { setTacticalPendingHelp(true); return; }
            // Conectar a dispatch existente del combatEngine
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
- [ ] ESQUIVAR aplica desventaja al siguiente ataque enemigo
- [ ] AVANZAR otorga +2 AC efectiva este turno
- [ ] AYUDAR selecciona un aliado con ventaja en su próximo ataque
- [ ] Slot 4 es placeholder ÍTEM deshabilitado (hasta FEAT-01)
- [ ] Después de usar la táctica, slot muestra "USADA"
- [ ] Flags se resetean al inicio del siguiente turno

---

## UI-02 🔴 — MapScreen: "Volver a la villa" en salas incorrectas

### ¿Qué pasa?
El botón "Volver a la villa" aparece en salas TREASURE y SECRET visitadas. Permite al jugador saltar el costo de tiempo de retirarse.

### ¿Qué debería pasar?
El botón solo debe aparecer en la sala `START` del piso actual.

### Paso 1 — Verificar el código actual

```typescript
// MapScreen.tsx ~línea 638 — condición incorrecta
{selectedRoom.visited && (
  selectedRoom.type === 'START' || selectedRoom.type === 'TREASURE' || selectedRoom.type === 'SECRET'
) && (
  <TouchableOpacity onPress={handleReturnToVillage}>...</TouchableOpacity>
)}
```

### Paso 2 — Corregir la condición

```typescript
// Solo START puede tener el botón de retorno
{selectedRoom.visited && selectedRoom.type === 'START' && (
  <TouchableOpacity onPress={handleReturnToVillage} style={styles.returnBtn}>
    <Text style={styles.returnBtnText}>{t('extraction.returnVillage')}</Text>
  </TouchableOpacity>
)}
```

### Paso 3 — Agregar hint en salas no-START visitadas

```typescript
{selectedRoom.visited && selectedRoom.type !== 'START' && (
  <Text style={{ color: 'rgba(0,255,65,0.4)', fontFamily: 'RobotoMono-Regular', fontSize: 9 }}>
    {t('map.returnToStart') || 'Sala explorada. Regresa al INICIO para extraerte.'}
  </Text>
)}
```

**Checklist:**
- [ ] Botón solo aparece en salas `START`
- [ ] TREASURE/SECRET visitadas NO muestran botón de retorno
- [ ] Hint de "regresa al INICIO" visible en salas exploradas no-START

---

## UI-03 🔴 — MarketScreen y BlacksmithScreen inexistentes

Ver documentación completa en `GUIA_COMPLETAR_PROYECTO.md` → FEAT-02.

**Resumen de UI requerido:**

**MarketScreen:**
- Lista de ítems generados con PRNG (determinístico por ciclo)
- Botón COMPRAR por ítem con confirmación y costo en gold
- Botón VENDER para ítems del inventario del jugador
- Filtros por tipo: WEAPON / ARMOR / CONSUMABLE / MATERIAL

**BlacksmithScreen:**
- Lista de ítems equipados del inventario
- Opción MEJORAR (upgrade): aumenta stats del arma en 10-20%
- Costo en gold escalado por nivel del ítem

---

## UI-04 🔴 — MapScreen: Event Room sin resolución

### ¿Qué pasa?
Cuando el jugador entra a una sala `EVENT`, simplemente se marca como visitada. No ocurre nada narrativo ni mecánico. El jugador no sabe qué esperar de estas salas.

### Root cause técnico
En `handleEnterRoom`:
```typescript
// La rama non-combat incluye EVENT, TREASURE, SECRET, START
// Todas simplemente actualizan el mapa y revelan adyacentes
// No hay navegación ni resolución específica por tipo
const afterReveal = revealAdjacentRooms(afterVisit, room.id);
setFloor(afterReveal);
updateProgress({ location: 'map', mapState: JSON.stringify(savedState) });
// ← fin: nada más pasa
```

### Solución — Ver documentación completa en GUIA_COMPLETAR_PROYECTO FEAT-09

**Resumen de UI requerida para EventResolutionScreen:**
- Cabecera con ícono del tipo de evento (AMBUSH / SHRINE / MERCHANT / TRAP / LORE / ALLY)
- Descripción narrativa del evento (texto flavor con estética CRT)
- 1-2 opciones de acción (ej: "EXPLORAR" vs "IGNORAR", "REZAR" vs "TOMAR EL ARMA")
- Animación de resultado al confirmar (efecto de scanline corto)
- Consecuencias visibles: "+30 HP a ARIA" / "-15 GOLD" / "SALA SECRETA REVELADA"
- Botón "CONTINUAR" que regresa al mapa

---

## UI-05 🔴 — VillageScreen: Armería con callbacks vacíos

### ¿Qué pasa?
La armería en `VillageScreen` muestra el `InventoryGrid` pero sus callbacks `onItemPress` y `onItemEquip` son funciones vacías `() => {}`.

### ¿Por qué pasa?
`InventoryGrid` fue renderizado sin implementar los handlers. Es un placeholder visual.

### Paso 1 — Implementar los callbacks reales

```typescript
// VillageScreen.tsx
const [selectedItem, setSelectedItem] = useState<Item | null>(null);

const handleItemEquip = useCallback((item: Item, charName: string) => {
  if (!activeGameId) return;
  try {
    equipItem(item.id, charName, activeGameId); // itemRepository.equipItem
    refreshInventory();                          // re-fetch desde DB
  } catch (e) { console.warn('[VillageScreen] equip failed', e); }
}, [activeGameId]);

// Pasar al componente
<InventoryGrid
  items={inventoryItems}
  onItemPress={(item) => setSelectedItem(item)}     // ← antes: () => {}
  onItemEquip={handleItemEquip}                      // ← antes: () => {}
/>
```

### Paso 2 — Modal de detalle de ítem para equipar

```typescript
{selectedItem && (
  <ItemDetailModal
    item={selectedItem}
    party={partyData}
    onClose={() => setSelectedItem(null)}
    onEquip={(charName) => {
      handleItemEquip(selectedItem, charName);
      setSelectedItem(null);
    }}
  />
)}
```

**Checklist:**
- [ ] `onItemPress` abre modal de detalle del ítem
- [ ] Modal muestra stats del ítem y lista de personajes disponibles para equipar
- [ ] `onItemEquip` llama `equipItem` en `itemRepository`
- [ ] Inventario se refresca después de equipar

---

## UI-06 🟠 — BattleScreen: animación de derrota descentrada

### ¿Qué pasa?
La card de derrota aparece desde la esquina superior izquierda y crece hacia abajo-derecha. No está centrada en pantalla.

### Root cause
El `defeatOverlay` no tiene `alignItems: 'center'` ni `justifyContent: 'center'`. La animación de escala toma origen en la esquina del View.

### Fix

```typescript
// BattleScreen.tsx — styles
defeatOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(0,0,0,0.72)',
  zIndex: 10,
  alignItems: 'center',      // ← añadir
  justifyContent: 'center',  // ← añadir
},
```

### Ajuste de la animación

```typescript
// Valores actuales → nuevos valores más suaves
const scale  = useRef(new Animated.Value(0.6)).current;  // era 0.4
const rotDeg = useRef(new Animated.Value(-5)).current;   // era -8

Animated.spring(scale, {
  toValue: 1.0,        // era 2.0 — no overscale
  damping: 18,
  stiffness: 70,
  useNativeDriver: true,
}).start();
```

**Checklist:**
- [ ] Card centrada horizontal y verticalmente
- [ ] Escala de 0.6 → 1.0 (no overscale)
- [ ] Rotación suavizada -5 → +4 grados

---

## UI-07 🔴 — MapScreen: scroll horizontal ausente en Android

### ¿Qué pasa?
En Android, si el mapa genera salas con posición `x` mayor al ancho inicial de la pantalla, no hay forma de scrollear horizontalmente para verlas. Las salas quedan inaccesibles visualmente.

**Dispositivos afectados:** Android (todos). iOS funciona por `bouncesZoom`.

### Root cause técnico
`ScrollView` en React Native **no puede scrollear en ambas direcciones simultáneamente**. La propiedad `horizontal` bloquea el scroll vertical y viceversa. El MapScreen solo tiene:

```typescript
// MapScreen.tsx ~línea 440 — FALTA scroll horizontal
<ScrollView
  style={styles.mapScroll}
  contentContainerStyle={{ width: CANVAS_W, height: CANVAS_H }}
  showsVerticalScrollIndicator={false}
  showsHorizontalScrollIndicator={false}
  maximumZoomScale={2}
  minimumZoomScale={0.6}
  bouncesZoom         // ← solo funciona en iOS
>
```

`CANVAS_W = Math.max(SCREEN_W, 460)` — el canvas puede ser más ancho que la pantalla si el dungeon tiene muchas salas, pero en Android no hay cómo scrollear esa dimensión extra.

### Solución — ScrollView anidado

La técnica estándar en React Native para scroll bidireccional es anidar un `ScrollView horizontal` dentro de uno vertical:

```typescript
// MapScreen.tsx — reemplazar el ScrollView único
<ScrollView
  style={styles.mapScroll}
  showsVerticalScrollIndicator={false}
  contentContainerStyle={{ minHeight: CANVAS_H }}
>
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={{ width: CANVAS_W, height: CANVAS_H }}
    // En iOS el zoom externo sigue funcionando; en Android usamos scroll manual
  >
    <MapBackground />
    <ConnectionLines ... />
    {/* nodos de salas */}
  </ScrollView>
</ScrollView>
```

### Consideración de performance
Anidar dos ScrollViews tiene un costo en el hilo UI porque ambos procesan eventos de toque. Sin embargo, el mapa no tiene listas largas (máximo ~15 rooms), y los nodos son Views absolutamente posicionados, no una FlatList. El impacto es mínimo.

**Alternativa más robusta:** usar `react-native-gesture-handler`'s `GestureDetector` con un pan gesture bidireccional + Reanimated para la posición. Esto da control total del scroll en ambos ejes en un solo componente. Recomendado si el mapa crece en complejidad o si el scroll anidado produce problemas de gesture responder.

```typescript
// Alternativa con Gesture Handler (más control, más complejidad)
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';

const panX = useSharedValue(0);
const panY = useSharedValue(0);

const panGesture = Gesture.Pan()
  .onChange(e => {
    panX.value = Math.min(0, Math.max(-(CANVAS_W - SCREEN_W), panX.value + e.changeX));
    panY.value = Math.min(0, Math.max(-(CANVAS_H - SCREEN_H), panY.value + e.changeY));
  });

const animStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: panX.value }, { translateY: panY.value }],
}));
```

### Paso a paso para la solución del ScrollView anidado (más simple)

**Paso 1** — Remover `maximumZoomScale`, `minimumZoomScale`, `bouncesZoom` del ScrollView externo (son propiedades de iOS que pueden interferir).

**Paso 2** — Agregar el ScrollView horizontal interno como se muestra arriba.

**Paso 3** — Verificar que `CANVAS_W` se calcula correctamente:

```typescript
// MapScreen.tsx — asegurar que el canvas es siempre más ancho que la pantalla
const CANVAS_W = Math.max(SCREEN_W * 1.5, 600); // mínimo 600px — garantiza espacio horizontal
```

**Paso 4** — Testear en Android con un dungeon de 10+ rooms verificando que todas las salas son alcanzables.

**Checklist:**
- [ ] `ScrollView` externo es vertical
- [ ] `ScrollView` interno tiene `horizontal` prop
- [ ] `contentContainerStyle` con `width: CANVAS_W` está en el ScrollView horizontal interno
- [ ] `CANVAS_W` garantiza espacio suficiente para la distribución de salas
- [ ] En Android, salas más allá del ancho inicial son accesibles con scroll horizontal
- [ ] En iOS, el comportamiento no regresa

---

## UI-08 🟠 — GuildScreen: Ranking muestra seedHash ilegible

Ver FEAT-06 en `GUIA_COMPLETAR_PROYECTO.md`.

**Impacto en UI:** El jugador no puede identificar su party en el ranking. El campo `g.seedHash.slice(0, 8)` como fallback es acceptable como MVP, pero el nombre real (`partyName`) debe implementarse.

---

## Resumen de prioridades

| ID | Severidad | Pantalla | Acción |
|----|-----------|----------|--------|
| UI-07 | 🔴 | MapScreen | Scroll horizontal Android — ScrollView anidado |
| UI-04 | 🔴 | EventResolutionScreen | Crear pantalla nueva |
| UI-01 | 🔴 | BattleScreen | Conectar slots 3 y 4 |
| UI-02 | 🔴 | MapScreen | Corregir condición del botón retorno |
| UI-03 | 🔴 | VillageScreen | Crear MarketScreen + BlacksmithScreen |
| UI-05 | 🔴 | VillageScreen | Implementar callbacks de Armería |
| UI-06 | 🟠 | BattleScreen | Centrar animación de derrota |
| UI-08 | 🟠 | GuildScreen | Mostrar partyName en ranking |
