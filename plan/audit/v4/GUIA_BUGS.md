# TORRE — Bugs Identificados y Correcciones
> Auditoría v5.0 · 2026-03-12  
> Incorpora bug crítico de UUID (nombres duplicados), bugs de mapa (scroll, eventos) y todos los bugs de v3

---

## Índice de bugs

| ID | Severidad | Sistema | Descripción corta |
|----|-----------|---------|-------------------|
| **BUG-09** | 🔴 **Crítico** | BattleScreen / CombatEngine | Personajes con mismo nombre se unifican en combate — mueren juntos |
| BUG-01 | 🔴 Alta | BattleScreen | Solo 2 acciones en la barra de 4 slots |
| BUG-02 | 🔴 Alta | MapScreen | "Volver a la villa" en salas incorrectas |
| BUG-03 | 🟠 Media | ReportScreen | Clase de personaje muestra key i18n cruda |
| BUG-04 | 🔴 Alta | BattleScreen / App | Cerrar app durante combate = combate auto-ganado |
| BUG-05 | 🔴 Alta | MapScreen / Boss | Cerrar app durante boss = boss muerto al volver |
| BUG-06 | 🟠 Media | BattleScreen | Animación de derrota descentrada + sin simulación en derrota total |
| BUG-07 | 🔴 Alta | ExtractionScreen | Datos completamente mockeados |
| BUG-08 | 🔴 Alta | VillageScreen | Armería, Posada, Mercado sin funcionalidad real |
| **BUG-10** | 🔴 Alta | MapScreen | Scroll horizontal ausente en Android |
| **BUG-11** | 🔴 Alta | MapScreen | Salas EVENT sin resolución real |

---

## BUG-09 🔴 CRÍTICO — Muerte doble por nombre duplicado en combate

### Descripción

Si dos personajes de la party tienen el mismo nombre (ej: dos personajes llamados "ARIA"), en `BattleScreen`:

1. **React lanza warning de duplicate key** porque `key={`${char.name}-${i}`}` no garantiza unicidad cuando el nombre se repite.
2. **Los turnos se unifican**: `combatEngine.ts` parsea el log de combate buscando actores por nombre. Si dos actores tienen el mismo nombre, `.find()` siempre retorna el primero, haciendo que los turnos del segundo se apliquen al primero.
3. **Al morir uno, mueren ambos**: las funciones de detección de muerte también buscan por nombre, marcando como muertos a todos los personajes que compartan el nombre del fallecido.

### Root cause técnico profundo

`combatEngine.ts` usa el nombre del personaje como identificador semántico en múltiples lugares:

```typescript
// 1. En el log de combate — el actor se identifica por nombre en texto plano
logLine: `  ${member.name.toUpperCase()} ATACA A ${target.name.toUpperCase()}`

// 2. En el parseo de eventos — busca quién hizo la acción por prefijo de nombre en el log
const actorName = state.partyState
  .find(m => line.startsWith(`  ${m.name.toUpperCase()}`))?.name
  // ← si hay dos "ARIA", siempre retorna el primero

// 3. En BattleScreen — key duplicada
key={`${char.name}-${i}`}  // el índice -i mitiga el warning pero no el bug semántico

// 4. En resolución de muerte
state.partyState.find(m => line.includes(m.name.toUpperCase()))?.name ?? 'unknown'
// ← dos "ARIA" → siempre lee el primero como el que murió
```

### Solución completa — Ver GUIA_COMPLETAR_PROYECTO FEAT-07

La solución requiere:
1. Agregar `characterId: string` a `CharacterSave` (UUID generado al crear)
2. Propagar `characterId` a `LivePartyMember` en `combatEngine.ts`
3. Reemplazar búsquedas por nombre con búsquedas por `characterId`
4. Actualizar todas las `key` de React a usar `characterId`

### Fix inmediato de emergencia (hasta implementar FEAT-07)

Si no se puede implementar FEAT-07 inmediatamente, este fix previene el peor caso (muerte doble):

```typescript
// BattleScreen.tsx — donde se inicializa el combate
// Antes de llamar initCombat, verificar nombres únicos y renombrarlos temporalmente
const deduplicatedParty = activeParty.map((c, i) => {
  const count = activeParty.slice(0, i).filter(p => p.name === c.name).length;
  return count > 0 ? { ...c, name: `${c.name}_${i + 1}` } : c;
});
// ADVERTENCIA: esto cambia el nombre en el combate pero no en la DB
// Es un parche temporal — implementar FEAT-07 es la solución real
```

**Por qué este fix inmediato es insuficiente a largo plazo:** No resuelve el warning de React keys (el componente sigue usando nombre como key en otros lugares), y no resuelve el problema en otros contextos donde se usa el nombre como identificador (moral system, bounty events, etc.).

**Checklist:**
- [ ] `characterId` agregado a `CharacterSave` (FEAT-07)
- [ ] `LivePartyMember.characterId` propagado desde `initCombat`
- [ ] Log de combate usa `characterId` como tag identificador
- [ ] Todas las `key` en BattleScreen usan `characterId`
- [ ] Dos personajes con mismo nombre pueden morir independientemente
- [ ] No hay más warnings de "duplicate key" en consola

---

## BUG-01 🔴 — BattleScreen: solo 2 acciones en la barra de 4 slots

Ver solución completa en `GUIA_UI_FALTANTE.md` → UI-01.

### Checklist rápido
- [ ] Slot 3 conectado a `resolvePlayerDodge`, `resolvePlayerDash`, `resolvePlayerHelp`
- [ ] Modal picker de acciones tácticas funcional
- [ ] Slot 4 es placeholder ÍTEM (deshabilitado hasta FEAT-01)

---

## BUG-02 🔴 — MapScreen: "Volver a la villa" en salas incorrectas

### Root cause
```typescript
// MapScreen.tsx ~línea 638 — condición incorrecta
{selectedRoom.visited && (
  selectedRoom.type === 'START' || selectedRoom.type === 'TREASURE' || selectedRoom.type === 'SECRET'
) && ( ... )}
```

### Fix
```typescript
// Solo START tiene el botón de retorno
{selectedRoom.visited && selectedRoom.type === 'START' && ( ... )}
```

**Checklist:**
- [ ] Botón solo aparece en `type === 'START'`
- [ ] TREASURE/SECRET/EVENT visitadas NO muestran el botón

---

## BUG-03 🟠 — ReportScreen: clase de personaje muestra key i18n cruda

### Root cause
```typescript
t(`party.class_${c.charClass}`)  // genera 'party.class_paladin' — key en lowercase
// Las translation keys son 'class_PALADIN' — uppercase
```

### Fix
```typescript
t(`party.class_${c.charClass.toUpperCase()}`) // genera 'party.class_PALADIN' ✅
```

Aplicar en: `ReportScreen.tsx`, `BattleScreen.tsx`, `CharacterDetailScreen.tsx`.  
Completar el diccionario en `es.ts` y `en.ts` con las 12 clases DnD (ver FEAT-04).

---

## BUG-04 & BUG-05 🔴 — App cerrada durante combate = combate auto-ganado

### Root cause
`MapScreen.handleEnterRoom` marcaba `visited: true` en la sala **antes** de navegar a Battle. Si la app se cerraba, al reabrir la sala ya estaba visitada (= combate completado).

### Estado actual del fix (parcialmente implementado)
El código ya tiene la lógica de `combatRoomId`:
```typescript
// MapScreen.tsx — handleEnterRoom
updateProgress({
  combatRoomId: String(room.id),   // ✅ ya existe
  combatRoomType: room.type,       // ✅ ya existe
});
```

### Verificar que estos pasos están completos

**Paso 1** — Confirmar que `SavedGame` tiene `combatRoomId`:
```typescript
// gameRepository.ts — verificar que el campo existe
combatRoomId:   (row.combat_room_id as string | null) ?? null,
combatRoomType: (row.combat_room_type as string | null) ?? null,
```

**Paso 2** — Confirmar migration 16 aplicada:
```typescript
// migrations.ts
// Verificar CURRENT_VERSION >= 16
// Verificar que la migration 16 agrega combat_room_id y combat_room_type
```

**Paso 3** — Confirmar que BattleScreen limpia `combatRoomId` al terminar

```typescript
// BattleScreen.tsx — en el useEffect de cs.outcome
useEffect(() => {
  if (!cs.outcome) return;
  // Limpiar el combate activo independientemente del resultado
  updateProgress({
    combatRoomId: null,
    combatRoomType: null,
    // + marcar sala visited:true si VICTORY
  });
}, [cs.outcome]);
```

**Paso 4** — Confirmar routing de recuperación en MainScreen

```typescript
// MainScreen.tsx — en handleMenuPress 'continue'
if (activeGame?.combatRoomId !== null && activeGame?.combatRoomId !== undefined) {
  navigation.reset({
    index: 0,
    routes: [{ name: 'Battle', params: { roomId: activeGame.combatRoomId, roomType: activeGame.combatRoomType ?? 'NORMAL' } }]
  });
  return;
}
```

**Checklist:**
- [ ] Migration 16 con `combat_room_id` y `combat_room_type` existe
- [ ] `rowToSavedGame` mapea los campos
- [ ] `handleEnterRoom` NO marca `visited:true` antes del combate
- [ ] BattleScreen limpia `combatRoomId` en victoria y derrota
- [ ] BattleScreen marca `visited:true` solo en victoria
- [ ] MainScreen detecta `combatRoomId` al reanudar y navega a Battle

---

## BUG-06 🟠 — BattleScreen: animación de derrota descentrada

Ver fix completo en `GUIA_UI_FALTANTE.md` → UI-06.

**Fix de 2 líneas:**
```typescript
defeatOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(0,0,0,0.72)',
  zIndex: 10,
  alignItems: 'center',    // ← añadir
  justifyContent: 'center', // ← añadir
},
```

---

## BUG-07 🔴 — ExtractionScreen: datos mockeados

Ver solución completa en `GUIA_COMPLETAR_PROYECTO.md` → FEAT-01.

---

## BUG-08 🔴 — VillageScreen: edificios sin funcionalidad

Ver soluciones en:
- Armería: `GUIA_UI_FALTANTE.md` → UI-05
- Posada: `GUIA_COMPLETAR_PROYECTO.md` → FEAT-03
- Mercado/Herrería: `GUIA_COMPLETAR_PROYECTO.md` → FEAT-02

---

## BUG-10 🔴 — MapScreen: sin scroll horizontal en Android

Ver solución completa en `GUIA_UI_FALTANTE.md` → UI-07.

### Resumen del fix

```typescript
// MapScreen.tsx — envolver contenido en ScrollView horizontal anidado
<ScrollView style={styles.mapScroll} showsVerticalScrollIndicator={false}>
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={{ width: CANVAS_W, height: CANVAS_H }}
  >
    {/* contenido del mapa */}
  </ScrollView>
</ScrollView>
```

**Por qué en iOS no se nota:** iOS tiene `bouncesZoom` que permite simular algo de panning horizontal dentro del zoom, pero no es verdadero scroll bidireccional. En Android, el ScrollView sin `horizontal` simplemente ignora el eje X.

---

## BUG-11 🔴 — MapScreen: salas EVENT sin resolución

### Descripción
Cuando el jugador entra a una sala `EVENT`, solo se marca como visitada. No hay ninguna resolución de evento — ni narrativa, ni mecánica. El jugador no recibe consecuencias (ni positivas ni negativas).

### Root cause
```typescript
// MapScreen.tsx — handleEnterRoom — rama non-combat
// EVENT cae aquí junto con TREASURE (que sí da ítems) y SECRET
// Pero no hay navegación específica para EVENT
const afterReveal = revealAdjacentRooms(afterVisit, room.id);
setFloor(afterReveal);
updateProgress({ location: 'map', mapState: JSON.stringify(savedState) });
// ← la app regresa al mapa sin que haya pasado nada
```

### Fix
Crear `EventResolutionScreen` y navegar a ella desde `handleEnterRoom` para salas `EVENT`.

Ver solución completa en `GUIA_COMPLETAR_PROYECTO.md` → FEAT-09.

**Impacto de no corregir:** El 100% de las salas EVENT son salas vacías. El mapa pierde variedad y el jugador no siente consecuencias de explorar estas salas. Esto es un gap importante en la experiencia de juego.

---

## Orden de resolución recomendado

```
PRIORIDAD 1 — Bugs que rompen mecánicas centrales
  BUG-09 (UUID / muerte doble)         — implementar FEAT-07 completo
  BUG-04/05 (combate pendiente)        — verificar implementación existente
  BUG-10 (scroll Android)              — ScrollView anidado (30 min)

PRIORIDAD 2 — Bugs de UX críticos
  BUG-11 (salas EVENT sin resolución)  — requiere pantalla nueva
  BUG-01 (slots vacíos en combate)     — conectar resolvers existentes
  BUG-02 (botón retorno incorrecto)    — 1 línea de código

PRIORIDAD 3 — Bugs de presentación
  BUG-03 (i18n clases)                 — buscar y reemplazar
  BUG-06 (animación derrota)           — 2 líneas de CSS
  BUG-07/08 (mocks/edificios)          — requieren features nuevas
```
