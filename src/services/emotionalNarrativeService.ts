/**
 * emotionalNarrativeService.ts — Sprint 4C
 *
 * Translates CombatEvent[] → EmotionState per character.
 * Determines which of the 22 expressions to show and generates narrative text.
 *
 * The 22 expressions exactly match the keys of EXPRESSION_PRESETS in
 * scripts/generate-expressions.js — they are the canonical set.
 */

import type { CombatEvent, CombatEventType } from './combatEngine';
import type { CharacterSave } from '../database/gameRepository';

// ─── Expression type (22 canonical keys) ─────────────────────────────────────

export type ExpressionKey =
  | 'neutral'
  | 'angry'
  | 'confident'
  | 'confused'
  | 'despondent'
  | 'determined'
  | 'disgusted'
  | 'fearful'
  | 'fierce'
  | 'flirty'
  | 'happy'
  | 'hollow'
  | 'incredulous'
  | 'rage'
  | 'sad'
  | 'sarcastic'
  | 'seductive'
  | 'serious'
  | 'shocked'
  | 'surprised'
  | 'tired'
  | 'triumph';

// ─── Emotion family escalation ────────────────────────────────────────────────
// Each family has 3 intensity tiers. Same event type → escalate; different → reset to 1.

export type EmotionFamily = 'COLERA' | 'MIEDO' | 'DUELO' | 'RESOLUCION' | 'CONTROL' | 'NEUTRO';

const FAMILY_ESCALATION: Record<EmotionFamily, [ExpressionKey, ExpressionKey, ExpressionKey]> = {
  COLERA:     ['angry',       'fierce',      'rage'],
  MIEDO:      ['surprised',   'fearful',     'shocked'],
  DUELO:      ['sad',         'despondent',  'hollow'],
  RESOLUCION: ['determined',  'serious',     'triumph'],
  CONTROL:    ['confident',   'flirty',      'sarcastic'],
  NEUTRO:     ['neutral',     'neutral',     'neutral'],
};

// ─── Combat modifiers per expression ─────────────────────────────────────────
// Active in Sprint 5 — attached here as source of truth

export type EmotionModifier = {
  damageMult?:   number;
  defenseMult?:  number;
  accuracyMult?: number;
  critBonus?:    number;
  evasionBonus?: number;
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

// ─── Emotion state ────────────────────────────────────────────────────────────

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

// ─── Family resolver (class-aware) ────────────────────────────────────────────

function resolveFamily(
  eventType: CombatEventType,
  charClass: string,
  currentFamily: EmotionFamily | null,
): EmotionFamily {
  const aggressive = ['barbarian', 'fighter', 'paladin', 'ranger'];
  const empathetic  = ['cleric', 'bard', 'druid'];
  const calculated  = ['wizard', 'sorcerer', 'warlock'];
  const evasive     = ['rogue', 'monk'];

  switch (eventType) {
    case 'ALLY_DOWN':
      if (aggressive.includes(charClass)) return 'COLERA';
      if (empathetic.includes(charClass))  return 'DUELO';
      return 'RESOLUCION';

    case 'CRIT_DEALT':
    case 'ABILITY_USED':
      if (evasive.includes(charClass))    return 'CONTROL';
      if (charClass === 'barbarian')      return 'COLERA';
      return 'RESOLUCION';

    case 'CRIT_RECEIVED':
      if (calculated.includes(charClass)) return 'MIEDO';
      if (aggressive.includes(charClass)) return 'COLERA';
      return 'MIEDO';

    case 'LOW_HEALTH':
      if (currentFamily === 'COLERA')     return 'COLERA';
      if (aggressive.includes(charClass)) return 'RESOLUCION';
      return 'MIEDO';

    case 'VERY_LOW_HEALTH':
      return 'RESOLUCION';

    case 'NAT_ONE':
      return 'NEUTRO';

    case 'ENEMY_DEFEATED':
      if (evasive.includes(charClass)) return 'CONTROL';
      return 'RESOLUCION';

    case 'BOSS_DEFEATED':
    case 'VICTORY':
      return 'RESOLUCION';

    case 'DEFEAT':
      return 'DUELO';

    case 'ESSENCE_DROP_MYTHIC':
      return 'RESOLUCION';

    case 'ESSENCE_DROP_RARE':
      return 'CONTROL';

    case 'ESSENCE_EVOLVED':
      return 'RESOLUCION';

    case 'CHARACTER_ASCENDED':
      return 'RESOLUCION';

    default:
      return 'NEUTRO';
  }
}

// ─── Main resolver ────────────────────────────────────────────────────────────

export function resolveEmotion(
  event: CombatEvent,
  char: CharacterSave,
  currentState: EmotionState | null,
): EmotionState {
  const family = resolveFamily(event.type, char.charClass.toLowerCase(), currentState?.family ?? null);

  const intensity: 1 | 2 | 3 =
    currentState?.family === family
      ? Math.min(3, currentState.intensity + 1) as 1 | 2 | 3
      : 1;

  let expression: ExpressionKey;
  if (event.type === 'NAT_ONE') {
    expression = 'confused';
  } else if (event.type === 'BOSS_DEFEATED') {
    expression = 'triumph';
  } else if (event.type === 'CHARACTER_ASCENDED') {
    expression = 'triumph';
  } else if (event.type === 'VICTORY' && intensity === 3) {
    expression = 'triumph';
  } else if (event.type === 'DEFEAT') {
    expression = 'hollow';
  } else if (event.type === 'VERY_LOW_HEALTH' && currentState?.expression === 'determined') {
    expression = 'triumph'; // heroic last breath
  } else {
    expression = FAMILY_ESCALATION[family][intensity - 1];
  }

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

// ─── Tick durations at start of each turn ────────────────────────────────────

export function tickEmotionDurations(state: PartyEmotionalState): PartyEmotionalState {
  const out: PartyEmotionalState = {};
  for (const [name, emotion] of Object.entries(state)) {
    if (!emotion) { out[name] = null; continue; }
    const d = emotion.durationTurns - 1;
    out[name] = d <= 0 ? null : { ...emotion, durationTurns: d };
  }
  return out;
}

// ─── Narrative text pools ─────────────────────────────────────────────────────

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
      wizard:    ['¡Mis cálculos de defensa fallaron!'],
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
};

function buildNarrativeText(
  eventType: CombatEventType,
  charClass: string,
  charName: string,
): { narrator: string; dialogue: string } {
  const pool = NARRATIVE_POOLS[eventType];
  if (!pool) return { narrator: '', dialogue: '' };

  // Deterministic PRNG: same character + same event → same line (replay consistency)
  let h = 5381;
  const seed = `narrative_${charName}_${eventType}`;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(h, 33) ^ seed.charCodeAt(i)) >>> 0;
  }
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

// ─── BattleScreen helpers ─────────────────────────────────────────────────────

/** Events that open the NarrativeMomentPanel (most dramatic) */
export function isSignificantEvent(type: CombatEventType): boolean {
  return ['ALLY_DOWN', 'BOSS_DEFEATED', 'VERY_LOW_HEALTH', 'CRIT_DEALT'].includes(type as string);
}

/** Apply emotion modifier to base damage — wire up in Sprint 5 */
export function applyEmotionToDamage(baseDamage: number, emotion: EmotionState | null): number {
  if (!emotion) return baseDamage;
  return Math.round(baseDamage * (emotion.modifier.damageMult ?? 1.0));
}
