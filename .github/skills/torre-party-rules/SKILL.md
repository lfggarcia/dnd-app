---
name: torre-party-rules
description: TORRE party creation and player progression rules — DnD 5e character creation, party limits, level inheritance, adventurer pool, death/revival, season reset. Use when working on party creation UI, character management, player progression, or session/season reset logic. Keywords: party, character, player, DnD 5e, creation, nivel, progresión, muerte, revival, temporada.
argument-hint: [feature: "create party" | "level inherit" | "character death" | "season reset" | "adventurer pool"]
---

# TORRE — Creación de Parties y Reglas del Jugador

---

## Creación del Partido Inicial

El jugador crea su party desde cero usando reglas **oficiales DnD 5e**:
- Selecciona: raza, clase, trasfondo, habilidades.
- No elige personajes preexistentes.
- La construcción es libre pero sujeta a reglas estructurales.

### Stats — DnD 5e Standard Array
```typescript
// Valores base para distribución estándar
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const STATS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
```

---

## Límites de Parties del Jugador

| Regla | Valor |
|---|---|
| Máx. parties activas creadas por el jugador | **2 por seed** |
| Si crea una 3ra | Elimina permanentemente la party IA derivada más débil |

---

## Herencia de Nivel

Al crear una nueva party el jugador:
```typescript
// Nivel máximo inicial de la nueva party
newPartyMaxLevel = Math.floor(previousParty.averageLevel);
// No puede superar el nivel promedio de la party anterior
```

**Propósito:** Evitar reinicios para obtener ventaja injusta.

---

## Pool de Aventureros Exclusivo

Si un personaje abandona la party por **conflicto moral**:
- Se genera un aventurero nuevo (mismo nivel base).
- **No editable** inicialmente — solo mejora jugando.
- Pertenece exclusivamente al pool del jugador en esa seed.

---

## Progresión del Jugador

El jugador gana XP de:
- Monstruos.
- Jefes.
- Eventos.
- Exploración de pisos altos.

### Anti-Abuso
- ❌ No se gana XP por matar otras parties.
- ❌ No se gana ventaja por repetir monstruos (XP × 0.5 si ya fue derrotado).
- ❌ Sin XP si diferencia de nivel > 5.

---

## Acciones por Ciclo

En cada ciclo el jugador puede:
- Explorar.
- Descansar (avanza ciclo).
- Avanzar piso.
- Negociar alianzas.
- Atacar otras parties.
- Defenderse.

Cada acción consume tiempo y recursos.

---

## Muerte de la Party del Jugador

1. Termina el ciclo actual.
2. Puede revivir en el pueblo **si tiene fondos** (ver `torre-economy`).
3. Si no puede pagar → **muerte permanente** del personaje.
4. La seed **no se pierde** automáticamente.

---

## Reinicio entre Temporadas

Cuando la torre se cierra (ciclo 60):
1. El jugador puede crear una nueva party.
2. La nueva party hereda nivel máximo limitado (herencia de nivel).
3. Las parties anteriores del jugador pueden convertirse en **parties IA**.

---

## Modelo de Datos — Personaje

```typescript
interface Character {
  id: string;
  partyId: string;
  name: string;
  race: string;
  class: string;
  level: number;
  xp: number;
  stats: {
    STR: number; DEX: number; CON: number;
    INT: number; WIS: number; CHA: number;
  };
  alignment: string;
  morale: number;    // 0-100, afecta decisión de abandono
  isAlive: boolean;
  deathCount: number;
}
```

---

## Archivos Relacionados

| Archivo | Propósito |
|---|---|
| `src/screens/CharacterCreationScreen.tsx` | UI de creación de personajes |
| `src/screens/PartyScreen.tsx` | Gestión de party activa |
| `src/services/characterStats.ts` | Cálculo de stats y modificadores |
| `src/constants/dnd5eLevel1.ts` | Datos base nivel 1 |
| `src/stores/gameStore.ts` | Estado global de party del jugador |
| `src/database/gameRepository.ts` | Persistencia de personajes |

---

## Filosofía de Diseño

El sistema recompensa **conocimiento profundo**:
- Gestión eficiente de riesgo.
- Builds optimizadas.
- Adaptación al meta actual de la seed.

No hay camino fácil — el tiempo y los recursos son siempre escasos.
