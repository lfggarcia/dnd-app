# TORRE — Guía de UI Faltante
> Basada en `screen_description.MD` + `plan/sprints/` · Versión 2.0 · 2026-03-11
> Estado: La mayoría de pantallas existen. Esta guía documenta los **gaps de integración** en las existentes y las adiciones pendientes de Sprint 7.

---

## Metodología de lectura

Para cada pantalla/componente:
- **Estado actual** — qué existe hoy y con qué nivel de completitud
- **Qué falta** — gaps concretos con referencia a archivo y línea
- **Implementación** — pasos de código con estructura
- **Por qué** — razón de cada decisión de diseño

Las pantallas están ordenadas por sprint de implementación.

---

## Resumen de estado de pantallas

| Pantalla / Componente | Estado |
|-----------------------|--------|
| `NarrativeMomentPanel` | ✅ Completo — slide animado, 3.5s auto-dismiss, límite 3/combate |
| `BossRoomEntryUI` | ✅ Completo — integrado en MapScreen |
| `CycleTransitionScreen` | ✅ Completo — conectado al store real, muestra eventos del worldSimulator |
| `WorldLogScreen` | ✅ Completo — conectado a `lastSimulationEvents`, filtros por categoría |
| `CampScreen` | ⚠️ Casi — tabs PARTY y REST implementados. Falta tab INVENTORY |
| `LevelUpScreen` | ✅ Completo — `confirmLevelUps()` real, HP ganado, navegación |
| `NegotiationScreen` | ✅ Completo — `attemptFlee()` real, opciones de pago y alianza |
| `AllianceScreen` | ✅ Completo — carga alianzas de DB, propuesta, terminación |
| `UnificationScreen` | ⚠️ Parcial — pantalla UI lista, pero no llama a `seedUnificationService` |
| `SimulationLoadingScreen` | ✅ Completo — llama `advanceToVillage()`, animación de progreso |
| `VillageScreen` | ✅ Completo — revive con coste real, posada con ciclo, armería con inventario DB |
| `GuildScreen` | ✅ Completo — BountyBoard y AllianceCard integrados, datos reales de DB |
| `ReportScreen` | ✅ Completo — loot real de `lootService`, items guardados en DB |
| `SeedScreen` | ✅ Completo — validación RT-08 activa (min 4 chars, ASCII, 2 unique chars) |
| `BountyBoard` | ✅ Completo |
| `InventoryGrid` | ✅ Completo |
| `AllianceCard` | ✅ Completo |
| `CharacterDetailScreen` | ⚠️ Casi — 2 tabs (STATS, EQUIPO). Falta tab ESENCIAS (Sprint 7) |
| `AscensionScreen` | ✅ Completo (Sprint 7) — 3 paths con requisitos |
| `BattleScreen` (wiring) | ⚠️ Wiring incompleto — falta `recordPartyKill()` y `checkForAbandonment()` |

---

---

# GAPS EN PANTALLAS EXISTENTES

## [GAP-01] CampScreen — Falta tab INVENTORY

**Estado actual:** `CampScreen.tsx` tiene 2 tabs: `PARTY` (ver HP/XP/nivel) y `REST` (descanso corto/largo/esperar).

**Por qué falta:** El tab INVENTORY debería mostrar los items del personaje desde `itemRepository` y permitir equipar/desequipar. Requiere que el inventario haya sido poblado vía `lootService` en combate, lo cual ya funciona desde ReportScreen.

**Archivo:** `src/screens/CampScreen.tsx`

**Paso GAP-01-A** — Añadir `'INVENTORY'` al tipo de tab:

```typescript
type CampTab = 'PARTY' | 'REST' | 'INVENTORY';
```

**Paso GAP-01-B** — Añadir botón en la barra de tabs:

```typescript
{ key: 'INVENTORY', label: lang === 'es' ? 'INVENTARIO' : 'INVENTORY' },
```

**Paso GAP-01-C** — Renderizar el tab con `InventoryGrid`:

```typescript
import { InventoryGrid } from '../components/InventoryGrid';
import { getItemsByGame } from '../database/itemRepository';

{tab === 'INVENTORY' && activeGame && (
  <View>
    <Text className="text-primary/40 font-robotomono text-xs mb-3 px-1">
      {lang === 'es' ? 'OBJETOS RECOGIDOS' : 'COLLECTED ITEMS'}
    </Text>
    <InventoryGrid
      items={getItemsByGame(activeGame.id).map(item => ({
        id: item.id,
        name: item.name,
        type: item.type,
        rarity: item.rarity,
        goldValue: item.goldValue,
        data: item.data,
      }))}
      onItemPress={(item) => {
        // Placeholder — equipar en Sprint 7 con essenceService
        Alert.alert(item.name, `${item.rarity.toUpperCase()} · ${item.goldValue}G`);
      }}
    />
  </View>
)}
```

**Checklist:**
- [ ] Tab INVENTORY aparece en CampScreen
- [ ] Los items recogidos en ReportScreen aparecen listados en INVENTORY
- [ ] El componente `InventoryGrid` renderiza correctamente con ítems reales

---

## [GAP-02] UnificationScreen — No llama a `seedUnificationService`

**Estado actual:** `UnificationScreen.tsx` muestra la advertencia de acción irreversible y navega a `Party`, pero no marca la partida anterior como IA-inherited ni aplica el nivel heredado.

**Por qué falta:** `seedUnificationService.ts` no existe aún (ver GUIA_COMPLETAR_PROYECTO Sprint 6G).

**Archivo:** `src/screens/UnificationScreen.tsx`

Ver implementación completa en **GUIA_COMPLETAR_PROYECTO Paso 6G-03**.

---

## [GAP-03] BattleScreen — Wiring incompleto con moral y bounty

**Estado actual:** BattleScreen llama `awardXP`, `applyMoralEvent` y actualiza `deathCount`. NO llama `recordPartyKill()` ni `checkForAbandonment()`.

**Archivos:** `src/screens/BattleScreen.tsx`, `src/screens/CampScreen.tsx`

Ver implementación en **GUIA_COMPLETAR_PROYECTO FIX-03 y FIX-04**.

---

---

# PANTALLAS PENDIENTES DE SPRINT 7

## [7-UI-01] CharacterDetailScreen — Falta tab ESENCIAS

**Estado actual:** `CharacterDetailScreen.tsx` (972 líneas) tiene 2 tabs: `STATS` y `EQUIPO`. No tiene tab `ESENCIAS`.

**Por qué falta:** El sistema de esencias (`essenceService.ts`) está definido en tipos pero los drops no están cableados a BattleScreen ni existe `essenceRepository.ts` todavía.

**Archivo:** `src/screens/CharacterDetailScreen.tsx`

**Paso 7-UI-01-A** — Cambiar tipo del tab:

```typescript
const [activeTab, setActiveTab] = useState<'STATS' | 'EQUIPO' | 'ESENCIAS'>('STATS');
```

**Paso 7-UI-01-B** — Añadir botón en `tabRow`:

```typescript
{(['STATS', 'EQUIPO', 'ESENCIAS'] as const).map(tab => (
  <TouchableOpacity key={tab} ... />
))}
```

**Paso 7-UI-01-C** — Renderizar tab ESENCIAS:

```typescript
import { getEssenceSlots } from '../services/essenceService';
import { getEssencesByChar, equipEssence, unequipEssence } from '../database/essenceRepository';

{activeTab === 'ESENCIAS' && (
  <View style={S.tabContent}>
    {/* Slots disponibles */}
    <View style={S.essenceHeader}>
      <Text style={S.label}>
        {lang === 'es' ? 'SLOTS DE ESENCIA' : 'ESSENCE SLOTS'}
      </Text>
      <Text style={S.value}>
        {getEssenceSlots(char.level, char.isAscended)}
        {char.isAscended ? ' (+1 ascendido)' : ''}
      </Text>
    </View>

    {/* Lista de esencias */}
    {essenceList.length === 0 ? (
      <Text style={S.empty}>
        {lang === 'es' ? 'Sin esencias — derrota monstruos' : 'No essences — defeat monsters'}
      </Text>
    ) : (
      essenceList.map(e => (
        <View key={e.id} style={S.essenceRow}>
          <View style={{ flex: 1 }}>
            <Text style={S.essenceName}>{e.definitionId} · Rk{e.rank}</Text>
            <Text style={S.essenceSub}>
              {lang === 'es' ? `Evolución ${e.evolutionLevel}/3` : `Evolution ${e.evolutionLevel}/3`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              if (e.equipped) unequipEssence(e.id);
              else equipEssence(e.id, char.name, activeGame.id);
              refreshEssences();
            }}
          >
            <Text style={e.equipped ? S.btnEquipped : S.btnEquip}>
              {e.equipped
                ? (lang === 'es' ? 'DESQUIPAR' : 'UNEQUIP')
                : (lang === 'es' ? 'EQUIPAR' : 'EQUIP')}
            </Text>
          </TouchableOpacity>
        </View>
      ))
    )}
  </View>
)}
```

**Paso 7-UI-01-D** — Añadir estado local para esencias:

```typescript
const [essenceList, setEssenceList] = useState<ReturnType<typeof getEssencesByChar>>([]);

const refreshEssences = useCallback(() => {
  if (!activeGameId || !char) return;
  setEssenceList(getEssencesByChar(activeGameId, char.name));
}, [activeGameId, char]);

useEffect(() => {
  if (activeTab === 'ESENCIAS') refreshEssences();
}, [activeTab, refreshEssences]);
```

**Convención UI:**
- Rank 1 (Legendaria) → color `text-accent` (ámbar)
- Rank 2 (Mítica) → color `text-secondary` (verde lima)
- Rank 3-5 → color `text-primary/80`
- Slot lleno → mostrar error con `ConfirmModal`

**Checklist:**
- [ ] Tab ESENCIAS aparece en CharacterDetailScreen
- [ ] Las esencias obtenidas en BattleScreen aparecen listadas
- [ ] Equipar/desequipar respeta el límite de slots
- [ ] Personaje ascendido muestra "+1 ascendido" en el contador de slots

---

## [7-UI-02] AscensionScreen — Ya existe, verificar requisitos

**Estado actual:** `AscensionScreen.tsx` (387 líneas) está completamente implementada con los 3 paths (TITAN/ARCHMAGE/AVATAR_OF_WAR), requisitos y animaciones.

**Qué falta:** Los requisitos usan `moralScore` y `bountyLevel` como parámetros. Verificar que estos se calculan correctamente al navegar desde CharacterDetailScreen:

```typescript
// Al navegar a AscensionScreen:
navigation.navigate('Ascension', {
  charIndex,
  bountyLevel: getBounty(activeGame.id, activeGame.seedHash)?.bountyLevel ?? 0,
  epicEssences: getEssencesByChar(activeGame.id, char.name).filter(e => e.rank <= 3).length,
});
```

**Checklist:**
- [ ] AscensionScreen recibe `bountyLevel` y `epicEssences` reales
- [ ] El path TITAN requiere `morale > 80` verificado contra `char.morale`
- [ ] El path ARCHMAGE requiere `bountyLevel >= 3`
- [ ] El path AVATAR_OF_WAR requiere `epicEssences >= 5`
- [ ] Al confirmar ascensión, `char.isAscended = true` y `char.ascensionPath` se persiste

---

---

# CONVENCIONES UI — Aplicar en todas las pantallas nuevas

| Regla | Detalle |
|-------|---------|
| Fuente | `font-robotomono` siempre — nunca fuente del sistema |
| Paleta | `text-primary` (verde terminal), `text-secondary` (verde lima), `text-accent` (ámbar), `text-destructive` (rojo) |
| Tamaño mínimo botón | 48px de altura — `py-3` como mínimo |
| Acciones destructivas | Siempre usar `ConfirmModal` antes de ejecutar |
| Listas largas | `FlatList` con `windowSize={5}` si hay más de 50 items |
| Navegación | Todas las pantallas nuevas deben estar tipadas en `navigation/types.ts` |
| CRT Overlay | Siempre `<CRTOverlay />` como primer hijo del root `<View>` |
| Header | `<TouchableOpacity onPress={() => navigation.goBack()}>` con `{'<'} {t('common.back')}` |

---

# Pantallas que NO faltan (confirmadas como completas)

Las siguientes pantallas se consideraban pendientes en la auditoría anterior y ahora están **completamente implementadas**:

- `CycleTransitionScreen` — conectada al store real, muestra `lastSimulationEvents`
- `WorldLogScreen` — datos reales, filtros COMBAT/LORE/SYSTEM, agrupado por ciclo
- `LevelUpScreen` — `confirmLevelUps()` real con HP ganado correcto
- `NegotiationScreen` — flee con `encounterService`, opciones de pago y alianza reales
- `AllianceScreen` — carga de DB, propuesta con costo de gold, terminación con confirmación
- `SimulationLoadingScreen` — llama `advanceToVillage()`, progreso animado
- `BountyBoard` — datos reales de `getAllActiveBounties()`
- `InventoryGrid` — grid de 5×6 con raridad y tipo
- `AllianceCard` — muestra alianza con botón romper + confirmación
- `BossRoomEntryUI` — integrado en MapScreen, aparece antes de sala BOSS
