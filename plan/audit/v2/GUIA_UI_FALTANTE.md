# TORRE — Guía de UI Faltante
> Auditoría v3.0 · 2026-03-11
> Estado: La mayoría de UI planificada está implementada. Quedan 3 gaps de UI reales.

---

## Estado general de pantallas

| Pantalla | Estado | Notas |
|----------|--------|-------|
| MainScreen | ✅ Completo | |
| MapScreen | ✅ Completo | O(1) lookup memoizado |
| BattleScreen | ⚠️ GAP | Falta feedback visual de deserción (GAP-02) |
| CampScreen | ✅ Completo | Tab INVENTORY con InventoryGrid ✅ |
| PartyScreen | ✅ Completo | |
| VillageScreen | ✅ Completo | DB queries async ✅ |
| GuildScreen | ✅ Completo | |
| AllianceScreen | ✅ Completo | |
| NegotiationScreen | ✅ Completo | |
| LevelUpScreen | ✅ Completo | |
| SeedScreen | ✅ Completo | Llama `checkSeedStatus` ✅ |
| UnificationScreen | ✅ Completo | Recibe `inheritedLevel` y `previousPartyNames` ✅ |
| CharacterDetailScreen | ✅ Completo | Tab ESENCIAS con `essenceRepository` ✅ |
| AscensionScreen | ✅ Completo | |
| ReportScreen | ✅ Completo | |
| WorldLogScreen | ✅ Completo | |
| SimulationLoadingScreen | ✅ Completo | |
| CycleTransitionScreen | ✅ Completo | |
| ExtractionScreen | ✅ Completo | |
| SettingsScreen | ✅ Completo | |

---

## UI-GAP-01 🔴 — BattleScreen: Sin feedback visual de deserción

### ¿Qué es y por qué existe?
Cuando un personaje abandona la party (moral < 20, alignment bueno, check probabilístico), el sistema lo procesa internamente pero actualmente **no hay ninguna UI que lo comunique al jugador**. El personaje simplemente desaparece del roster en el siguiente render, lo que puede parecer un bug.

### Flujo esperado

```
Combate termina con derrota
  → applyMoralEvent('DEFEAT_IN_COMBAT') reduce moral
  → checkForAbandonment evalúa si alguien abandona
  → [NUEVO] Pantalla/modal de deserción muestra quién se fue y por qué
  → generateReplacementAdventurer crea el reemplazo
  → [NUEVO] Reemplazo presentado al jugador con sus stats
```

### Pasos de implementación

**Paso 1 — Crear estado local en BattleScreen para la deserción**

```typescript
// BattleScreen.tsx — agregar al bloque de useState
const [desertionEvent, setDesertionEvent] = useState<{
  deserters: CharacterSave[];
  replacements: CharacterSave[];
  log: string[];
} | null>(null);
```

**Paso 2 — Modal de deserción inline**

Dentro del JSX de BattleScreen, añadir un Modal condicional tras el resultado de combate:

```tsx
{desertionEvent && (
  <Modal transparent animationType="fade" visible>
    <View className="flex-1 bg-black/80 items-center justify-center p-6">
      <View className="border border-destructive rounded p-5 w-full max-w-sm bg-background">
        <Text className="text-destructive font-robotomono text-sm font-bold mb-3">
          ⚠ {lang === 'es' ? 'DESERCIÓN' : 'DESERTION'}
        </Text>

        {desertionEvent.log.map((line, i) => (
          <Text key={i} className="text-primary/80 font-robotomono text-xs mb-1">
            · {line}
          </Text>
        ))}

        <View className="border-t border-primary/20 mt-4 pt-4">
          <Text className="text-primary/40 font-robotomono text-xs mb-2">
            {lang === 'es' ? 'REEMPLAZOS:' : 'REPLACEMENTS:'}
          </Text>
          {desertionEvent.replacements.map(r => (
            <Text key={r.name} className="text-accent font-robotomono text-xs">
              + {r.name} · Lv {r.level} · {r.class}
            </Text>
          ))}
        </View>

        <TouchableOpacity
          onPress={() => setDesertionEvent(null)}
          className="mt-4 border border-primary/40 rounded p-3 items-center"
        >
          <Text className="text-primary font-robotomono text-sm">
            {lang === 'es' ? '[CONTINUAR]' : '[CONTINUE]'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
)}
```

**Paso 3 — Trigger del modal tras el check**

```typescript
const abandonResult = checkForAbandonment(postMoralParty, seedHash, cycle);
if (abandonResult.abandoned.length > 0) {
  const replacements = abandonResult.abandoned.map(d =>
    generateReplacementAdventurer(d, cycle)
  );
  setDesertionEvent({
    deserters: abandonResult.abandoned,
    replacements,
    log: abandonResult.log,
  });
}
```

**Checklist de verificación:**
- [ ] Modal aparece cuando hay deserción, no aparece cuando no hay
- [ ] El nombre del desertor y la razón ("moral demasiado baja") se ven claramente
- [ ] El reemplazo muestra nombre, nivel y clase
- [ ] Al cerrar el modal, la party en el HUD refleja el cambio
- [ ] El modal tiene estética CRT consistente con el resto de la app

---

## UI-GAP-02 🟠 — WorldLogScreen: Sin indicador de eventos de rival persistidos

### ¿Qué es y por qué existe?
Una vez implementado GAP-01 (rival persistence), el WorldLogScreen puede mostrar si los rivales son nuevos o tienen historia (ciclos supervividos, perfil cultural). Actualmente todos los rivales en el log aparecen iguales sin contexto de su trayectoria.

### Pasos de implementación (depende de GAP-01)

**Paso 1 — Enriquecer SimulationEvent con datos de rival**

En `worldSimulator.ts`, cuando se genera un evento de tipo `AI_COMBAT_WIN` o `AI_FLOOR_ADVANCE`, incluir el ciclo de vida del rival:

```typescript
events.push({
  type: 'AI_FLOOR_ADVANCE',
  summary: `${rival.name} avanzó al piso ${rival.floor}`,
  summary_en: `${rival.name} advanced to floor ${rival.floor}`,
  cycle,
  rivalAge: cycle - (rival.firstSeenCycle ?? cycle), // ciclos de vida
  rivalProfile: state.profile,
});
```

**Paso 2 — Badge de veterano en WorldLogScreen**

En la tarjeta de cada evento de la lista, si `rivalAge > 10`, mostrar un badge:

```tsx
{event.rivalAge > 10 && (
  <Text className="text-accent font-robotomono text-xs">
    ★ {lang === 'es' ? `Veterano · ${event.rivalAge} ciclos` : `Veteran · ${event.rivalAge} cycles`}
  </Text>
)}
```

**Checklist de verificación:**
- [ ] Rivals con >10 ciclos muestran badge "Veterano"
- [ ] El perfil de IA (AGGRESSIVE, DEFENSIVE, etc.) aparece junto al nombre del rival en eventos relevantes
- [ ] Los eventos de VENDETTA muestran el nombre de la party objetivo

---

## UI-GAP-03 🟡 — CharacterDetailScreen: Sin indicador de "riesgo de deserción"

### ¿Qué es y por qué existe?
Si un personaje tiene moral < 20 y alignment lawful/good, está en riesgo de abandonar. El jugador no tiene visibilidad de esto en la pantalla de detalle del personaje, lo que hace el sistema opaco.

### Pasos de implementación

**Paso 1 — Calcular riesgo en CharacterDetailScreen**

```typescript
import { ABANDON_THRESHOLD } from '../services/moralSystem';

const isAtRisk =
  (char.morale ?? 80) < ABANDON_THRESHOLD &&
  (char.alignment ?? '').includes('LAWFUL') || (char.alignment ?? '').includes('GOOD');
```

**Paso 2 — Banner de aviso en la vista del personaje**

```tsx
{isAtRisk && (
  <View className="border border-destructive/60 rounded p-3 mb-4 flex-row items-center">
    <Text className="text-destructive font-robotomono text-xs">
      ⚠ {lang === 'es'
        ? `Moral crítica (${char.morale}). Riesgo de deserción en combate.`
        : `Critical morale (${char.morale}). Desertion risk in combat.`}
    </Text>
  </View>
)}
```

**Paso 3 — Color de moral en la barra de stats**

La barra de moral (`char.morale`) debe cambiar de color según umbral:

```tsx
const moraleColor =
  (char.morale ?? 80) < 20 ? 'bg-destructive' :
  (char.morale ?? 80) < 40 ? 'bg-yellow-500' :
  'bg-primary';

<View className={`h-1 rounded-full ${moraleColor}`}
  style={{ width: `${char.morale ?? 80}%` }}
/>
```

**Checklist de verificación:**
- [ ] Banner rojo aparece para personajes con morale < 20 y alignment lawful/good
- [ ] Banner NO aparece para personajes con morale < 20 pero alignment neutral/evil
- [ ] La barra de moral es roja/amarilla/verde según el nivel
- [ ] El banner desaparece cuando la moral sube sobre el umbral

---

## Componentes ya implementados correctamente (referencia)

Estos componentes se auditaron y están correctos — no requieren cambios:

| Componente | Estado | Nota |
|------------|--------|------|
| `CRTOverlay` | ✅ | SVG pattern en lugar de 100 Views |
| `InventoryGrid` | ✅ | Conectado a `itemRepository.getInventory()` |
| `NarrativeMomentPanel` | ✅ | Animación con Reanimated |
| `BossRoomEntryUI` | ✅ | |
| `AllianceCard` | ✅ | |
| `ConfirmModal` | ✅ | Envuelto en `React.memo` |
| `TypewriterText` | ✅ | Cursor se detiene al terminar |
| `GlossaryModal` | ✅ | FlatList con windowSize, `React.memo` en items |
| `SliderButton` | ✅ | |
| `TutorialOverlay` | ✅ | |

---

## Prioridad de implementación de UI

```
UI-GAP-01 (desertion modal)       — Depende de GAP-02 en GUIA_COMPLETAR
  ↓
UI-GAP-03 (moral risk badge)      — Independiente, fácil de hacer ya
  ↓
UI-GAP-02 (rival veteran badge)   — Depende de GAP-01 en GUIA_COMPLETAR
```
