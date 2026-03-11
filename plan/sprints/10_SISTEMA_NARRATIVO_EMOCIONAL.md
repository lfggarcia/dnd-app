# 10 · SISTEMA NARRATIVO EMOCIONAL
> **Estado actual:** ~8% — `expressionsJson` existe en DB (schema v6), `BattleScreen` lee el mapa pero la selección de expresión está hardcodeada en la línea 536: `exprs?.['aggressive'] ?? exprs?.['angry'] ?? exprs?.['neutral']`. Todo lo demás está por construir.
> **Sprint objetivo:** 4C — después de completar Sprint 4B (combate DnD 5e ya hecho), antes del Sprint 5
> **Impacto en sistemas existentes:** cero cambios breaking — todo es aditivo (ver sección Compatibilidad)

---

## Qué existe hoy y qué falta

### Lo que ya está

| Pieza | Dónde | Estado |
|-------|-------|--------|
| 22 variantes de expresión por personaje | `scripts/generate-expressions.js` | ✅ Pipeline completo |
| `expressions_json` en DB | `migrations.ts` migration v6 | ✅ Columna en `saved_games` |
| `expressionsJson: Record<string, Record<string, string>>` | `gameRepository.ts` | ✅ Tipado y parseado |
| Lectura en BattleScreen | `BattleScreen.tsx` línea 405 + 535 | ✅ Lee el mapa |
| Selección de expresión | `BattleScreen.tsx` línea 536 | ❌ Hardcodeada a `angry/neutral` |
| Lógica de qué expresión mostrar cuándo | — | ❌ No existe |
| Panel de texto narrativo en combate | — | ❌ No existe |

### Las 22 expresiones (fuente de verdad)

Son exactamente los keys de `EXPRESSION_PRESETS` en `scripts/generate-expressions.js`. No son negociables: son las que se generaron y las que están guardadas en `expressionsJson`.

```typescript
// src/services/emotionalNarrativeService.ts

export type ExpressionKey =
  | 'neutral'      // estado base — sin emoción activa
  | 'angry'        // enfado moderado
  | 'confident'    // seguridad, control de la situación
  | 'confused'     // desorientación, fumble propio
  | 'despondent'   // abatimiento
  | 'determined'   // resolución activa
  | 'disgusted'    // asco o rechazo — undead, PvP
  | 'fearful'      // miedo real
  | 'fierce'       // combatividad intensa
  | 'flirty'       // descaro (rogue, bard en ventaja)
  | 'happy'        // alegría activa
  | 'hollow'       // vacío post-pérdida
  | 'incredulous'  // "¿cómo ha podido pasar?"
  | 'rage'         // furia máxima
  | 'sad'          // tristeza
  | 'sarcastic'    // cinismo bajo presión
  | 'seductive'    // control calculado (warlock, rogue)
  | 'serious'      // gravedad
  | 'shocked'      // impacto súbito
  | 'surprised'    // sorpresa menor
  | 'tired'        // agotamiento extremo
  | 'triumph';     // victoria épica
```

---

## Compatibilidad con sistemas existentes

Este sistema es **puramente aditivo**. No modifica ningún contrato existente:

| Sistema existente | Cambio | Tipo |
|-------------------|--------|------|
| `CombatResult` (combatEngine) | Añadir campo `events?: CombatEvent[]` | Opcional — nada que lee `CombatResult` se rompe |
| `Battle` params (navigation/types.ts) | Añadir `ambushSide?`, `emotionTriggers?` | Opcionales — `BattleScreen` ya hace `const { roomId, roomType } = route.params` y TypeScript no requiere los nuevos campos |
| `getPartyPortrait()` (BattleScreen) | Reemplazar la función local | Interna — no se exporta, no la usa nadie externo |
| `CLASS_ABILITIES` (combatEngine) | Leer en el nuevo servicio | Solo lectura — nunca se modifica |
| `DungeonRoom` (dungeonGraphService) | Añadir `hiddenConnections?: number[]` | Opcional — el `map_state` serializado existente no lo tiene y se inicializa vacío |
| `expressionsJson` (gameRepository) | Sin cambios | Se lee igual que hoy |

---

## Arquitectura del sistema

```
CAPA 1 — Eventos (combatEngine.ts)
  Emite CombatEvent[] tipados junto al log[] existente

CAPA 2 — Resolución (emotionalNarrativeService.ts)
  CombatEvent + CharacterSave → EmotionState por personaje

CAPA 3 — Presentación (BattleScreen.tsx)
  EmotionState → qué portrait mostrar + NarrativeMomentPanel

CAPA 4 — Efectos (abilityModulationService.ts)  [opcional, Sprint 5]
  EmotionState → qué habilidades están disponibles o bloqueadas
```

El flujo dentro del combate por turnos (`LiveCombatState` + `UIPhase`):

```
Cada vez que uiPhase cambia a 'PLAYER_ACTION' o 'ENEMY_AUTO':
  ↓
  combatEngine resuelve el turno → emite CombatEvent[]
  ↓
  emotionalNarrativeService.resolveEmotion() por cada personaje afectado
  ↓
  setPartyEmotions(updatedState)
  ↓
  getPartyPortrait(idx) usa emotion.expression en lugar de 'angry/neutral'
  ↓
  Si isSignificantEvent(event.type): mostrar NarrativeMomentPanel
```

---

## Paso 1 — Añadir CombatEvent[] a combatEngine.ts

`CombatResult` ya tiene `log: string[]`. Añadimos `events?: CombatEvent[]` de forma opcional — nada que consume `CombatResult` necesita cambiar.

```typescript
// src/services/combatEngine.ts — AÑADIR al bloque de tipos públicos

export type CombatEventType =
  | 'ALLY_DOWN'              // un miembro de la party llegó a 0 HP
  | 'CRIT_DEALT'             // la party hizo un golpe crítico (nat 20)
  | 'CRIT_RECEIVED'          // un enemigo hizo un golpe crítico a la party
  | 'NAT_ONE'                // fumble propio (nat 1)
  | 'LOW_HEALTH'             // HP de un miembro < 25%
  | 'VERY_LOW_HEALTH'        // HP < 10% — supervivencia crítica
  | 'ABILITY_USED'           // habilidad de clase activada
  | 'ENEMY_DEFEATED'         // un enemigo fue derrotado
  | 'BOSS_DEFEATED'          // el boss cayó (roomType === 'BOSS')
  | 'VICTORY'                // combate terminado — victoria
  | 'DEFEAT';                // combate terminado — derrota

export type CombatEvent = {
  type: CombatEventType;
  actorName: string;         // quién hizo/sufrió la acción
  targetName?: string;       // sobre quién (si aplica)
  value?: number;            // daño, curación, etc.
  turn: number;              // número de turno del combate
};

// Actualizar CombatResult — campo opcional, no breaking:
export type CombatResult = {
  outcome: 'VICTORY' | 'DEFEAT';
  roundsElapsed: number;
  partyAfter: CombatPartyMember[];
  enemiesDefeated: CombatEnemy[];
  totalXp: number;
  goldEarned: number;
  damageDone: Record<string, number>;
  log: string[];
  events?: CombatEvent[];    // ← NUEVO, opcional
};
```

### Emitir eventos en `buildCombatResultFromLive`

`buildCombatResultFromLive` ya tiene acceso al `LiveCombatState` final. Derivar los eventos del estado final es más limpio que instrumentar el loop:

```typescript
// src/services/combatEngine.ts — dentro de buildCombatResultFromLive

export function buildCombatResultFromLive(
  state: LiveCombatState,
  killRecords: KillRecord[],
  rng: RNG,
): CombatResult {
  // ...código existente sin cambios...

  // ── NUEVO: derivar eventos del estado final ──────────────
  const events: CombatEvent[] = [];

  // Miembros caídos
  state.partyState
    .filter(m => m.currentHp <= 0 && m.hpBefore > 0)
    .forEach(m => events.push({ type: 'ALLY_DOWN', actorName: m.name, turn: state.round }));

  // HP crítico
  state.partyState
    .filter(m => m.currentHp > 0)
    .forEach(m => {
      const pct = m.currentHp / m.maxHp;
      if (pct < 0.10) events.push({ type: 'VERY_LOW_HEALTH', actorName: m.name, value: Math.round(pct * 100), turn: state.round });
      else if (pct < 0.25) events.push({ type: 'LOW_HEALTH', actorName: m.name, value: Math.round(pct * 100), turn: state.round });
    });

  // Crits: el log ya los marca con 'CRIT!' — parsear el log para extraerlos
  state.log.forEach((line, i) => {
    if (line.includes('CRIT!')) {
      // Determinar si fue la party o el enemigo leyendo el contexto del log
      const isPartyAttack = state.partyState.some(m => line.startsWith(`  ${m.name.toUpperCase()}`));
      const actorName = state.partyState.find(m => line.startsWith(`  ${m.name.toUpperCase()}`))?.name
        ?? state.enemyState.find(e => line.startsWith(`  ${e.displayName.toUpperCase().replace(/ /g, '_')}`))?.displayName
        ?? 'unknown';
      events.push({
        type: isPartyAttack ? 'CRIT_DEALT' : 'CRIT_RECEIVED',
        actorName,
        turn: Math.floor(i / (state.turnOrder.length || 1)) + 1,
      });
    }
    if (line.includes('nat 1')) {
      const actorName = state.partyState.find(m => line.includes(m.name.toUpperCase()))?.name ?? 'unknown';
      events.push({ type: 'NAT_ONE', actorName, turn: state.round });
    }
  });

  // Habilidades usadas: el log las marca con nombre en mayúsculas (FURIA, MISIL_MAGICO, etc.)
  const ABILITY_MARKERS = ['FURIA', 'SEGUNDO_ALIENTO', 'GOLPE_DIVINO', 'MARCA_CAZADOR',
    'ATAQUE_FURTIVO', 'MISIL_MAGICO', 'PALABRA_CURATIVA', 'ENREDAR',
    'LLUVIA_GOLPES', 'INSPIRAR', 'ORBE_CROMATICO', 'EXPLOSION_OSCURA'];
  state.log.forEach(line => {
    const marker = ABILITY_MARKERS.find(m => line.includes(m));
    if (marker) {
      const actorName = state.partyState.find(m => line.includes(m.name.toUpperCase()))?.name ?? 'unknown';
      events.push({ type: 'ABILITY_USED', actorName, turn: state.round });
    }
  });

  // Victoria/derrota
  events.push({
    type: state.outcome === 'VICTORY' ? 'VICTORY' : 'DEFEAT',
    actorName: 'party',
    turn: state.round,
  });

  return {
    // ...campos existentes sin cambios...
    outcome: state.outcome ?? 'DEFEAT',
    roundsElapsed: state.round,
    partyAfter,
    enemiesDefeated: defeatedEnemies,
    totalXp,
    goldEarned,
    damageDone: state.damageDone,
    log: state.log,
    events,  // ← nuevo campo
  };
}
```

---

## Paso 2 — emotionalNarrativeService.ts

Crear `src/services/emotionalNarrativeService.ts`:

```typescript
/**
 * emotionalNarrativeService.ts
 *
 * Traduce CombatEvent[] → EmotionState por personaje.
 * Determina qué expresión de las 22 mostrar y genera texto narrativo.
 *
 * Las 22 expresiones son las únicas válidas — son exactamente
 * los keys de EXPRESSION_PRESETS en scripts/generate-expressions.js.
 */

import type { CombatEvent, CombatEventType } from './combatEngine';
import type { CharacterSave } from '../database/gameRepository';

// ─── Escalación por familias ──────────────────────────────
// Cada familia tiene 3 niveles de intensidad.
// El mismo tipo de evento repetido sube de nivel dentro de su familia.
// Un evento de otra familia reinicia la intensidad.

type EmotionFamily = 'COLERA' | 'MIEDO' | 'DUELO' | 'RESOLUCION' | 'CONTROL' | 'NEUTRO';

const FAMILY_ESCALATION: Record<EmotionFamily, [ExpressionKey, ExpressionKey, ExpressionKey]> = {
  //               nivel 1        nivel 2        nivel 3
  COLERA:     ['angry',       'fierce',      'rage'],
  MIEDO:      ['surprised',   'fearful',     'shocked'],
  DUELO:      ['sad',         'despondent',  'hollow'],
  RESOLUCION: ['determined',  'serious',     'triumph'],
  CONTROL:    ['confident',   'flirty',      'sarcastic'],
  NEUTRO:     ['neutral',     'neutral',     'neutral'],
};

// ─── Modificadores de combate por expresión ───────────────
// Opcionales en Sprint 4C — se activan en Sprint 5 junto al combatEngine

export type EmotionModifier = {
  damageMult?:   number;   // 1.20 = +20% daño
  defenseMult?:  number;   // 0.85 = -15% defensa
  accuracyMult?: number;   // 0.90 = -10% precisión
  critBonus?:    number;   // 0.08 = +8% probabilidad crítico
  evasionBonus?: number;   // 0.10 = +10% esquiva
};

const EXPRESSION_MODIFIERS: Record<ExpressionKey, EmotionModifier> = {
  neutral:     {},
  angry:       { damageMult: 1.10, defenseMult: 0.95 },
  fierce:      { damageMult: 1.20, defenseMult: 0.90 },
  rage:        { damageMult: 1.35, defenseMult: 0.75, accuracyMult: 0.90 },
  surprised:   { accuracyMult: 0.90 },
  fearful:     { accuracyMult: 0.85, evasionBonus: 0.08 },
  shocked:     { accuracyMult: 0.75, evasionBonus: 0.10 },
  sad:         { damageMult: 0.90, accuracyMult: 0.95 },
  despondent:  { damageMult: 0.80, defenseMult: 0.90 },
  hollow:      { damageMult: 0.70, defenseMult: 0.80, accuracyMult: 0.80 },
  determined:  { damageMult: 1.05, defenseMult: 1.10 },
  serious:     { damageMult: 1.08, defenseMult: 1.08 },
  triumph:     { damageMult: 1.25, accuracyMult: 1.15, critBonus: 0.10 },
  confident:   { accuracyMult: 1.10, critBonus: 0.05 },
  flirty:      { accuracyMult: 1.05, critBonus: 0.08 },
  sarcastic:   { accuracyMult: 1.08 },
  confused:    { accuracyMult: 0.85, damageMult: 0.90 },
  disgusted:   { damageMult: 1.05 },
  happy:       { damageMult: 1.05, accuracyMult: 1.05 },
  incredulous: { critBonus: 0.12 },
  seductive:   { accuracyMult: 1.12, critBonus: 0.06 },
  tired:       { damageMult: 0.80, accuracyMult: 0.85, defenseMult: 0.85 },
};

// ─── Estado emocional ─────────────────────────────────────

export type EmotionState = {
  expression:    ExpressionKey;
  family:        EmotionFamily;
  intensity:     1 | 2 | 3;
  durationTurns: number;
  sourceEvent:   CombatEventType;
  narrativeText: { narrator: string; dialogue: string };
  modifier:      EmotionModifier;
};

export type PartyEmotionalState = Record<string, EmotionState | null>;

// ─── Qué familia produce cada evento según clase ──────────

function resolveFamily(
  eventType: CombatEventType,
  charClass: string,
  currentFamily: EmotionFamily | null,
): EmotionFamily {
  // Clasificación por comportamiento en combate
  const aggressive = ['barbarian', 'fighter', 'paladin', 'ranger'];
  const empathetic  = ['cleric', 'bard', 'druid'];
  const calculated  = ['wizard', 'sorcerer', 'warlock'];
  const evasive     = ['rogue', 'monk'];

  switch (eventType) {
    case 'ALLY_DOWN':
      // El agresivo se enfurece, el empático se entristece, el resto se determina
      if (aggressive.includes(charClass)) return 'COLERA';
      if (empathetic.includes(charClass))  return 'DUELO';
      return 'RESOLUCION';

    case 'CRIT_DEALT':
    case 'ABILITY_USED':
      // El evasivo se vuelve controlado, el bárbaro se enfurece más, el resto se determina
      if (evasive.includes(charClass))    return 'CONTROL';
      if (charClass === 'barbarian')      return 'COLERA';
      return 'RESOLUCION';

    case 'CRIT_RECEIVED':
      // El calculado se asusta, el agresivo se enfurece
      if (calculated.includes(charClass)) return 'MIEDO';
      if (aggressive.includes(charClass)) return 'COLERA';
      return 'MIEDO';

    case 'LOW_HEALTH':
      // Si ya estaba en cólera → escala. Si no → resolución o miedo según clase
      if (currentFamily === 'COLERA')     return 'COLERA';
      if (aggressive.includes(charClass)) return 'RESOLUCION';
      return 'MIEDO';

    case 'VERY_LOW_HEALTH':
      // Último aliento → siempre resolución (personaje empuja más allá del límite)
      return 'RESOLUCION';

    case 'NAT_ONE':
      // Fumble — desorientación, sin familia
      return 'NEUTRO';

    case 'ENEMY_DEFEATED':
      // Victoria menor — control para el evasivo, resolución para el resto
      if (evasive.includes(charClass)) return 'CONTROL';
      return 'RESOLUCION';

    case 'BOSS_DEFEATED':
    case 'VICTORY':
      return 'RESOLUCION';  // siempre termina en resolución

    case 'DEFEAT':
      return 'DUELO';

    default:
      return 'NEUTRO';
  }
}

// ─── Función principal ────────────────────────────────────

export function resolveEmotion(
  event: CombatEvent,
  char: CharacterSave,
  currentState: EmotionState | null,
): EmotionState {
  const family = resolveFamily(event.type, char.charClass.toLowerCase(), currentState?.family ?? null);

  // Misma familia → escalar; distinta familia → reiniciar en 1
  const intensity: 1 | 2 | 3 =
    currentState?.family === family
      ? Math.min(3, currentState.intensity + 1) as 1 | 2 | 3
      : 1;

  // Expresiones que no siguen la escalación de familia:
  let expression: ExpressionKey;
  if (event.type === 'NAT_ONE')          expression = 'confused';
  else if (event.type === 'BOSS_DEFEATED') expression = 'triumph';
  else if (event.type === 'VICTORY' && intensity === 3) expression = 'triumph';
  else if (event.type === 'DEFEAT')      expression = 'hollow';
  else if (
    event.type === 'VERY_LOW_HEALTH' &&
    currentState?.expression === 'determined'
  )                                      expression = 'triumph'; // último aliento heroico
  else                                   expression = FAMILY_ESCALATION[family][intensity - 1];

  // Duración: más intensa → más dura
  const durationTurns = intensity === 3 ? 4 : intensity === 2 ? 3 : 2;

  return {
    expression,
    family,
    intensity,
    durationTurns,
    sourceEvent: event.type,
    narrativeText: buildNarrativeText(event.type, char.charClass.toLowerCase(), char.name),
    modifier: EXPRESSION_MODIFIERS[expression] ?? {},
  };
}

// ─── Decrementar duración al inicio de cada turno ─────────

export function tickEmotionDurations(state: PartyEmotionalState): PartyEmotionalState {
  const out: PartyEmotionalState = {};
  for (const [name, emotion] of Object.entries(state)) {
    if (!emotion) { out[name] = null; continue; }
    const d = emotion.durationTurns - 1;
    out[name] = d <= 0 ? null : { ...emotion, durationTurns: d };
  }
  return out;
}

// ─── Texto narrativo ──────────────────────────────────────
// Varía por tipo de evento + clase del personaje
// Las líneas son cortas y en primera persona para la UI compacta de BattleScreen

const NARRATIVE_POOLS: Partial<Record<CombatEventType, {
  narrator: string[];
  dialogue: Record<string, string[]>;
}>> = {
  ALLY_DOWN: {
    narrator: [
      'La caída de su compañero enciende algo que no tiene nombre.',
      'Ver caer a un aliado convierte el miedo en combustible.',
    ],
    dialogue: {
      barbarian: ['¡Por ti entro en FURIA!', '¡No les dejaré ganar!'],
      paladin:   ['¡Nadie más caerá mientras yo esté aquí!'],
      cleric:    ['Aguanta. Voy a por ti.'],
      rogue:     ['Bien. Ahora decido yo.'],
      wizard:    ['Recalculo la situación.'],
      bard:      ['¡Haré que valga la pena!'],
      default:   ['No puedo dejar que esto continúe.', '¡Voy por ellos!'],
    },
  },
  CRIT_DEALT: {
    narrator: [
      'El golpe perfecto convierte el instinto en arte.',
      'Un crítico que silencia hasta al viento.',
    ],
    dialogue: {
      barbarian: ['¡¡¡ESTO ES PODER!!!'],
      rogue:     ['Demasiado fácil.'],
      fighter:   ['Años de entrenamiento. Un segundo.'],
      paladin:   ['¡La luz guía mi hoja!'],
      default:   ['¡Sí!', '¡Ahora sí!'],
    },
  },
  CRIT_RECEIVED: {
    narrator: [
      'El golpe llega desde un ángulo que nadie anticipó.',
      'La defensa cede. El impacto resuena en los huesos.',
    ],
    dialogue: {
      barbarian: ['¡¿ESO FUE TODO?! ¡DAME MÁS!'],
      wizard:    ['"¡Mis cálculos de defensa fallaron!"'],
      cleric:    ['Que el dolor sea mi guía...'],
      default:   ['¡Eso duele!', '¡Aguanta!'],
    },
  },
  LOW_HEALTH: {
    narrator: [
      'Las fuerzas menguan pero la voluntad resiste.',
      'Al borde del colapso, algo cambia en sus ojos.',
    ],
    dialogue: {
      paladin:   ['No... todavía no. Tengo una misión.'],
      barbarian: ['Duele. Bien. El dolor me mantiene despierto.'],
      rogue:     ['Necesito salir de aquí. O no.'],
      default:   ['Aguanta...', '¿Sigo en pie? Bien.'],
    },
  },
  VERY_LOW_HEALTH: {
    narrator: ['Un hilo separa la vida de la oscuridad.'],
    dialogue: {
      default: ['Voy... a caer...', '¡No puedo rendirme ahora!', 'Uno más...'],
    },
  },
  BOSS_DEFEATED: {
    narrator: [
      'La criatura colosal cae — y con ella, un peso invisible.',
      'Imposible creerlo. Lo lograron.',
    ],
    dialogue: {
      barbarian: ['¡¡VICTORIA!! ¡¡SANGRE Y GLORIA!!'],
      paladin:   ['Justicia cumplida.'],
      bard:      ['¡Esto lo voy a contar muchísimas veces!'],
      rogue:     ['Sabía que lo haríamos.'],
      default:   ['¡Lo hicimos!', '¡No me lo puedo creer!'],
    },
  },
  NAT_ONE: {
    narrator: ['El gesto sale completamente mal. Un silencio incómodo.'],
    dialogue: { default: ['¿Qué...?', '¡Eso no debería haber pasado!'] },
  },
  VICTORY: {
    narrator: ['El silencio tras la batalla es el sonido de la victoria.'],
    dialogue: { default: ['Terminó.', 'Estamos vivos.'] },
  },
  DEFEAT: {
    narrator: ['Las sombras reclaman a la party.'],
    dialogue: { default: ['Lo siento...', 'No pudo ser...'] },
  },
};

function buildNarrativeText(
  eventType: CombatEventType,
  charClass: string,
  charName: string,
): { narrator: string; dialogue: string } {
  const pool = NARRATIVE_POOLS[eventType];
  if (!pool) return { narrator: '', dialogue: '' };

  // PRNG determinístico: mismo personaje + mismo evento → misma línea (consistencia de replay)
  let h = 5381;
  const seed = `narrative_${charName}_${eventType}`;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 33) ^ seed.charCodeAt(i)) >>> 0;
  let s = h >>> 0;
  const pick = <T>(arr: T[]): T => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return arr[Math.floor((s / 0x100000000) * arr.length)];
  };

  const lines = pool.dialogue[charClass] ?? pool.dialogue['default'] ?? ['...'];
  return {
    narrator: pick(pool.narrator),
    dialogue: `${charName}: "${pick(lines)}"`,
  };
}

// ─── Helpers para BattleScreen ────────────────────────────

/** Eventos que abren el NarrativeMomentPanel (los más dramáticos) */
export function isSignificantEvent(type: CombatEventType): boolean {
  return ['ALLY_DOWN', 'BOSS_DEFEATED', 'VERY_LOW_HEALTH', 'CRIT_DEALT'].includes(type);
}

/** Aplicar modificador emocional al daño — llamar desde combatEngine (Sprint 5) */
export function applyEmotionToDamage(baseDamage: number, emotion: EmotionState | null): number {
  if (!emotion) return baseDamage;
  return Math.round(baseDamage * (emotion.modifier.damageMult ?? 1.0));
}
```

---

## Paso 3 — NarrativeMomentPanel.tsx

El panel aparece sobre el combate durante ~3 segundos en eventos significativos. Es compacto para no bloquear la vista del mapa de combate.

```typescript
// src/components/NarrativeMomentPanel.tsx

import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated } from 'react-native';
import type { EmotionState } from '../services/emotionalNarrativeService';

// Colores de acento por familia — coherentes con la paleta CRT del juego
const FAMILY_ACCENT: Record<string, string> = {
  COLERA:     '#FF3E3E',  // rojo
  MIEDO:      '#B266FF',  // violeta
  DUELO:      '#4DBBFF',  // azul frío
  RESOLUCION: '#00FF41',  // verde terminal (color principal del juego)
  CONTROL:    '#FFB000',  // ámbar
  NEUTRO:     'rgba(255,255,255,0.4)',
};

type Props = {
  charName:   string;
  emotion:    EmotionState;
  portraitUri: string | null;  // ya la URL del portrait con la expresión correcta
  onDismiss:  () => void;
};

export const NarrativeMomentPanel = ({ charName, emotion, portraitUri, onDismiss }: Props) => {
  const slide = useRef(new Animated.Value(120)).current;
  const color = FAMILY_ACCENT[emotion.family] ?? '#00FF41';

  useEffect(() => {
    Animated.spring(slide, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={{
      position: 'absolute',
      bottom: 160,  // encima del panel de acciones de BattleScreen
      left: 16, right: 16,
      transform: [{ translateY: slide }],
      backgroundColor: '#0A0E0A',
      borderWidth: 1,
      borderColor: color,
      padding: 12,
      zIndex: 100,
    }}>
      {/* Fila superior: portrait + nombre + dots de intensidad */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        {portraitUri && (
          <Image
            source={{ uri: portraitUri }}
            style={{ width: 48, height: 48, borderWidth: 1, borderColor: color, marginRight: 10 }}
          />
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'RobotoMono-Bold', color, fontSize: 11 }}>
            {charName.toUpperCase()}
          </Text>
          <Text style={{ fontFamily: 'RobotoMono-Regular', color: 'rgba(255,255,255,0.5)', fontSize: 9 }}>
            {emotion.expression.toUpperCase()} · {emotion.durationTurns} TURNOS
          </Text>
        </View>
        {/* Indicador de intensidad 1-3 */}
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[1, 2, 3].map(i => (
            <View key={i} style={{
              width: 7, height: 7, borderRadius: 4,
              backgroundColor: i <= emotion.intensity ? color : 'rgba(255,255,255,0.12)',
            }} />
          ))}
        </View>
      </View>

      {/* Texto del narrador */}
      {emotion.narrativeText.narrator !== '' && (
        <Text style={{
          fontFamily: 'RobotoMono-Regular',
          color: 'rgba(255,255,255,0.6)',
          fontSize: 10, fontStyle: 'italic', marginBottom: 4,
        }}>
          {emotion.narrativeText.narrator}
        </Text>
      )}

      {/* Diálogo del personaje */}
      {emotion.narrativeText.dialogue !== '' && (
        <Text style={{ fontFamily: 'RobotoMono-Bold', color, fontSize: 10 }}>
          {emotion.narrativeText.dialogue}
        </Text>
      )}

      {/* Preview del efecto activo */}
      <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {emotion.modifier.damageMult && emotion.modifier.damageMult !== 1 && (
          <Text style={{ fontFamily: 'RobotoMono-Regular', color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>
            DMG {emotion.modifier.damageMult > 1 ? '+' : ''}{Math.round((emotion.modifier.damageMult - 1) * 100)}%
          </Text>
        )}
        {emotion.modifier.accuracyMult && emotion.modifier.accuracyMult !== 1 && (
          <Text style={{ fontFamily: 'RobotoMono-Regular', color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>
            ACC {emotion.modifier.accuracyMult > 1 ? '+' : ''}{Math.round((emotion.modifier.accuracyMult - 1) * 100)}%
          </Text>
        )}
        {emotion.modifier.critBonus && (
          <Text style={{ fontFamily: 'RobotoMono-Regular', color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>
            CRIT +{Math.round(emotion.modifier.critBonus * 100)}%
          </Text>
        )}
      </View>
    </Animated.View>
  );
};
```

---

## Paso 4 — Integrar en BattleScreen.tsx

Los cambios son todos **dentro del componente** — ningún contrato hacia fuera cambia.

```typescript
// src/screens/BattleScreen.tsx

// ── Importaciones nuevas ──────────────────────────────────
import {
  resolveEmotion,
  tickEmotionDurations,
  isSignificantEvent,
  type PartyEmotionalState,
  type EmotionState,
} from '../services/emotionalNarrativeService';
import { NarrativeMomentPanel } from '../components/NarrativeMomentPanel';

// ── Estado nuevo (añadir junto a los useState existentes) ──
const [partyEmotions, setPartyEmotions] = useState<PartyEmotionalState>({});
const [activeMoment, setActiveMoment]   = useState<{
  charName: string;
  emotion:  EmotionState;
} | null>(null);

// ── Tick de duración al cambiar de turno ──────────────────
// Se activa cuando cambia cs.currentTurnIdx (ya existe el estado cs)
useEffect(() => {
  if (cs.currentTurnIdx > 0) {
    setPartyEmotions(prev => tickEmotionDurations(prev));
  }
}, [cs.currentTurnIdx]);

// ── Procesar eventos después de cada turno ────────────────
// Se llama desde los handlers existentes (handleAttack, handleAbility)
// después de que setCs recibe el nuevo estado

const processEmotionEvents = useCallback((events: CombatEvent[]) => {
  for (const event of events) {
    // Encontrar el personaje afectado en la party
    const char = partyData.find(c =>
      c.name === event.actorName || c.name === event.targetName
    );
    if (!char) continue;

    const current = partyEmotions[char.name] ?? null;
    const newEmotion = resolveEmotion(event, char, current);

    setPartyEmotions(prev => ({ ...prev, [char.name]: newEmotion }));

    // Mostrar panel si es un evento significativo
    if (isSignificantEvent(event.type)) {
      setActiveMoment({ charName: char.name, emotion: newEmotion });
    }
  }
}, [partyData, partyEmotions]);

// ── Reemplazar getPartyPortrait (línea 534-538) ───────────
// ANTES:
//   return exprs?.['aggressive'] ?? exprs?.['angry'] ?? exprs?.['neutral']
//     ?? portraitsMap?.[String(idx)] ?? null;
//
// AHORA:
const getPartyPortrait = useCallback((idx: number): string | null => {
  const char = partyData[idx];
  if (!char) return null;
  const exprs = expressionsJson[idx];
  if (!exprs) return portraitsMap?.[String(idx)] ?? null;

  // Usar la expresión activa del personaje; fallback a neutral; fallback al portrait base
  const expressionKey = partyEmotions[char.name]?.expression ?? 'neutral';
  return exprs[expressionKey] ?? exprs['neutral'] ?? portraitsMap?.[String(idx)] ?? null;
}, [partyData, expressionsJson, portraitsMap, partyEmotions]);

// ── En el return: añadir el panel (después del existing combat UI) ──
{activeMoment && (() => {
  const charIdx = partyData.findIndex(c => c.name === activeMoment.charName);
  const exprs = expressionsJson[charIdx];
  const uri = exprs?.[activeMoment.emotion.expression] ?? exprs?.['neutral'] ?? null;
  return (
    <NarrativeMomentPanel
      charName={activeMoment.charName}
      emotion={activeMoment.emotion}
      portraitUri={uri}
      onDismiss={() => setActiveMoment(null)}
    />
  );
})()}
```

### Dónde llamar `processEmotionEvents`

`BattleScreen` usa `buildCombatResultFromLive` cuando el combate termina. Para los eventos turno a turno, el mejor lugar es después de `resolvePlayerAttack` / `resolveEnemyTurn`:

```typescript
// En handleAttack (ya existente) — añadir al final:
const newCs = resolvePlayerAttack(cs, targetIdx, rngRef.current);
setCs(newCs);
// Derivar eventos del cambio de estado
if (newCs.log.length > cs.log.length) {
  const newLines = newCs.log.slice(cs.log.length);
  const events = deriveEventsFromLogLines(newLines, newCs, cs.round);
  processEmotionEvents(events);
}

// Función helper (añadir al archivo):
function deriveEventsFromLogLines(
  newLines: string[],
  state: LiveCombatState,
  turn: number,
): CombatEvent[] {
  const events: CombatEvent[] = [];
  for (const line of newLines) {
    if (line.includes('CRIT!')) {
      const isParty = state.partyState.some(m => line.startsWith(`  ${m.name.toUpperCase()}`));
      const actor = state.partyState.find(m => line.startsWith(`  ${m.name.toUpperCase()}`))?.name ?? '';
      events.push({ type: isParty ? 'CRIT_DEALT' : 'CRIT_RECEIVED', actorName: actor, turn });
    }
    if (line.includes('CAÍDO') || line.includes('CAIDA')) {
      const victim = state.partyState.find(m => line.includes(m.name.toUpperCase()) && m.currentHp <= 0);
      if (victim) events.push({ type: 'ALLY_DOWN', actorName: victim.name, turn });
    }
    // ... más parsers según el formato del log actual
  }
  return events;
}
```

---

## Paso 5 — Modulación de habilidades (Sprint 5, opcional)

Este paso es deliberadamente el último porque los pasos 1-4 ya entregan valor completo (portrait dinámico + panel narrativo). Los modificadores de stats y el bloqueo de habilidades se añaden en Sprint 5 sin modificar lo construido en Sprint 4C.

```typescript
// src/services/abilityModulationService.ts (crear en Sprint 5)

import type { ExpressionKey, EmotionState } from './emotionalNarrativeService';

// Habilidades adicionales que se desbloquean con ciertas expresiones
export type EmotionalAbility = {
  id:          string;
  name:        string;
  description: string;
  targetType:  'enemy' | 'ally' | 'self' | 'none';
  requiredExpressions: ExpressionKey[];
};

export const EMOTIONAL_ABILITIES: EmotionalAbility[] = [
  {
    id: 'brutal_strike',
    name: 'GOLPE_BRUTAL',
    description: 'Ignora 2 de CA del enemigo.',
    targetType: 'enemy',
    requiredExpressions: ['angry', 'fierce', 'rage'],
  },
  {
    id: 'evasive_roll',
    name: 'ESQUIVA_EVASIVA',
    description: '+20% esquiva este turno.',
    targetType: 'self',
    requiredExpressions: ['fearful', 'shocked'],
  },
  {
    id: 'last_stand',
    name: 'ÚLTIMO_BASTIÓN',
    description: 'Si HP < 10%, daño ×2 este turno.',
    targetType: 'enemy',
    requiredExpressions: ['determined', 'serious'],
  },
  {
    id: 'exploit_weakness',
    name: 'EXPLOTAR_DEBILIDAD',
    description: 'Próximo ataque siempre crítico.',
    targetType: 'enemy',
    requiredExpressions: ['confident', 'flirty', 'sarcastic', 'seductive'],
  },
];

// Habilidades de clase bloqueadas según expresión
const EXPRESSION_RESTRICTIONS: Partial<Record<ExpressionKey, string[]>> = {
  rage:    ['PALABRA_CURATIVA', 'INSPIRAR', 'SEGUNDO_ALIENTO'],
  fearful: ['MISIL_MAGICO', 'ENREDAR'],
  shocked: ['MISIL_MAGICO', 'ENREDAR', 'GOLPE_DIVINO'],
  hollow:  ['*'],  // bloquea todas
  tired:   ['LLUVIA_GOLPES', 'ORBE_CROMATICO'],
};

export function isClassAbilityBlocked(
  abilityName: string,
  emotion: EmotionState | null,
): boolean {
  if (!emotion) return false;
  const restrictions = EXPRESSION_RESTRICTIONS[emotion.expression];
  if (!restrictions) return false;
  if (restrictions.includes('*')) return true;
  return restrictions.includes(abilityName);
}

export function getUnlockedEmotionalAbilities(emotion: EmotionState | null): EmotionalAbility[] {
  if (!emotion) return [];
  return EMOTIONAL_ABILITIES.filter(a => a.requiredExpressions.includes(emotion.expression));
}
```

---

## Checklist de implementación (en orden)

- [ ] **Paso 1:** Añadir `CombatEventType`, `CombatEvent` y campo `events?: CombatEvent[]` a `CombatResult` en `combatEngine.ts`
- [ ] **Paso 1:** Completar `buildCombatResultFromLive` para derivar eventos del estado final
- [ ] **Paso 2:** Crear `src/services/emotionalNarrativeService.ts`
- [ ] **Paso 3:** Crear `src/components/NarrativeMomentPanel.tsx`
- [ ] **Paso 4:** Reemplazar `getPartyPortrait` en `BattleScreen.tsx` (línea 534-538)
- [ ] **Paso 4:** Añadir `partyEmotions`, `activeMoment` y `processEmotionEvents` a `BattleScreen.tsx`
- [ ] **Paso 4:** Renderizar `NarrativeMomentPanel` cuando `activeMoment !== null`
- [ ] Añadir i18n keys para textos narrativos (ES/EN) si se quiere bilingüe
- [ ] Ampliar `NARRATIVE_POOLS` con más líneas de diálogo por clase
- [ ] **(Sprint 5)** Crear `src/services/abilityModulationService.ts` (Paso 5)
- [ ] **(Sprint 5)** Conectar `applyEmotionToDamage` / `applyEmotionToAccuracy` en `combatEngine.ts`

---

## ACTUALIZACIÓN v2 — Eventos de esencias (Doc 13)

### Nuevos CombatEventType para el sistema de esencias

```typescript
// src/services/combatEngine.ts — añadir a CombatEventType:

export type CombatEventType =
  // ...tipos existentes...
  | 'ESSENCE_DROP_RARE'       // rank 4 o 3 (Raro o Épico) obtenido en combate
  | 'ESSENCE_DROP_MYTHIC'     // rank 2 o 1 (Mítico o Legendario) obtenido en combate
  | 'ESSENCE_EVOLVED'         // esencia evolucionada al nivel 2 o 3 (en CampScreen)
  | 'CHARACTER_ASCENDED';     // personaje completó la ascensión (en CampScreen)
```

### Resolución emocional para eventos de esencias

```typescript
// src/services/emotionalNarrativeService.ts — añadir a resolveFamily():

case 'ESSENCE_DROP_MYTHIC':
  return 'RESOLUCION';   // → determination → triumph si es legendaria

case 'ESSENCE_DROP_RARE':
  return 'CONTROL';      // → confident

case 'ESSENCE_EVOLVED':
  return 'RESOLUCION';   // → serious

case 'CHARACTER_ASCENDED':
  return 'RESOLUCION';   // → triumph (siempre intensidad 3)
```

### Texto narrativo para esencias

```typescript
// Añadir a NARRATIVE_POOLS en emotionalNarrativeService.ts:

ESSENCE_DROP_MYTHIC: {
  narrator: [
    'El poder del monstruo caído busca un nuevo hogar.',
    'Algo antiguo y poderoso se funde con su esencia.',
  ],
  dialogue: {
    barbarian: ['¡Este poder es mío!', '¡AHORA SÍ HABLA LA FUERZA!'],
    wizard:    ['Fascinante... la energía es palpable.'],
    rogue:     ['Bien. Esto cambia mis planes.'],
    paladin:   ['¿Es este un don o una prueba?'],
    default:   ['Siento... algo diferente.', 'No esperaba esto.'],
  },
},

ESSENCE_DROP_RARE: {
  narrator: ['El eco del monstruo persiste en sus manos.'],
  dialogue: { default: ['Interesante.', 'Puedo usar esto.'] },
},

CHARACTER_ASCENDED: {
  narrator: [
    'Los límites de lo mortal ya no son suyos.',
    'La ascensión no es un final — es una transformación.',
  ],
  dialogue: { default: ['Esto es lo que soy ahora.', 'Todo ha cambiado.'] },
},
```

### Trigger en ReportScreen

```typescript
// src/screens/ReportScreen.tsx — después de procesar essenceDrops:

if (combatResult?.essenceDrops?.length) {
  const legendary = combatResult.essenceDrops.find(e => e.rank <= 2);
  const epic      = combatResult.essenceDrops.find(e => e.rank === 3);

  if (legendary) {
    processEmotionEvents([{
      type: 'ESSENCE_DROP_MYTHIC',
      actorName: legendary.equippedToChar ?? activeGame.partyData[0]?.name ?? '',
      turn: 0,
    }]);
  } else if (epic) {
    processEmotionEvents([{
      type: 'ESSENCE_DROP_RARE',
      actorName: activeGame.partyData[0]?.name ?? '',
      turn: 0,
    }]);
  }
}
```
