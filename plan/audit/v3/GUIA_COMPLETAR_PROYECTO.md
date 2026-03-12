# TORRE — Guía Completa de Implementación
> Auditoría v4.0 · 2026-03-12 · Basada en código real del release actual
> `CURRENT_VERSION = 15` · migrations v14 (rival_states) + v15 (kill_records) aplicadas

---

## ⚡ Estado ejecutivo

| Categoría | Estado |
|-----------|--------|
| Sprints 4C–6G | ✅ Todos implementados y verificados |
| Sprint 7 (Esencias + Ascensión) | ✅ Completo |
| GAP-01 (rival persistence) | ✅ Cerrado — `rivalRepository.ts` + migration 14 |
| GAP-02 (checkForAbandonment) | ✅ Cerrado — llamado en BattleScreen línea 615 |
| GAP-03 (secret boss) | ✅ Cerrado — `checkSecretBossForRoom` en `encounterService` |
| GAP-04 (simulateWorld cada acción) | ✅ Cerrado — guard `newCycleInt !== prevCycleInt` + `fromCycle` |
| **8 bugs funcionales de UI/gameplay** | 🔴 **Abiertos — ver sección BUGS al final** |
| Performance tasks | ✅ Todo completado |

---

## Reglas de integridad (no cambiar sin discusión)

| Código | Regla |
|--------|-------|
| NI-01 | `MAX_LEVEL_MVP = 20` en Sprint 7. Esencias activas. |
| NI-02 | `CharacterSave` canónico en `gameRepository.ts`. Campo nuevo = va ahí primero. |
| NI-03 | `makePRNG()` **nunca** inline. Siempre `import { makePRNG } from '../utils/prng'`. |
| NI-04 | `AIProfile`: `AGGRESSIVE \| DEFENSIVE \| OPPORTUNISTIC \| EXPANSIONIST \| SURVIVALIST`. |
| NI-05 | `CYCLE_COST` en `timeService.ts` es la fuente de verdad para costos de tiempo. |
| NI-06 | `CombatResult.essenceDrops` sincronizado entre `combatEngine.ts` y `essenceService.ts`. |
| NI-07 | `charClass` se almacena en lowercase (viene del index de la API 5e). Las translation keys deben usar `class_${charClass.toUpperCase()}` o normalizar en el punto de uso. |
| NI-08 | `room.visited = true` se persiste en `mapState` **antes** de navegar a Battle. La lógica de recuperación post-crash debe tratarlo como "sala ingresada pero combate pendiente". |

---

## Estado real de sprints (v4.0)

| Sprint | Estado | Evidencia en código |
|--------|--------|---------------------|
| 4C — Narrativo emocional | ✅ | `NarrativeMomentPanel`, `emotionalNarrativeService` |
| 5A — PRNG centralizado | ✅ | `dungeonGraphService` línea 12 importa `makePRNG` |
| 5B — Sistema temporal | ✅ | `updateSavedGame` persiste `cycleRaw`, `lastActionAt`, `lastSimEvents` |
| 5C — worldSimulator + rival persistence | ✅ | `rivalRepository.saveRivalsWithState`, migration 14, guard `fromCycle` |
| 6A — Migraciones v7–v15 + CharacterSave | ✅ | `CURRENT_VERSION = 15` |
| 6B — Economía + Loot | ✅ | `lootService`, `economyService` |
| 6C — Progresión XP / niveles | ✅ | `getInheritedLevel` en `progressionService` |
| 6D — Moral + Bounty | ✅ | `checkForAbandonment` llamado en BattleScreen |
| 6E — Combate expandido + Safe Zones | ✅ | Tab INVENTORY en CampScreen, `safeZoneService` |
| 6F — Alianzas | ✅ | `allianceService` completo |
| 6G — Seeds + Fin de temporada | ✅ | `seedUnificationService`, SeedScreen wired |
| 7 — IA Avanzada + Esencias | ✅ | `essenceService`, `essenceRepository`, `monsterEvolutionService`, `AscensionScreen` |
| Secret Boss | ✅ | `checkSecretBossForRoom` en `encounterService` |

---

## Sistemas pendientes de implementación real (no son bugs, son features incompletas)

### FEAT-01 🔴 — ExtractionScreen completamente mockeada

**Archivos:** `src/screens/ExtractionScreen.tsx`

La pantalla de extracción usa datos hardcodeados que no tienen relación con el estado real del juego:

```typescript
// ESTADO ACTUAL — datos hardcodeados en el módulo
const LOOT_ITEMS = [
  { name: 'IRON_LONGSWORD', rarity: 'COMMON', type: 'WEAPON', qty: 1 },
  { name: 'SHADOW_ESSENCE', rarity: 'UNCOMMON', type: 'MATERIAL', qty: 2 },
  // ...
];
const targetGold = 120; // HARDCODED
```

**Qué debería hacer:**
- Leer los ítems del inventario real del juego desde `itemRepository.getItemsByGame(activeGameId)`
- Calcular el oro extraído desde `activeGame.gold` (ya persiste en DB tras los combates)
- En caso de derrota (`fromDefeat: true`), mostrar solo los ítems adquiridos en esa sesión
- Simular los ciclos restantes del mundo antes de volver a la villa

**Pasos de implementación:**

```typescript
// ExtractionScreen.tsx — reemplazar todo el bloque de datos mock

import { getItemsByGame, type Item } from '../database/itemRepository';

const ExtractionScreen = ({ navigation, route }) => {
  const activeGameId  = useGameStore(s => s.activeGame?.id);
  const gold          = useGameStore(s => s.activeGame?.gold ?? 0);
  const cycle         = useGameStore(s => s.activeGame?.cycle ?? 1);
  const advanceCycle  = useGameStore(s => s.advanceCycle);
  const advanceToVillage = useGameStore(s => s.advanceToVillage);
  const fromDefeat    = route.params?.fromDefeat ?? false;

  const [items, setItems]     = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!activeGameId) return;
    try {
      // Solo mostrar ítems no reclamados de esta sesión
      const all = getItemsByGame(activeGameId);
      const sessionItems = all.filter(i => !i.claimed);
      setItems(sessionItems);
    } catch { setItems([]); }
    setIsLoading(false);
  }, [activeGameId]);

  const handleReturnToVillage = useCallback(async () => {
    // Si hubo derrota, simular ciclos restantes de la temporada
    if (fromDefeat) {
      await advanceToVillage(); // simula hasta fin de temporada
    }
    updateProgress({ location: 'village' });
    navigation.reset({ index: 0, routes: [{ name: 'Village' }] });
  }, [fromDefeat, advanceToVillage, updateProgress, navigation]);
```

**Checklist:**
- [ ] Items mostrados coinciden con lo que está en `itemRepository` para ese `gameId`
- [ ] El oro mostrado viene de `activeGame.gold`, no de una constante
- [ ] En `fromDefeat`, se llama `advanceToVillage()` antes de navegar
- [ ] `LOOT_ITEMS` hardcodeado y `targetGold = 120` eliminados del módulo
- [ ] Contador animado de oro usa el valor real, no 120G

---

### FEAT-02 🔴 — VillageScreen: Mercado, Herrería y Armería no funcionales

**Archivo:** `src/screens/VillageScreen.tsx`

`BUILDING_NAV` solo tiene `guild`. El mercado, herrería y armería no tienen pantalla dedicada ni funcionalidad real.

**Mercado:**

Debe navegar a una pantalla donde el jugador compre/venda ítems. Opciones:
1. Crear `MarketScreen.tsx` dedicada (recomendado para feature completa)
2. Mostrar un modal inline con los ítems de `marketItems` (ya calculados en el store) con botón de compra

Solución mínima en `VillageScreen.tsx`:

```typescript
// En BUILDING_NAV, añadir:
market: 'Market', // crear MarketScreen
blacksmith: 'Blacksmith', // crear BlacksmithScreen

// O como modal inline para el mercado:
if (key === 'market') { setShowMarket(true); return; }
```

**MarketScreen — flujo mínimo:**
- Leer `marketItems` del store (ya existen, se generan con PRNG)
- Cada ítem tiene precio calculado por `economyService.calculateItemPrice`
- Comprar: `updateProgress({ gold: gold - price })` + `createItem(...)` en `itemRepository`
- Vender: `removeItem(itemId)` + `updateProgress({ gold: gold + sellPrice })`

**Herrería:**

El sistema de mejora existe en `economyService` (`upgradeItem`). La pantalla debe:
- Listar ítems equipados del jugador desde `itemRepository`
- Mostrar costo de mejora (+1 tier)
- Ejecutar `upgradeItem` y descontar oro

**Armería:**

El `InventoryGrid` ya se muestra correctamente en la Villa. El problema es que `onItemPress` y `onItemEquip` son no-ops. Hay que conectarlos:

```typescript
// VillageScreen.tsx — dentro del bloque armory
<InventoryGrid
  items={inventoryItems}
  onItemPress={(item) => setSelectedItem(item)} // mostrar detalle
  onItemEquip={(item, charName) => {
    equipItem(item.id, charName, activeGameId);   // itemRepository.equipItem
    refreshInventory();
  }}
/>
```

**Checklist:**
- [ ] Mercado: navegar a pantalla o modal con ítems reales de `marketItems`
- [ ] Mercado: comprar descuenta oro y crea ítem en `itemRepository`
- [ ] Herrería: lista ítems y ejecuta `upgradeItem` con descuento de oro
- [ ] Armería: `onItemEquip` llama `equipItem` en `itemRepository`
- [ ] Armería: `onItemPress` abre modal de detalle del ítem

---

### FEAT-03 🟠 — VillageScreen Posada: no restaura HP del equipo

**Archivo:** `src/screens/VillageScreen.tsx` línea 172–183

La Posada cobra 50G y avanza 1 ciclo pero **no restaura HP** de los personajes. El jugador paga sin recibir el beneficio principal del descanso largo.

```typescript
// ESTADO ACTUAL — sin restauración de HP
if (key === 'inn') {
  updateProgress({ gold: gold - REST_INN_COST });
  advanceCycle('REST_LONG').then(() => { ... });
  return;
}

// CORRECTO — restaurar HP completo antes de avanzar ciclo
if (key === 'inn') {
  if (gold < REST_INN_COST) { Alert.alert(...); return; }
  
  const restedParty = partyData.map(c => ({
    ...c,
    hp: c.alive ? c.maxHp : c.hp,          // solo personajes vivos
    morale: Math.min(100, (c.morale ?? 80) + 15), // bonus de moral por descanso
  }));
  
  updateProgress({ gold: gold - REST_INN_COST, partyData: restedParty });
  advanceCycle('REST_LONG').then(() => {
    navigation.navigate('CycleTransition', {
      from: phase,
      to: phase === 'DAY' ? 'NIGHT' : 'DAY',
      cycle: (cycle ?? 1) + 1,
    });
  });
  return;
}
```

**Checklist:**
- [ ] HP de personajes vivos = `maxHp` tras pagar la posada
- [ ] Moral sube +15 (capped a 100)
- [ ] El costo de 50G se descuenta antes de la transición
- [ ] Si el jugador no puede pagar, Alert claro

---

### FEAT-04 🟠 — ReportScreen: texto de clase sin traducir (NI-07)

**Archivo:** `src/screens/ReportScreen.tsx`

Los personajes muestran "party.class_paladin" como texto crudo porque las translation keys usan `class_PALADIN` (uppercase) pero `c.charClass` viene en lowercase del API 5e.

```typescript
// INCORRECTO — key no encontrada → muestra el key crudo
t(`party.class_${c.charClass}`) // t('party.class_paladin') → 'party.class_paladin'

// CORRECTO — normalizar a uppercase para la key
t(`party.class_${c.charClass.toUpperCase()}`) // t('party.class_PALADIN') → 'Paladín'
```

Aplicar el mismo fix en todos los puntos donde se usa el charClass para i18n:
- `ReportScreen.tsx`
- `BattleScreen.tsx` (si hay keys de clase ahí)
- `CharacterDetailScreen.tsx`

**Checklist:**
- [ ] `t(\`party.class_${c.charClass}\`)` → `t(\`party.class_${c.charClass.toUpperCase()}\`)` en todos los archivos
- [ ] Verificar que las translation keys en `es.ts` y `en.ts` cubren todas las clases del juego

---

### FEAT-05 🟠 — ReportScreen: Evento Mundial hardcodeado

**Archivo:** `src/screens/ReportScreen.tsx` líneas ~230–240

```typescript
// ESTADO ACTUAL — hardcodeado en código fuente
<Text style={{ color: 'rgba(255,62,62,0.7)' }} className="font-robotomono text-[11px] mt-1">
  PARTY "LAST_LIGHT" ELIMINATED · {t('common.floor')} 03 · {t('common.cycle')} 01
</Text>
```

**Corrección:**

```typescript
// Importar lastSimulationEvents del store
const lastSimEvents = useGameStore(s => s.lastSimulationEvents);

// En el JSX — mostrar eventos reales si existen
const notableEvent = lastSimEvents?.find(e =>
  e.type === 'AI_ELIMINATED' || e.type === 'ALLIANCE_FORMED' || e.type === 'BOSS_KILLED'
);

{notableEvent ? (
  <View className="mb-4 border border-destructive/30 p-3 bg-destructive/5">
    <Text className="text-destructive font-robotomono text-xs font-bold">
      ⚠ {t('report.worldEvent')}
    </Text>
    <Text style={{ color: 'rgba(255,62,62,0.7)' }} className="font-robotomono text-[11px] mt-1">
      {lang === 'es' ? notableEvent.summary : (notableEvent.summary_en ?? notableEvent.summary)}
      {' · '}{t('common.floor')} {String(notableEvent.floor ?? activeFloor).padStart(2, '0')}
      {' · '}{t('common.cycle')} {String(notableEvent.cycle ?? activeCycle).padStart(2, '0')}
    </Text>
  </View>
) : null}
```

**Checklist:**
- [ ] El string "LAST_LIGHT" eliminado del código
- [ ] Si `lastSimEvents` está vacío, la sección de Evento Mundial no se muestra
- [ ] Si hay eventos, muestra el más relevante del tipo AI_ELIMINATED, BOSS_KILLED, ALLIANCE_FORMED

---

## Orden de implementación recomendado

```
BUGS (ver sección al final) — prioridad máxima, afectan gameplay básico
  ↓
FEAT-03 (Posada no cura HP)         — 30 min — cambio de 5 líneas
FEAT-04 (i18n clase)                — 30 min — buscar y reemplazar
FEAT-05 (evento mundial)            — 1 hora — conectar lastSimEvents
  ↓
FEAT-01 (ExtractionScreen real)     — 1 día — requiere conectar itemRepository + simulate
FEAT-02 (Mercado/Herrería/Armería)  — 2-3 días — requiere pantallas dedicadas o modales complejos
```
