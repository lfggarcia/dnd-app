# TORRE — Guía de UI Faltante
> Basada en `screen_description.MD` + `plan/sprints/` · Versión 1.0 · 2026-03-11
> Referencia: `PROJECT_STATUS.md` para el estado actual de cada pantalla

---

## Metodología de lectura

Para cada pantalla/componente se documenta:
- **Estado actual** — qué existe hoy
- **Qué falta** — gaps concretos
- **Pasos de implementación** — código y estructura
- **Por qué** — la razón de cada decisión de diseño

Las pantallas están ordenadas por **sprint de implementación**, no alfabéticamente.

---

---

# PANTALLAS DEL SPRINT 4C (Inmediato)

## [4C-UI-01] NarrativeMomentPanel — Ausente

**Estado actual:** No existe. La selección de expresión en `BattleScreen` está hardcodeada a `angry/neutral`.

**Por qué falta:** El pipeline de generación de expresiones (22 variantes por personaje) existe en DB y los scripts existen, pero no hay componente que las muestre dinámicamente durante el combate.

**Qué falta exactamente:**
- Componente `NarrativeMomentPanel.tsx` (panel de texto emocional)
- Lógica de selección dinámica de expresión según evento de combate
- Auto-dismiss en 3.5 segundos sin bloquear acciones

**Paso 1 — Estructura del componente:**

```
src/components/NarrativeMomentPanel.tsx
│
├── Props: { moment: NarrativeMoment, portraitUri?: string, onDismiss: () => void }
├── Layout: overlay flotante sobre el log de combate
│   ├── Portrait del personaje (si existe el uri)
│   ├── Texto headline de la situación dramática
│   └── Barra de progreso de tiempo (visual de los 3.5s)
└── Comportamiento: Animated.sequence fade-in → delay → fade-out → onDismiss()
```

**Paso 2 — Posicionamiento en BattleScreen:**

```
┌─────────────────────────────────┐
│  [Portrait enemigo]             │
│  [Ilustración del combate]      │
│                                 │
│  ┌─────────────────────────┐   │
│  │ [NarrativeMomentPanel]  │   │  ← aparece aquí, sobre el log
│  │ "¡Theron ha caído!"     │   │
│  └─────────────────────────┘   │
│  [Log de combate animado]       │
│  [Botones de acción]            │
└─────────────────────────────────┘
```

**Paso 3 — Reglas de aparición (no más de 3 veces por combate):**

```typescript
const MAX_MOMENTS_PER_COMBAT = 3;
const momentCount = useRef(0);

const showMoment = (moment: NarrativeMoment) => {
  if (momentCount.current >= MAX_MOMENTS_PER_COMBAT) return;
  momentCount.current += 1;
  setActiveMoment(moment);
};
```

**Paso 4 — Accesibilidad:**

El panel no puede bloquear los botones de acción (Attack, Flee, etc.). Usar `pointerEvents="none"` en el Animated.View del panel para que los taps pasen a través.

---

---

# PANTALLAS DEL SPRINT 5

## [5-UI-01] CycleTransitionScreen — Parcialmente conectada

**Estado actual:** Existe pero `nextCycle = 4` está hardcodeado. No muestra eventos reales del worldSimulator.

**Por qué falta:** El worldSimulator no existía hasta Sprint 5. La pantalla fue creada como placeholder.

**Paso 1 — Conectar al store real:**

```typescript
// ANTES (datos hardcodeados):
const nextCycle = 4;
const previousFloor = 5;
const phases = ['Procesando...', 'Ciclo 3 → Ciclo 4', 'Lista.'];

// DESPUÉS (datos reales):
const activeGame = useGameStore(s => s.activeGame);
const lastSimEvents = useGameStore(s => s.lastSimulationEvents);

const nextCycle = activeGame?.cycle ?? 1;
const previousFloor = activeGame?.floor ?? 1;
```

**Paso 2 — Mostrar eventos del worldSimulator:**

```typescript
// Top 5 eventos del simulador, mostrados como fases de la transición:
const displayEvents = lastSimEvents?.slice(0, 5) ?? [];

const phases = useMemo(() => [
  t('cycleTransition.extracting'),
  `${t('cycleTransition.cycle')} ${nextCycle - 1} → ${nextCycle}`,
  ...displayEvents.map(e => e.summary),  // eventos reales del mundo
  t('cycleTransition.ready'),
], [t, nextCycle, displayEvents]);
```

**Paso 3 — Layout mínimo esperado:**

```
┌─────────────────────────────────┐
│  ⟳ PROCESANDO CICLO...         │
│                                 │
│  CICLO 3 → CICLO 4             │
│                                 │
│  · IronFang derrotó a BloodMoon │  ← evento real del worldSim
│  · LostSoul avanzó al piso 7   │  ← evento real
│  · Alianza entre ShadowPact...  │  ← evento real
│                                 │
│  [▶ CONTINUAR]                  │
└─────────────────────────────────┘
```

---

## [5-UI-02] WorldLogScreen — Datos mock

**Estado actual:** Existe pero con `LOG_ENTRIES` mock hardcodeadas. Memoización ya implementada.

**Qué falta:** Conectar a `lastSimulationEvents` del store (que el worldSimulator poblará).

**Paso 1 — Reemplazar mock por datos reales:**

```typescript
// ANTES:
const LOG_ENTRIES = [
  { type: 'COMBAT', cycle: 3, summary: 'Evento mock...' },
  // ... más mocks
];

// DESPUÉS:
const lastSimEvents = useGameStore(s => s.lastSimulationEvents);
const allEvents = useGameStore(s => s.allWorldEvents); // historial completo desde DB

// En eventRepository.ts: getEventsBySeed(seedHash) para cargar historial
```

**Paso 2 — Filtros de WorldLog:**

Los filtros ya existen como constante `FILTERS` de módulo. Verificar que los tipos de eventos del worldSimulator (`AI_COMBAT_WIN`, `AI_FLOOR_ADVANCE`, etc.) coincidan con los tipos que los filtros esperan.

---

---

# PANTALLAS DEL SPRINT 6

## [6-UI-01] VillageScreen — Revivir y Market incompletos

**Estado actual:** Conectada al store real. Revivir es gratis. Market muestra texto generado por seed pero no items reales de DB.

**Qué falta:**
1. Revivir con costo real (oro descuenta, rechaza si insuficiente)
2. Market conectado a `itemRepository` (items reales en DB)
3. Posada con costo de ciclo real (REST_INN_COST = 50G)

**Paso 1 — Sección de revivir:**

```typescript
// Mostrar costo junto al botón de revivir:
const { cost, breakdown } = calculateReviveCost({
  level: char.level ?? 1,
  deathCount: char.deathCount ?? 0,
  alive: false,
});

// UI:
<TouchableOpacity
  onPress={() => reviveCharacter(char.name)}
  disabled={gold < cost}
  className={`border p-3 ${gold < cost ? 'border-red-900 opacity-50' : 'border-amber-500'}`}
>
  <Text className="text-amber-400">REVIVIR</Text>
  <Text className="text-gray-400 text-xs">{cost}G · {breakdown}</Text>
</TouchableOpacity>
```

**Paso 2 — Pantalla de mercado real:**

```
┌─────────────────────────────────┐
│  MERCADO [Ciclo 4 · Piso 3]    │
│  ────────────────────────────   │
│  [IRON_DAGGER]  [HEALTH_POTION] │
│  Común · 80G    Común · 50G    │
│  Piso 2         Stock: 3       │
│  ────────────────────────────   │
│  INVENTARIO (items del jugador) │
│  [SHADOW_ESSENCE] Poco común   │
│  Valor venta: 72G              │
└─────────────────────────────────┘
```

**Paso 3 — Posada con costo real:**

```typescript
const handleRest = useCallback(async () => {
  if (gold < REST_INN_COST) {
    Alert.alert('Sin fondos', `La posada cuesta ${REST_INN_COST}G`);
    return;
  }
  updateProgress({ gold: gold - REST_INN_COST });
  await advanceCycle('REST_LONG'); // llama al worldSimulator
  navigation.navigate('CycleTransition');
}, [gold, advanceCycle]);
```

**Paso 4 — Modal de cierre de temporada (ciclo 60):**

```
┌─────────────────────────────────┐
│  ⚠ LA TORRE SE CIERRA          │
│                                 │
│  Has llegado al Ciclo 60.      │
│  La Torre expulsa a todos.     │
│                                 │
│  [INICIAR NUEVA TEMPORADA]      │
│  [VER HISTORIAL DE LA TORRE]   │
└─────────────────────────────────┘
```

---

## [6-UI-02] GuildScreen — Hub social incompleto

**Estado actual:** Muestra roster con HP bars y stats. No tiene bounties, alianzas ni WorldLog real.

**Qué falta:**
- Sección de Bounties activos contra el jugador
- Lista de alianzas activas con su estado (ciclos restantes)
- WorldLog funcional conectado a eventos reales
- Rankings de la temporada

**Paso 1 — Tabs de GuildScreen:**

```
┌────────────────────────────────────────┐
│  [GREMIO] [BOUNTIES] [ALIANZAS] [LOG] │  ← tabs
│  ──────────────────────────────────── │
│  BOUNTIES ACTIVOS:                    │
│  ┌──────────────────────────────────┐ │
│  │ Nivel 2 · Recompensa: 500G      │ │
│  │ "Eliminar 2 parties del jugador" │ │
│  │ Kills actuales: 1/2             │ │
│  └──────────────────────────────────┘ │
│                                        │
│  ALIANZAS ACTIVAS:                    │
│  · ShadowPact — expira ciclo 8       │
│  · 200G/ciclo de protección          │
└────────────────────────────────────────┘
```

**Paso 2 — Ranking de temporada:**

```typescript
// Datos del ranking: parties ordenadas por piso máximo alcanzado
// Los rivals del worldSimulator tienen floor actualizado en DB
const rankings = loadRankingsFromDB(seedHash); // cargar al montar

// UI: lista plana con posición, nombre, piso, miembros vivos
```

---

## [6-UI-03] CampScreen — Nueva pantalla (0% implementada)

**Estado actual:** No existe. Los nodos `SAFE_ZONE` en MapScreen muestran un panel "Volver a la villa" pero sin pantalla de campamento real.

**Por qué existe:** La zona segura es el único lugar dentro del dungeon donde se puede gestionar la party: subir de nivel, equipar items, descansar. Sin esta pantalla, el jugador no puede confirmar niveles pendientes.

**Paso 1 — Registrar en navigación:**

```typescript
// src/navigation/types.ts
CampScreen: {
  roomId: string;     // ID del nodo safe_zone
  floor: number;
};
```

**Paso 2 — Layout de CampScreen con tabs:**

```
┌─────────────────────────────────────────┐
│  ⛺ CAMPAMENTO · Piso 3               │
│  ─────────────────────────────────────  │
│  [PARTY] [INVENTARIO] [DESCANSO]       │  ← tabs
│  ─────────────────────────────────────  │
│                                         │
│  TAB: PARTY                            │
│  ┌─────────────────────────────────┐   │
│  │ [Portrait] Theron · Lv 3 → 4 ↑ │   │  ← pendingLevelUp
│  │ HP: 24/30                       │   │
│  │ [SUBIR NIVEL]                   │   │
│  ├─────────────────────────────────┤   │
│  │ [Portrait] Lyra · Lv 2          │   │
│  │ HP: 18/20                       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  TAB: DESCANSO                         │
│  · Descanso corto → +HP parcial (gratis en campamento)
│  · Descanso largo → +HP completo (consume 1 ciclo)
│  · Esperar fin de temporada → saltar al ciclo 60
│                                         │
└─────────────────────────────────────────┘
```

**Paso 3 — Trigger de `SAFE_ZONE_WAIT` (NI-05):**

```typescript
// CampScreen.tsx — botón "Esperar fin de temporada":
const handleWaitEndOfSeason = useCallback(async () => {
  // Calcular ciclos a simular:
  const remaining = cyclesRemaining(activeGame.cycle); // timeService
  if (remaining === 0) return; // ya en ciclo 60

  // Mostrar SimulationLoadingScreen y correr worldSimulator en lotes
  navigation.navigate('SimulationLoading', { fromCycle: activeGame.cycle });
  await advanceToVillage(); // gameStore — simula en lotes de 6 ciclos
  navigation.navigate('Village');
}, [activeGame, advanceToVillage, navigation]);
```

**Paso 4 — Acceso desde MapScreen:**

```typescript
// MapScreen.tsx — al seleccionar un nodo SAFE_ZONE:
if (selectedRoom.type === 'SAFE_ZONE') {
  navigation.navigate('CampScreen', {
    roomId: selectedRoom.id,
    floor: activeGame.floor,
  });
}
```

---

## [6-UI-04] LevelUpScreen — Nueva pantalla (0% implementada)

**Estado actual:** No existe. Cuando un personaje tiene `pendingLevelUp: true`, no hay forma de confirmar el nivel.

**Paso 1 — Layout:**

```
┌─────────────────────────────────┐
│  ⬆ SUBIDA DE NIVEL             │
│  Theron · Guerrero              │
│  Nivel 3 → Nivel 4             │
│  ─────────────────────────────  │
│  MEJORAS:                       │
│  + 8 HP máximos                 │
│  + Proficiency Bonus mantiene   │
│  + Fighting Style: [ELEGIR]     │  ← si la clase lo requiere
│                                 │
│  ┌─ Elegir estilo ─────────┐   │
│  │ ○ Dueling (+2 daño)     │   │
│  │ ○ Great Weapon (+reroll) │   │
│  │ ○ Defense (+1 AC)       │   │
│  └─────────────────────────┘   │
│                                 │
│  [CONFIRMAR NIVEL]              │
└─────────────────────────────────┘
```

**Paso 2 — Lógica de confirmación:**

```typescript
const handleConfirmLevelUp = useCallback(() => {
  const result = applyLevelUp(char, selectedChoice); // progressionService
  const updatedParty = activeGame.partyData.map(c =>
    c.name === char.name ? result.updatedChar : c
  );
  updateProgress({ partyData: updatedParty });
  navigation.goBack(); // regresa a CampScreen
}, [char, selectedChoice]);
```

---

## [6-UI-05] NegotiationScreen — Nueva pantalla (0% implementada)

**Estado actual:** No existe. La clave de traducción `flee` existe pero la huida no tiene mecánica real.

**Paso 1 — Layout:**

```
┌─────────────────────────────────┐
│  ⚔ ENCUENTRO CON RIVAL         │
│  ShadowPact · Piso 4           │
│  ─────────────────────────────  │
│  OPCIONES:                      │
│                                 │
│  [ATACAR]                       │
│  Iniciar combate PvP            │
│                                 │
│  [NEGOCIAR]                     │
│  Ofrecer oro o alianza          │
│  ┌─────────────────────────┐   │
│  │ Pagar paso libre: 200G  │   │
│  │ Proponer alianza        │   │
│  │ Ofrecer 500G directo    │   │
│  └─────────────────────────┘   │
│                                 │
│  [HUIR]                         │
│  Chequeo Atletismo/Sigilo DC 15 │
│  Riesgo: un miembro puede quedar│
└─────────────────────────────────┘
```

---

## [6-UI-06] AllianceScreen — Nueva pantalla (0% implementada)

**Estado actual:** No existe. Referenciada en `screen_description.MD` sección 14.

**Paso 1 — Layout:**

```
┌─────────────────────────────────┐
│  🤝 ALIANZAS                   │
│  ─────────────────────────────  │
│  PROPONER ALIANZA               │
│  ┌─────────────────────────┐   │
│  │ Party: ShadowPact       │   │
│  │ Tipo: Protección mutua  │   │
│  │ Duración: 5 ciclos      │   │
│  │ Fee: 100G/ciclo         │   │
│  └─────────────────────────┘   │
│  [ENVIAR PROPUESTA]             │
│  ─────────────────────────────  │
│  ALIANZAS ACTIVAS               │
│  · IronFang — 3 ciclos rest.   │
│  · Cost: 150G/ciclo            │
│  [ROMPER ALIANZA] (-moral)      │
└─────────────────────────────────┘
```

---

## [6-UI-07] UnificationScreen — Nueva pantalla (0% implementada)

**Estado actual:** No existe. Se muestra cuando el jugador intenta crear una nueva party en una seed donde ya tiene una.

**Paso 1 — Layout:**

```
┌─────────────────────────────────┐
│  ⚠ SEED EXISTENTE DETECTADA    │
│  ─────────────────────────────  │
│  Tu party anterior en esta seed │
│  pasará a ser controlada por IA.│
│                                 │
│  PARTY ANTERIOR:                │
│  · Theron (Lv 3) — Vivo       │
│  · Lyra (Lv 2) — Muerta       │
│  · Kael (Lv 4) — Vivo         │
│                                 │
│  NUEVA PARTY:                   │
│  Nivel inicial heredado: Lv 3   │
│  (promedio de la party anterior)│
│                                 │
│  ⚠ Esta acción es IRREVERSIBLE │
│                                 │
│  [CONTINUAR CON NUEVA PARTY]    │
│  [CANCELAR]                     │
└─────────────────────────────────┘
```

---

## [6-UI-08] SimulationLoadingScreen — Nueva pantalla (0% implementada)

**Estado actual:** No existe. Se necesita cuando el jugador usa `SAFE_ZONE_WAIT` para saltar al ciclo 60 (puede tomar varios lotes de simulación).

**Paso 1 — Layout:**

```
┌─────────────────────────────────┐
│  ⟳ SIMULANDO EL MUNDO...       │
│                                 │
│  Ciclo 20 → Ciclo 40           │
│  [████████░░░░░░░░░] 40%       │
│                                 │
│  DESTACADO:                     │
│  · ShadowPact eliminó a BloodM  │
│  · IronFang alcanzó el piso 8  │
│  · Nueva alianza formada...     │
│                                 │
│  Procesando en lotes de 6 ciclos│
└─────────────────────────────────┘
```

**Paso 2 — Lógica de lotes:**

```typescript
// La simulación en lotes viene de advanceCycleBatch() en gameStore
// La pantalla recibe updates vía callback/state del store
// Cada lote emite un highlight que se muestra en la pantalla
```

---

---

# PANTALLAS DEL SPRINT 7

## [7-UI-01] AscensionScreen — Nueva pantalla (0% implementada)

**Estado actual:** No existe. Solo accesible post-nivel 20.

**Paso 1 — Layout:**

```
┌─────────────────────────────────┐
│  ✦ ASCENSIÓN                   │
│  Theron · Lv 20                │
│  ─────────────────────────────  │
│  Tu personaje ha alcanzado      │
│  el límite mortal.              │
│                                 │
│  CAMINOS DE ASCENSIÓN:          │
│  ○ Ascensión de Luz            │
│    +50% curación party          │
│    Req: moral > 80              │
│                                 │
│  ○ Ascensión Oscura            │
│    +40% daño, -moral party      │
│    Req: bounty nivel 3+         │
│                                 │
│  ○ Ascensión del Vacío         │
│    Inmune a esencias ajenas     │
│    Req: 5 esencias épicas       │
│                                 │
│  ⚠ La ascensión es PERMANENTE  │
│  [ASCENDER]                     │
└─────────────────────────────────┘
```

---

## [7-UI-02] CharacterDetailScreen — Parcialmente implementada

**Estado actual:** El archivo existe pero no tiene contenido real. Referenciada en la navegación.

**Qué falta:**
- Tabs: Stats / Inventario / Habilidades / Traits / Esencias (Sprint 7)
- Stats grid completo con bonificadores de esencias
- Lista de items equipados/en mochila
- Lista de habilidades de clase + de esencias

**Paso 1 — Estructura de tabs:**

```
┌────────────────────────────────────────┐
│  [Portrait]  Theron · Guerrero Lv 4   │
│  ──────────────────────────────────── │
│  [STATS] [EQUIPO] [HABILIDADES] [✦]   │  ← ✦ = Esencias (Sprint 7)
│  ──────────────────────────────────── │
│                                        │
│  TAB STATS:                           │
│  STR: 18 (+4)   DEX: 12 (+1)         │
│  CON: 16 (+3)   INT: 10 (+0)         │
│  WIS: 8  (-1)   CHA: 14 (+2)         │
│  ──────────────                        │
│  HP: 38/45  AC: 16  Speed: 30ft      │
│  Prof Bonus: +2                       │
│  Saves: STR +6, CON +5               │
│                                        │
│  TAB ESENCIAS (Sprint 7):             │
│  Slot 1: [Esencia del Lobo]          │
│    → Passive: +2 Iniciativa           │
│  Slot 2: [VACÍO — nv 9 requerido]    │
└────────────────────────────────────────┘
```

---

# COMPONENTES FALTANTES

## [COMP-01] BountyBoard — Componente faltante

**Referenciado en:** `screen_description.MD` sección 13. No existe como componente.

**Estructura:**

```typescript
// src/components/BountyBoard.tsx
type Props = {
  bounties: Bounty[];
  seedHash: string;
};

// UI: lista de bounties con party name, recompensa, razón
// Se usa en GuildScreen y opcionalmente en VillageScreen
```

## [COMP-02] InventoryGrid — Componente faltante

**Referenciado en:** `screen_description.MD` sección 10. Sistema de slots 5×6.

**Estructura:**

```typescript
// src/components/InventoryGrid.tsx
type Props = {
  items: LootDrop[];
  onItemPress: (item: LootDrop) => void;
  onItemEquip: (item: LootDrop, charName: string) => void;
};

// Grid de 30 slots (5×6)
// Cada slot muestra: icono del item, rarity color, cantidad si stackeable
// Tap → modal de detalle del item
```

## [COMP-03] AllianceCard — Componente faltante

**Para:** GuildScreen y AllianceScreen.

```typescript
// src/components/AllianceCard.tsx
type Props = {
  alliance: Alliance;
  onBreak: () => void;
};
// Muestra: nombre de la party aliada, ciclos restantes, fee, botón de romper alianza
```

## [COMP-04] BossRoomEntryUI — Componente faltante

**Referenciado en:** `screen_description.MD` sección 16.

```typescript
// src/components/BossRoomEntryUI.tsx
// Se muestra al seleccionar un nodo BOSS en MapScreen (antes de entrar)
// Muestra: ilustración del boss, warning de preparación, estado de la party, botón ENTRAR
```

---

# PANTALLAS EXISTENTES CON UI INCOMPLETA

## [EXIST-01] BattleScreen — UI incompleta

**Estado actual:** Funcional para combate PvP con monstruos. Falta:
- Botones reales de acción (Attack, Spell, Item, Move, Defend) — actualmente el combate es auto-resolve
- Soporte visual para combate PvP (mostrar party rival con portraits)
- Panel de estado de la party rival en PvP

**Nota:** El auto-resolve es intencional para el MVP. Los botones de acción manual son Sprint 6+.

## [EXIST-02] ReportScreen — UI parcialmente mock

**Estado actual:** Muestra datos reales de `lastCombatResult`. El gráfico de barras de daño funciona. Falta:
- Sección de loot obtenido (items reales de `itemRepository`)
- Sección de XP ganada y si hubo nivel nuevo
- Sección de esencias dropeadas (Sprint 7)

**Paso — Añadir sección de loot:**

```typescript
// En useEffect al montar:
const lootDrops = getItemsByGame(activeGame.id); // itemRepository
const freshDrops = lootDrops.filter(i => i.obtainedCycle === activeGame.cycle);
setDisplayLoot(freshDrops);

// En el JSX — debajo del gráfico de daño:
<Text className="text-amber-400 font-bold">LOOT OBTENIDO</Text>
{displayLoot.map(item => (
  <View key={item.id}>
    <Text>{item.name} · {item.rarity} · {item.goldValue}G</Text>
  </View>
))}
```

## [EXIST-03] MainScreen — Settings ausente

**Referenciado en:** `screen_description.MD` sección 19. Botón "Settings" existe en la pantalla pero navega a ningún lado.

**Paso — Crear SettingsScreen básico:**

```
┌─────────────────────────────────┐
│  ⚙ CONFIGURACIÓN               │
│                                 │
│  IDIOMA: [ES] [EN]              │
│                                 │
│  VELOCIDAD DE TEXTO:            │
│  Lento · Normal · Rápido       │
│                                 │
│  SONIDO: [ON/OFF]               │
│  (Sprint 7 — por ahora toggle) │
│                                 │
│  DIFICULTAD: Cruel (fija)      │
│                                 │
│  CRÉDITOS                       │
│  [CERRAR]                       │
└─────────────────────────────────┘
```

## [EXIST-04] SeedScreen — Validación ausente

**Estado actual:** Acepta cualquier input como seed. No valida mínimo de caracteres ni caracteres válidos.

**Por qué importa (RT-08):** Seeds muy cortas o con Unicode de baja entropía producen collisiones en el hash djb2. Dos seeds distintas pueden generar el mismo dungeon.

**Paso — Añadir validación:**

```typescript
const validateSeed = (input: string): string | null => {
  if (input.length < 4) return 'La seed debe tener al menos 4 caracteres';
  if (!/^[\x20-\x7E]+$/.test(input)) return 'Solo se permiten caracteres ASCII imprimibles';
  return null; // válida
};

// Al presionar "Start Expedition":
const error = validateSeed(seedInput);
if (error) {
  Alert.alert('Seed inválida', error);
  return;
}
```

---

# Resumen de pantallas por sprint

| Pantalla/Componente | Sprint | Estado | Prioridad |
|---------------------|--------|--------|-----------|
| NarrativeMomentPanel | 4C | ❌ Crear | 🔴 Alta |
| CycleTransitionScreen | 5 | 🟡 Conectar datos | 🔴 Alta |
| WorldLogScreen | 5 | 🟡 Conectar datos | 🔴 Alta |
| VillageScreen (revivir/market) | 6 | 🟡 Completar | 🔴 Alta |
| GuildScreen (bounties/alianzas) | 6 | 🟡 Completar | 🔴 Alta |
| CampScreen | 6 | ❌ Crear | 🔴 Alta |
| LevelUpScreen | 6 | ❌ Crear | 🔴 Alta |
| NegotiationScreen | 6 | ❌ Crear | 🟡 Media |
| AllianceScreen | 6 | ❌ Crear | 🟡 Media |
| UnificationScreen | 6 | ❌ Crear | 🟡 Media |
| SimulationLoadingScreen | 6 | ❌ Crear | 🟡 Media |
| BountyBoard (componente) | 6 | ❌ Crear | 🟡 Media |
| InventoryGrid (componente) | 6 | ❌ Crear | 🟡 Media |
| CharacterDetailScreen | 6-7 | 🟡 Completar | 🟡 Media |
| BossRoomEntryUI (componente) | 6 | ❌ Crear | 🟢 Baja |
| AscensionScreen | 7 | ❌ Crear | 🟢 Baja |
| SettingsScreen | 7 | ❌ Crear | 🟢 Baja |
| ReportScreen (loot real) | 6 | 🟡 Completar | 🟢 Baja |
| SeedScreen (validación) | 5 | 🟡 Añadir validación | 🟡 Media |

---

# Convenciones de UI para todo el equipo

| Regla | Detalle |
|-------|---------|
| Paleta | Solo usar clases Tailwind de la paleta CRT cyberpunk del proyecto |
| Fuente | RobotoMono para todo el texto — nunca fuente por defecto del sistema |
| Modales | Siempre usar `ConfirmModal` existente para confirmaciones destructivas |
| Listas largas | `FlatList` con `windowSize={5}` — nunca `ScrollView` con 50+ items |
| Botones grandes | Mínimo 48px de altura para hitbox accesible en mobile |
| No `<form>` | React Native no tiene `<form>`. Usar `onPress` y `onChange` directamente |
| Navegación | Todas las nuevas pantallas deben tiparse en `navigation/types.ts` |
