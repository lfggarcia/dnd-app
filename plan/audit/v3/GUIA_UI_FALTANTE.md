# TORRE — Guía de UI Faltante
> Auditoría v4.0 · 2026-03-12

---

## Estado de pantallas

| Pantalla | Estado | Notas |
|----------|--------|-------|
| MainScreen | ✅ | Routing correcto: `location='map'` → MapScreen |
| MapScreen | ⚠️ BUG | `Volver a la villa` en salas incorrectas (BUG-02) |
| BattleScreen | ⚠️ BUG | Solo 2 acciones en el slot bar (BUG-01) + animación derrota descentrada (BUG-06) |
| ReportScreen | ⚠️ FEAT | Datos reales en su mayoría, pero clase sin traducir + evento mundial hardcodeado |
| ExtractionScreen | 🔴 MOCK | Loot y oro completamente hardcodeados |
| CampScreen | ✅ | Tabs PARTY / REST / INVENTORY funcionales |
| PartyScreen | ✅ | |
| VillageScreen | ⚠️ FEAT | Armería visible pero callbacks vacíos; Mercado/Herrería sin funcionalidad; Posada no cura HP |
| GuildScreen | ✅ | |
| AllianceScreen | ✅ | |
| NegotiationScreen | ✅ | |
| LevelUpScreen | ✅ | |
| SeedScreen | ✅ | |
| UnificationScreen | ✅ | |
| CharacterDetailScreen | ✅ | Tab ESENCIAS funcional |
| AscensionScreen | ✅ | |
| WorldLogScreen | ✅ | |
| SimulationLoadingScreen | ✅ | |
| CycleTransitionScreen | ✅ | |
| SettingsScreen | ✅ | |
| **MarketScreen** | 🔴 **NO EXISTE** | Necesita crearse |
| **BlacksmithScreen** | 🔴 **NO EXISTE** | Necesita crearse |

---

## UI-01 🔴 — BattleScreen: Action Bar — solo 2 slots activos de 4

### ¿Qué pasa?
La barra de acciones muestra 4 slots pero solo 2 tienen contenido: ATACAR y una habilidad de clase. Los otros 2 son `<View style={S.slotEmpty} />` — espacios vacíos sin funcionalidad.

```typescript
// BattleScreen.tsx ~línea 891 — ESTADO ACTUAL
<View style={S.actionSlotRow}>
  <TouchableOpacity onPress={handleAttack}>ATACAR</TouchableOpacity>
  <TouchableOpacity onPress={handleAbility}>{currentAbility?.name}</TouchableOpacity>
  <View style={[S.actionSlot, S.slotEmpty]} />   {/* ← vacío */}
  <View style={[S.actionSlot, S.slotEmpty]} />   {/* ← vacío */}
</View>
```

### ¿Qué debería haber?
Los 4 slots deben ser acciones en combate de DnD 5e:

| Slot | Contenido | Estado |
|------|-----------|--------|
| 1 | ATACAR (ataque básico) | ✅ implementado |
| 2 | Habilidad de clase (GOLPE_DIVINO, MISIL_MAGICO, etc.) | ✅ implementado |
| 3 | DASH / ESQUIVAR / AYUDAR — acción estándar extra | ❌ vacío |
| 4 | USAR ÍTEM — consumibles del inventario | ❌ vacío |

### Pasos de implementación

**Paso 1 — Añadir estado para acción estándar (slot 3)**

Las acciones estándar extra del DnD 5e: DASH (mover), DODGE (esquivar), HELP (dar ventaja al aliado).

```typescript
// En combatEngine.ts — agregar al LiveCombatState
standardActionUsed: boolean; // acción estándar (DASH/DODGE/HELP) ya usada este turno

// initCombat — inicializar
partyState: party.map(c => ({
  ...existing,
  standardActionUsed: false,
}))

// initTurn — resetear al inicio del turno
partyState[i] = { ...state, abilityUsed: false, standardActionUsed: false }
```

**Paso 2 — Handler de acción estándar en BattleScreen**

```typescript
// BattleScreen.tsx — agregar constante de acciones estándar
type StandardAction = { id: 'DASH' | 'DODGE' | 'HELP'; label: string; icon: string };
const STANDARD_ACTIONS: StandardAction[] = [
  { id: 'DODGE', label: 'ESQUIVAR', icon: '⊕' },
  { id: 'DASH',  label: 'AVANZAR',  icon: '→' },
  { id: 'HELP',  label: 'AYUDAR',   icon: '↑' },
];
const [activeStandardAction, setActiveStandardAction] = useState<StandardAction | null>(null);
const [showStandardPicker, setShowStandardPicker] = useState(false);
```

**Paso 3 — Efectos de cada acción estándar**

```typescript
// En combatEngine.ts — applyStandardAction
export function applyStandardAction(
  state: LiveCombatState,
  actorIdx: number,
  action: 'DASH' | 'DODGE' | 'HELP',
  targetIdx?: number,
  rng: PRNG,
): { newState: LiveCombatState; logLine: string } {
  const member = state.partyState[actorIdx];
  switch (action) {
    case 'DODGE':
      // Siguiente ataque enemigo contra este personaje tiene desventaja
      // Implementar como flag: member.dodging = true → en resolveEnemyAttack, tirar 2d20 y tomar menor
      return { newState: applyflag(state, actorIdx, 'dodging'), logLine: `  ${member.name.toUpperCase()} TOMA POSICIÓN DEFENSIVA` };
    case 'DASH':
      // No tiene efecto en combate táctico de TORRE (el movimiento es abstracto)
      // Otorgar +2 AC este turno como representación de movilidad táctica
      return { newState: applyFlag(state, actorIdx, 'dashing'), logLine: `  ${member.name.toUpperCase()} MANIOBRA TÁCTICAMENTE (+2 AC)` };
    case 'HELP':
      // Siguiente ataque del aliado targetIdx tiene ventaja
      if (targetIdx !== undefined) {
        return { newState: applyFlag(state, targetIdx, 'helped'), logLine: `  ${member.name.toUpperCase()} ASISTE A ${state.partyState[targetIdx].name.toUpperCase()}` };
      }
  }
}
```

**Paso 4 — Slot 3 en la action bar**

```tsx
{/* Slot 3 — Acción estándar */}
<TouchableOpacity
  onPress={() => setShowStandardPicker(true)}
  disabled={!!currentPartyMember?.standardActionUsed}
  style={[S.actionSlot, S.slotStandard, currentPartyMember?.standardActionUsed && S.slotDisabled]}
>
  <Text style={S.slotIcon}>⊕</Text>
  <Text style={S.slotLabel} numberOfLines={1}>
    {currentPartyMember?.standardActionUsed ? 'USADA' : 'TÁCTICA'}
  </Text>
</TouchableOpacity>
```

**Paso 5 — Slot 4: Usar ítem consumible**

```typescript
// Leer consumibles del inventario en BattleScreen
const [consumables, setConsumables] = useState<Item[]>([]);
useEffect(() => {
  if (!activeGameId) return;
  const items = getItemsByGame(activeGameId).filter(i => i.type === 'consumable' && !i.claimed);
  setConsumables(items);
}, [activeGameId]);
```

```tsx
{/* Slot 4 — Usar ítem */}
<TouchableOpacity
  onPress={() => consumables.length > 0 && setShowItemPicker(true)}
  disabled={consumables.length === 0}
  style={[S.actionSlot, S.slotItem, consumables.length === 0 && S.slotDisabled]}
>
  <Text style={S.slotIcon}>⚗</Text>
  <Text style={S.slotLabel}>ÍTEM {consumables.length > 0 ? `(${consumables.length})` : ''}</Text>
</TouchableOpacity>
```

**Checklist:**
- [ ] Slot 3 muestra TÁCTICA y abre picker con ESQUIVAR / AVANZAR / AYUDAR
- [ ] ESQUIVAR aplica desventaja al próximo ataque enemigo en el mismo turno
- [ ] Slot 4 muestra ÍTEM (n) donde n = número de consumibles disponibles
- [ ] Si n=0, slot 4 aparece deshabilitado
- [ ] Al usar un ítem, `claimItem(itemId)` se llama en `itemRepository`
- [ ] El log de combate refleja la acción con el formato existente

---

## UI-02 🟠 — BattleScreen: Animación de derrota descentrada

### ¿Qué pasa?
`DefeatAnimation` usa `absoluteFillObject` en su `View` contenedor pero **no tiene `alignItems: 'center'` ni `justifyContent: 'center'`**. La card animada empieza desde la esquina superior izquierda con `scale: 0.4` y crece hacia abajo-derecha.

```typescript
// BattleScreen.tsx ~línea 1359 — ESTADO ACTUAL
defeatOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(0,0,0,0.72)',
  zIndex: 10,
  // ❌ falta: alignItems, justifyContent
},
```

### Fix

```typescript
// CORRECTO
defeatOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(0,0,0,0.72)',
  zIndex: 10,
  alignItems: 'center',
  justifyContent: 'center',
},
```

Además, el `scale` debe partir de 0.6 (no 0.4) para que el efecto de "carta que crece hacia el jugador" sea más cinematográfico:

```typescript
// DefeatAnimation — ajuste de animación
const scale = useRef(new Animated.Value(0.6)).current;  // era 0.4
// spring con más amortiguación para que no bouncie tanto
Animated.spring(scale, { toValue: 1.0, damping: 18, stiffness: 70, useNativeDriver: true })
// ↑ toValue: 1.0 en lugar de 2.0 — centrada y tamaño natural, no overscaled
```

**Checklist:**
- [ ] La card del enemigo aparece centrada en la pantalla
- [ ] La animación de escala parte de 0.6 y llega a 1.0 (no overscale)
- [ ] El texto DEFEAT y el botón >> CONTINUAR siguen visibles debajo del overlay
- [ ] En mobile con notch, la card no queda cortada por el status bar

---

## UI-03 🔴 — MarketScreen — no existe

### ¿Qué debería ser?
Una pantalla donde el jugador compra y vende ítems del mercado dinámico. El stock ya se genera en `VillageScreen` usando PRNG con seed (`${seedHash}_market_${cycle}`).

### Estructura de pantalla

```
┌─────────────────────────────────────┐
│ MERCADO — Ciclo 03 / Piso Máx: 2   │
│ Oro disponible: 120G               │
├─────────────────────────────────────┤
│ EN VENTA                           │
│ Quarterstaff    COMMON  12G  [COMPRAR]│
│ Oil (flask)     COMMON   8G  [COMPRAR]│
│ Lute            COMMON  35G  [COMPRAR]│
├─────────────────────────────────────┤
│ TU INVENTARIO                      │
│ Iron Longsword  COMMON  → vender 6G│
│ Shadow Essence  UNCOMMON → vender 15G│
└─────────────────────────────────────┘
```

### Pasos de implementación

**Paso 1 — Crear `MarketScreen.tsx`**

```typescript
// src/screens/MarketScreen.tsx
export const MarketScreen = ({ navigation }: ScreenProps<'Market'>) => {
  const seedHash   = useGameStore(s => s.activeGame?.seedHash ?? '');
  const cycle      = useGameStore(s => s.activeGame?.cycle ?? 1);
  const gold       = useGameStore(s => s.activeGame?.gold ?? 0);
  const activeGameId = useGameStore(s => s.activeGame?.id);
  const updateProgress = useGameStore(s => s.updateProgress);

  // Stock del mercado — determinístico por seed+cycle
  const [marketStock, setMarketStock] = useState<MarketItem[]>([]);
  // Inventario del jugador
  const [inventory, setInventory] = useState<Item[]>([]);

  useEffect(() => {
    const stock = generateMarketStock(seedHash, cycle, maxFloor); // en economyService
    setMarketStock(stock);
    if (activeGameId) setInventory(getItemsByGame(activeGameId));
  }, [seedHash, cycle, activeGameId]);

  const handleBuy = (item: MarketItem) => {
    if (gold < item.price) { Alert.alert(...); return; }
    createItem({ ...item, ownerGameId: activeGameId, seedHash });
    updateProgress({ gold: gold - item.price });
    setMarketStock(prev => prev.filter(i => i.id !== item.id)); // ítem comprado se va del stock
  };

  const handleSell = (item: Item) => {
    const sellPrice = Math.floor(item.goldValue * 0.5); // 50% del valor
    removeItem(item.id);
    updateProgress({ gold: gold + sellPrice });
    setInventory(prev => prev.filter(i => i.id !== item.id));
  };
  // ... render
};
```

**Paso 2 — Agregar a la navegación**

```typescript
// navigation/types.ts — añadir a RootStackParamList
Market: undefined;
Blacksmith: undefined;
```

```typescript
// AppNavigator.tsx
const MarketScreen = lazy(() => import('../screens/MarketScreen').then(m => ({ default: m.MarketScreen })));
// Agregar al Stack.Navigator
<Stack.Screen name="Market" component={MarketScreen} />
```

**Paso 3 — Conectar desde VillageScreen**

```typescript
// BUILDING_NAV
const BUILDING_NAV = {
  guild: 'Guild',
  market: 'Market',        // ← añadir
  blacksmith: 'Blacksmith', // ← añadir
};
```

**Checklist:**
- [ ] `MarketScreen` navega desde `VillageScreen` al presionar Mercado
- [ ] El stock cambia con cada ciclo (determinístico)
- [ ] Comprar descuenta oro y agrega el ítem a `itemRepository`
- [ ] Vender remueve el ítem y suma el 50% de su `goldValue` al oro
- [ ] Si el jugador no tiene oro suficiente, Alert con mensaje claro
- [ ] `BlacksmithScreen` con estructura similar para upgrades

---

## UI-04 🟠 — ReportScreen: UI mejorada con animaciones

El reporte de combate actual es funcional pero estático. El screenshot muestra barras de daño sin animación y el layout podría communicar mejor la información.

### Mejoras propuestas

**A — Barras de daño animadas (Reanimated)**

```typescript
import { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';

// Por cada barra de daño
const DamageBar = memo(({ damage, maxDamage, name }) => {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(damage / maxDamage, { duration: 600 });
  }, [damage, maxDamage]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.round(width.value * 100)}%`,
  }));

  return (
    <View>
      <Animated.View style={[barStyle, { height: 28, backgroundColor: 'rgba(0,255,65,0.4)' }]} />
      <Text>{name.substring(0, 5).toUpperCase()}</Text>
    </View>
  );
});
```

**B — Contador animado de XP y Oro**

Similar al contador de oro en ExtractionScreen (ya implementado):

```typescript
const AnimatedNumber = ({ target, suffix = '' }) => {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let current = 0;
    const step = Math.ceil(target / 20);
    const interval = setInterval(() => {
      current = Math.min(current + step, target);
      setDisplayed(current);
      if (current >= target) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, [target]);
  return <Text>{suffix}{displayed}</Text>;
};
```

**C — Esencias obtenidas en combate**

Si el combate generó essence drops, mostrarlos en una sección separada con color de rareza:

```typescript
const essenceDrops = combatResult?.essenceDrops ?? [];
{essenceDrops.length > 0 && (
  <View className="mb-4 border border-accent/40 p-3 bg-accent/5">
    <Text className="text-accent font-robotomono text-[9px] font-bold mb-2">
      ✦ {lang === 'es' ? 'ESENCIAS OBTENIDAS' : 'ESSENCES OBTAINED'}
    </Text>
    {essenceDrops.map((drop, i) => (
      <View key={i} className="flex-row justify-between items-center py-1">
        <Text className="text-primary/80 font-robotomono text-[9px]">{drop.definitionId}</Text>
        <Text style={{ color: RANK_COLORS[drop.rank] }} className="font-robotomono text-[8px]">
          RANK {drop.rank}
        </Text>
      </View>
    ))}
  </View>
)}
```

**Checklist:**
- [ ] Barras de daño animadas con `withTiming` (600ms, ease out)
- [ ] XP y Oro con contador animado tipo contador
- [ ] Sección de esencias visible cuando `combatResult.essenceDrops.length > 0`
- [ ] Sección de esencias usa colores por rank (rank 1 = legendario = rojo, etc.)
- [ ] Las animaciones usan `cancelAnimation` en cleanup para no leak

---

## Componentes existentes correctos (referencia — no modificar)

| Componente | Estado | Nota |
|------------|--------|------|
| `CRTOverlay` | ✅ | SVG pattern, 1 nodo |
| `NarrativeMomentPanel` | ✅ | Animaciones Reanimated |
| `BossRoomEntryUI` | ✅ | |
| `InventoryGrid` | ✅ | Conectado a `itemRepository` |
| `ConfirmModal` | ✅ | `React.memo` |
| `TypewriterText` | ✅ | Cursor cleanup correcto |
| `GlossaryModal` | ✅ | FlatList + memo |
| `AllianceCard` | ✅ | |
| `SliderButton` | ✅ | |

---

## Prioridad de UI

```
UI-02 (defeat animation)      — 20 min — 2 líneas de CSS
UI-04A (damage bar animated)  — 1 hora — Reanimated
  ↓
UI-01 (4 action slots)        — 1-2 días — requiere cambios en combatEngine
  ↓
UI-03 (MarketScreen)          — 2 días — pantalla nueva completa
UI-04B/C (XP counter, esencias) — 3-4 horas — enhancement visual
```
