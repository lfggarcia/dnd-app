/**
 * D&D 5e Level 1 reference data for TORRE.
 * Subclass features, class starting features, race traits, and stat validation.
 */

// ─── Subclass Features (PHB) ─────────────────────────────

export type FeatureEntry = { en: string; es: string; level: number };

/**
 * Complete subclass feature map for all 24 subclasses (2 per class).
 * Used as fallback when the D&D 5e API doesn't return data (non-SRD subclasses).
 */
export const SUBCLASS_FEATURES: Record<string, FeatureEntry[]> = {
  // ── Barbarian ──
  berserker: [
    { en: 'Frenzy', es: 'Frenesí', level: 3 },
    { en: 'Mindless Rage', es: 'Ira Inconsciente', level: 6 },
    { en: 'Intimidating Presence', es: 'Presencia Intimidante', level: 10 },
    { en: 'Retaliation', es: 'Represalia', level: 14 },
  ],
  'totem-warrior': [
    { en: 'Spirit Seeker', es: 'Buscador de Espíritus', level: 3 },
    { en: 'Totem Spirit', es: 'Espíritu Totémico', level: 3 },
    { en: 'Aspect of the Beast', es: 'Aspecto de la Bestia', level: 6 },
    { en: 'Spirit Walker', es: 'Caminante Espiritual', level: 10 },
    { en: 'Totemic Attunement', es: 'Sintonía Totémica', level: 14 },
  ],
  // ── Bard ──
  lore: [
    { en: 'Bonus Proficiencies', es: 'Competencias Adicionales', level: 3 },
    { en: 'Cutting Words', es: 'Palabras Cortantes', level: 3 },
    { en: 'Additional Magical Secrets', es: 'Secretos Mágicos Adicionales', level: 6 },
    { en: 'Peerless Skill', es: 'Habilidad Sin Igual', level: 14 },
  ],
  valor: [
    { en: 'Bonus Proficiencies', es: 'Competencias Adicionales', level: 3 },
    { en: 'Combat Inspiration', es: 'Inspiración de Combate', level: 3 },
    { en: 'Extra Attack', es: 'Ataque Extra', level: 6 },
    { en: 'Battle Magic', es: 'Magia de Batalla', level: 14 },
  ],
  // ── Cleric ──
  life: [
    { en: 'Bonus Proficiency', es: 'Competencia Adicional', level: 1 },
    { en: 'Disciple of Life', es: 'Discípulo de la Vida', level: 1 },
    { en: 'Preserve Life', es: 'Preservar la Vida', level: 2 },
    { en: 'Blessed Healer', es: 'Sanador Bendecido', level: 6 },
    { en: 'Divine Strike', es: 'Golpe Divino', level: 8 },
    { en: 'Supreme Healing', es: 'Sanación Suprema', level: 17 },
  ],
  war: [
    { en: 'Bonus Proficiencies', es: 'Competencias Adicionales', level: 1 },
    { en: 'War Priest', es: 'Sacerdote de Guerra', level: 1 },
    { en: 'Guided Strike', es: 'Golpe Guiado', level: 2 },
    { en: "War God's Blessing", es: 'Bendición del Dios de la Guerra', level: 6 },
    { en: 'Divine Strike', es: 'Golpe Divino', level: 8 },
    { en: 'Avatar of Battle', es: 'Avatar de Batalla', level: 17 },
  ],
  // ── Druid ──
  land: [
    { en: 'Bonus Cantrip', es: 'Truco Adicional', level: 2 },
    { en: 'Natural Recovery', es: 'Recuperación Natural', level: 2 },
    { en: "Land's Stride", es: 'Zancada por el Terreno', level: 6 },
    { en: "Nature's Ward", es: 'Protección de la Naturaleza', level: 10 },
    { en: "Nature's Sanctuary", es: 'Santuario Natural', level: 14 },
  ],
  moon: [
    { en: 'Combat Wild Shape', es: 'Forma Salvaje de Combate', level: 2 },
    { en: 'Circle Forms', es: 'Formas del Círculo', level: 2 },
    { en: 'Primal Strike', es: 'Golpe Primigenio', level: 6 },
    { en: 'Elemental Wild Shape', es: 'Forma Salvaje Elemental', level: 10 },
    { en: 'Thousand Forms', es: 'Mil Formas', level: 14 },
  ],
  // ── Fighter ──
  champion: [
    { en: 'Improved Critical', es: 'Crítico Mejorado', level: 3 },
    { en: 'Remarkable Athlete', es: 'Atleta Extraordinario', level: 7 },
    { en: 'Additional Fighting Style', es: 'Estilo de Combate Adicional', level: 10 },
    { en: 'Superior Critical', es: 'Crítico Superior', level: 15 },
    { en: 'Survivor', es: 'Superviviente', level: 18 },
  ],
  'battle-master': [
    { en: 'Combat Superiority', es: 'Superioridad en Combate', level: 3 },
    { en: 'Student of War', es: 'Estudiante de Guerra', level: 3 },
    { en: 'Know Your Enemy', es: 'Conoce a tu Enemigo', level: 7 },
    { en: 'Improved Combat Superiority', es: 'Superioridad en Combate Mejorada', level: 10 },
    { en: 'Relentless', es: 'Implacable', level: 15 },
  ],
  // ── Monk ──
  'open-hand': [
    { en: 'Open Hand Technique', es: 'Técnica de Mano Abierta', level: 3 },
    { en: 'Wholeness of Body', es: 'Plenitud Corporal', level: 6 },
    { en: 'Tranquility', es: 'Tranquilidad', level: 11 },
    { en: 'Quivering Palm', es: 'Palma Temblorosa', level: 17 },
  ],
  shadow: [
    { en: 'Shadow Arts', es: 'Artes de la Sombra', level: 3 },
    { en: 'Shadow Step', es: 'Paso Sombrío', level: 6 },
    { en: 'Cloak of Shadows', es: 'Manto de Sombras', level: 11 },
    { en: 'Opportunist', es: 'Oportunista', level: 17 },
  ],
  // ── Paladin ──
  devotion: [
    { en: 'Sacred Weapon', es: 'Arma Sagrada', level: 3 },
    { en: 'Turn the Unholy', es: 'Expulsar lo Profano', level: 3 },
    { en: 'Aura of Devotion', es: 'Aura de Devoción', level: 7 },
    { en: 'Purity of Spirit', es: 'Pureza de Espíritu', level: 15 },
    { en: 'Holy Nimbus', es: 'Nimbo Sagrado', level: 20 },
  ],
  vengeance: [
    { en: 'Abjure Enemy', es: 'Abjurar Enemigo', level: 3 },
    { en: 'Vow of Enmity', es: 'Voto de Enemistad', level: 3 },
    { en: 'Relentless Avenger', es: 'Vengador Implacable', level: 7 },
    { en: 'Soul of Vengeance', es: 'Alma de Venganza', level: 15 },
    { en: 'Avenging Angel', es: 'Ángel Vengador', level: 20 },
  ],
  // ── Ranger ──
  hunter: [
    { en: "Hunter's Prey", es: 'Presa del Cazador', level: 3 },
    { en: 'Defensive Tactics', es: 'Tácticas Defensivas', level: 7 },
    { en: 'Multiattack', es: 'Multiataque', level: 11 },
    { en: "Superior Hunter's Defense", es: 'Defensa Superior del Cazador', level: 15 },
  ],
  'beast-master': [
    { en: "Ranger's Companion", es: 'Compañero del Explorador', level: 3 },
    { en: 'Exceptional Training', es: 'Entrenamiento Excepcional', level: 7 },
    { en: 'Bestial Fury', es: 'Furia Bestial', level: 11 },
    { en: 'Share Spells', es: 'Compartir Conjuros', level: 15 },
  ],
  // ── Rogue ──
  thief: [
    { en: 'Fast Hands', es: 'Manos Rápidas', level: 3 },
    { en: 'Second-Story Work', es: 'Trabajo en Alturas', level: 3 },
    { en: 'Supreme Sneak', es: 'Sigilo Supremo', level: 9 },
    { en: 'Use Magic Device', es: 'Usar Objeto Mágico', level: 13 },
    { en: "Thief's Reflexes", es: 'Reflejos de Ladrón', level: 17 },
  ],
  assassin: [
    { en: 'Bonus Proficiencies', es: 'Competencias Adicionales', level: 3 },
    { en: 'Assassinate', es: 'Asesinar', level: 3 },
    { en: 'Infiltration Expertise', es: 'Pericia en Infiltración', level: 9 },
    { en: 'Impostor', es: 'Impostor', level: 13 },
    { en: 'Death Strike', es: 'Golpe Mortal', level: 17 },
  ],
  // ── Sorcerer ──
  draconic: [
    { en: 'Dragon Ancestor', es: 'Ancestro Dragón', level: 1 },
    { en: 'Draconic Resilience', es: 'Resistencia Dracónica', level: 1 },
    { en: 'Elemental Affinity', es: 'Afinidad Elemental', level: 6 },
    { en: 'Dragon Wings', es: 'Alas de Dragón', level: 14 },
    { en: 'Draconic Presence', es: 'Presencia Dracónica', level: 18 },
  ],
  'wild-magic': [
    { en: 'Wild Magic Surge', es: 'Oleada de Magia Salvaje', level: 1 },
    { en: 'Tides of Chaos', es: 'Mareas del Caos', level: 1 },
    { en: 'Bend Luck', es: 'Torcer la Suerte', level: 6 },
    { en: 'Controlled Chaos', es: 'Caos Controlado', level: 14 },
    { en: 'Spell Bombardment', es: 'Bombardeo de Hechizos', level: 18 },
  ],
  // ── Warlock ──
  fiend: [
    { en: "Dark One's Blessing", es: 'Bendición del Oscuro', level: 1 },
    { en: "Dark One's Own Luck", es: 'Suerte del Oscuro', level: 6 },
    { en: 'Fiendish Resilience', es: 'Resistencia Infernal', level: 10 },
    { en: 'Hurl Through Hell', es: 'Lanzar al Infierno', level: 14 },
  ],
  'great-old-one': [
    { en: 'Awakened Mind', es: 'Mente Despierta', level: 1 },
    { en: 'Entropic Ward', es: 'Protección Entrópica', level: 6 },
    { en: 'Thought Shield', es: 'Escudo Mental', level: 10 },
    { en: 'Create Thrall', es: 'Crear Vasallo', level: 14 },
  ],
  // ── Wizard ──
  evocation: [
    { en: 'Evocation Savant', es: 'Evocador Experto', level: 2 },
    { en: 'Sculpt Spells', es: 'Esculpir Conjuros', level: 2 },
    { en: 'Potent Cantrip', es: 'Truco Potente', level: 6 },
    { en: 'Empowered Evocation', es: 'Evocación Potenciada', level: 10 },
    { en: 'Overchannel', es: 'Sobrecanalizar', level: 14 },
  ],
  abjuration: [
    { en: 'Abjuration Savant', es: 'Abjurador Experto', level: 2 },
    { en: 'Arcane Ward', es: 'Protección Arcana', level: 2 },
    { en: 'Projected Ward', es: 'Protección Proyectada', level: 6 },
    { en: 'Improved Abjuration', es: 'Abjuración Mejorada', level: 10 },
    { en: 'Spell Resistance', es: 'Resistencia a Conjuros', level: 14 },
  ],
};

// ─── Class Level 1 Features ──────────────────────────────

type BilingualFeature = { en: string; es: string };

export const CLASS_LVL1_FEATURES: Record<string, BilingualFeature[]> = {
  barbarian: [
    { en: 'Rage (2/day)', es: 'Ira (2/día)' },
    { en: 'Unarmored Defense', es: 'Defensa sin Armadura' },
  ],
  bard: [
    { en: 'Spellcasting', es: 'Lanzamiento de Conjuros' },
    { en: 'Bardic Inspiration (d6)', es: 'Inspiración de Bardo (d6)' },
  ],
  cleric: [
    { en: 'Spellcasting', es: 'Lanzamiento de Conjuros' },
    { en: 'Divine Domain', es: 'Dominio Divino' },
  ],
  druid: [
    { en: 'Druidic', es: 'Druídico' },
    { en: 'Spellcasting', es: 'Lanzamiento de Conjuros' },
  ],
  fighter: [
    { en: 'Fighting Style', es: 'Estilo de Combate' },
    { en: 'Second Wind (1d10+1)', es: 'Segundo Aliento (1d10+1)' },
  ],
  monk: [
    { en: 'Unarmored Defense', es: 'Defensa sin Armadura' },
    { en: 'Martial Arts (d4)', es: 'Artes Marciales (d4)' },
  ],
  paladin: [
    { en: 'Divine Sense', es: 'Sentido Divino' },
    { en: 'Lay on Hands (5 HP)', es: 'Imposición de Manos (5 HP)' },
  ],
  ranger: [
    { en: 'Favored Enemy', es: 'Enemigo Predilecto' },
    { en: 'Natural Explorer', es: 'Explorador Natural' },
  ],
  rogue: [
    { en: 'Expertise (2 skills)', es: 'Pericia (2 habilidades)' },
    { en: 'Sneak Attack (1d6)', es: 'Ataque Furtivo (1d6)' },
    { en: "Thieves' Cant", es: 'Jerga de Ladrones' },
  ],
  sorcerer: [
    { en: 'Spellcasting', es: 'Lanzamiento de Conjuros' },
    { en: 'Sorcerous Origin', es: 'Origen Hechicero' },
  ],
  warlock: [
    { en: 'Otherworldly Patron', es: 'Patrón de Otro Mundo' },
    { en: 'Pact Magic (1 slot)', es: 'Magia de Pacto (1 slot)' },
  ],
  wizard: [
    { en: 'Spellcasting', es: 'Lanzamiento de Conjuros' },
    { en: 'Arcane Recovery', es: 'Recuperación Arcana' },
  ],
};

// ─── Race Traits ─────────────────────────────────────────

export const RACE_TRAITS: Record<string, BilingualFeature[]> = {
  human: [
    { en: '+1 All Ability Scores', es: '+1 Todas las Características' },
    { en: 'Extra Language', es: 'Idioma Adicional' },
  ],
  elf: [
    { en: 'Darkvision (60ft)', es: 'Visión en la Oscuridad (18m)' },
    { en: 'Keen Senses', es: 'Sentidos Agudos' },
    { en: 'Fey Ancestry', es: 'Linaje Feérico' },
    { en: 'Trance (4h rest)', es: 'Trance (4h descanso)' },
  ],
  dwarf: [
    { en: 'Darkvision (60ft)', es: 'Visión en la Oscuridad (18m)' },
    { en: 'Dwarven Resilience', es: 'Resistencia Enana' },
    { en: 'Stonecunning', es: 'Afinidad con la Piedra' },
  ],
  halfling: [
    { en: 'Lucky', es: 'Afortunado' },
    { en: 'Brave', es: 'Valiente' },
    { en: 'Halfling Nimbleness', es: 'Agilidad Halfling' },
  ],
  dragonborn: [
    { en: 'Draconic Ancestry', es: 'Linaje Dracónico' },
    { en: 'Breath Weapon', es: 'Arma de Aliento' },
    { en: 'Damage Resistance', es: 'Resistencia al Daño' },
  ],
  gnome: [
    { en: 'Darkvision (60ft)', es: 'Visión en la Oscuridad (18m)' },
    { en: 'Gnome Cunning', es: 'Astucia Gnoma' },
  ],
  'half-elf': [
    { en: 'Darkvision (60ft)', es: 'Visión en la Oscuridad (18m)' },
    { en: 'Fey Ancestry', es: 'Linaje Feérico' },
    { en: 'Skill Versatility (2)', es: 'Versatilidad (2 habilidades)' },
  ],
  'half-orc': [
    { en: 'Darkvision (60ft)', es: 'Visión en la Oscuridad (18m)' },
    { en: 'Menacing', es: 'Amenazante' },
    { en: 'Relentless Endurance', es: 'Resistencia Incansable' },
    { en: 'Savage Attacks', es: 'Ataques Salvajes' },
  ],
  tiefling: [
    { en: 'Darkvision (60ft)', es: 'Visión en la Oscuridad (18m)' },
    { en: 'Hellish Resistance', es: 'Resistencia Infernal' },
    { en: 'Infernal Legacy', es: 'Legado Infernal' },
  ],
};

// ─── Hit Dice & HP ───────────────────────────────────────

export const CLASS_HIT_DICE: Record<string, number> = {
  barbarian: 12, bard: 8, cleric: 8, druid: 8,
  fighter: 10, monk: 8, paladin: 10, ranger: 10,
  rogue: 8, sorcerer: 6, warlock: 8, wizard: 6,
};

/** Level 1 HP = max hit die + CON modifier */
export function calcLvl1HP(classIndex: string, conScore: number): number {
  const hitDie = CLASS_HIT_DICE[classIndex] || 8;
  const conMod = Math.floor((conScore - 10) / 2);
  return Math.max(1, hitDie + conMod);
}

// ─── Stat Validation ─────────────────────────────────────

/** D&D 5e level 1 stat constraints for balanced play */
export const LVL1_RULES = {
  PROFICIENCY_BONUS: 2,
  MIN_ROLL_TOTAL: 70,
  MAX_ROLL_TOTAL: 80,
  MAX_ABILITY_SCORE: 20,
  STANDARD_ARRAY: [15, 14, 13, 12, 10, 8] as const,
};

// ─── Character Actions (D&D 5e) ─────────────────────────

export type ActionChoice = {
  id: string;
  en: string;
  es: string;
  descEn: string;
  descEs: string;
};

export type ActionEntry = {
  en: string;
  es: string;
  descEn: string;
  descEs: string;
  type: 'action' | 'bonus' | 'reaction' | 'passive' | 'special';
  /** If present, the user must select one of these options */
  choices?: ActionChoice[];
  /** Unique key to store the selection (e.g. 'fighter-fighting-style') */
  choiceKey?: string;
};

/** Universal combat actions every character can use */
export const COMBAT_ACTIONS: ActionEntry[] = [
  { en: 'Attack', es: 'Atacar', type: 'action',
    descEn: 'Make a melee or ranged attack with a weapon',
    descEs: 'Realiza un ataque cuerpo a cuerpo o a distancia con un arma' },
  { en: 'Dodge', es: 'Esquivar', type: 'action',
    descEn: 'Focus on defense. Attacks against you have disadvantage until your next turn',
    descEs: 'Concéntrate en defensa. Los ataques contra ti tienen desventaja hasta tu próximo turno' },
  { en: 'Dash', es: 'Carrera', type: 'action',
    descEn: 'Double your movement speed for this turn',
    descEs: 'Duplica tu velocidad de movimiento en este turno' },
  { en: 'Disengage', es: 'Retirada', type: 'action',
    descEn: 'Your movement doesn\'t provoke opportunity attacks this turn',
    descEs: 'Tu movimiento no provoca ataques de oportunidad este turno' },
  { en: 'Help', es: 'Ayudar', type: 'action',
    descEn: 'Give an ally advantage on their next ability check or attack roll',
    descEs: 'Da ventaja a un aliado en su próxima tirada de habilidad o ataque' },
  { en: 'Hide', es: 'Esconderse', type: 'action',
    descEn: 'Make a DEX (Stealth) check to hide from enemies',
    descEs: 'Realiza una tirada de DES (Sigilo) para esconderte de enemigos' },
  { en: 'Ready', es: 'Preparar', type: 'action',
    descEn: 'Prepare an action to trigger on a specific condition',
    descEs: 'Prepara una acción que se activa ante una condición específica' },
  { en: 'Use an Object', es: 'Usar Objeto', type: 'action',
    descEn: 'Interact with an object that requires your action',
    descEs: 'Interactúa con un objeto que requiere tu acción' },
  { en: 'Opportunity Attack', es: 'Ataque de Oportunidad', type: 'reaction',
    descEn: 'Make a melee attack when an enemy leaves your reach',
    descEs: 'Realiza un ataque cuerpo a cuerpo cuando un enemigo sale de tu alcance' },
];

/** Class-specific actions at level 1 */
export const CLASS_ACTIONS: Record<string, ActionEntry[]> = {
  barbarian: [
    { en: 'Rage', es: 'Ira', type: 'bonus',
      descEn: '2/day. +2 melee damage, resistance to physical damage, advantage on STR checks. Lasts 1 min',
      descEs: '2/día. +2 daño cuerpo a cuerpo, resistencia a daño físico, ventaja en tiradas de FUE. Dura 1 min' },
    { en: 'Unarmored Defense', es: 'Defensa sin Armadura', type: 'passive',
      descEn: 'AC = 10 + DEX mod + CON mod when not wearing armor',
      descEs: 'CA = 10 + mod DES + mod CON cuando no llevas armadura' },
  ],
  bard: [
    { en: 'Bardic Inspiration', es: 'Inspiración de Bardo', type: 'bonus',
      descEn: 'CHA mod/day. Give an ally a d6 to add to an ability check, attack, or save',
      descEs: 'mod CAR/día. Da a un aliado un d6 para sumar a una tirada de habilidad, ataque o salvación' },
    { en: 'Spellcasting', es: 'Lanzar Conjuros', type: 'action',
      descEn: '2 cantrips, 4 spells known, 2 1st-level slots. CHA is your spellcasting ability',
      descEs: '2 trucos, 4 conjuros conocidos, 2 slots de nivel 1. CAR es tu aptitud de conjuración' },
  ],
  cleric: [
    { en: 'Spellcasting', es: 'Lanzar Conjuros', type: 'action',
      descEn: '3 cantrips, WIS mod+1 prepared, 2 1st-level slots. WIS is your spellcasting ability',
      descEs: '3 trucos, mod SAB+1 preparados, 2 slots de nivel 1. SAB es tu aptitud de conjuración' },
    { en: 'Divine Domain', es: 'Dominio Divino', type: 'passive',
      descEn: 'Your subclass grants domain spells and a bonus feature at level 1',
      descEs: 'Tu subclase otorga conjuros de dominio y un rasgo adicional en nivel 1' },
  ],
  druid: [
    { en: 'Druidic', es: 'Druídico', type: 'passive',
      descEn: 'You know Druidic, a secret language of druids. You can leave hidden messages',
      descEs: 'Conoces el Druídico, un lenguaje secreto de los druidas. Puedes dejar mensajes ocultos' },
    { en: 'Spellcasting', es: 'Lanzar Conjuros', type: 'action',
      descEn: '2 cantrips, WIS mod+1 prepared, 2 1st-level slots. WIS is your spellcasting ability',
      descEs: '2 trucos, mod SAB+1 preparados, 2 slots de nivel 1. SAB es tu aptitud de conjuración' },
  ],
  fighter: [
    { en: 'Fighting Style', es: 'Estilo de Combate', type: 'passive',
      descEn: 'Choose a combat specialization:',
      descEs: 'Elige una especialización de combate:',
      choiceKey: 'fighter-fighting-style',
      choices: [
        { id: 'archery', en: 'Archery', es: 'Tiro con Arco',
          descEn: '+2 bonus to attack rolls with ranged weapons',
          descEs: '+2 a tiradas de ataque con armas a distancia' },
        { id: 'defense', en: 'Defense', es: 'Defensa',
          descEn: '+1 bonus to AC while wearing armor',
          descEs: '+1 a CA mientras llevas armadura' },
        { id: 'dueling', en: 'Dueling', es: 'Duelo',
          descEn: '+2 bonus to damage when wielding a weapon in one hand and no other weapons',
          descEs: '+2 al daño cuando empuñas un arma a una mano sin otra arma' },
        { id: 'great-weapon', en: 'Great Weapon Fighting', es: 'Lucha con Armas Grandes',
          descEn: 'Reroll 1s and 2s on damage dice with two-handed/versatile weapons',
          descEs: 'Repite 1s y 2s en dados de daño con armas a dos manos/versátiles' },
        { id: 'protection', en: 'Protection', es: 'Protección',
          descEn: 'Reaction: impose disadvantage on an attack against an adjacent ally (requires shield)',
          descEs: 'Reacción: impón desventaja a un ataque contra un aliado adyacente (requiere escudo)' },
        { id: 'two-weapon', en: 'Two-Weapon Fighting', es: 'Lucha con Dos Armas',
          descEn: 'Add ability modifier to the damage of your off-hand attack',
          descEs: 'Suma el modificador de característica al daño de tu ataque con la mano secundaria' },
      ] },
    { en: 'Second Wind', es: 'Segundo Aliento', type: 'bonus',
      descEn: '1/rest. Recover 1d10+1 HP as a bonus action',
      descEs: '1/descanso. Recupera 1d10+1 HP como acción adicional' },
  ],
  monk: [
    { en: 'Martial Arts', es: 'Artes Marciales', type: 'special',
      descEn: 'Use DEX for unarmed/monk weapon attacks. Unarmed damage is d4. Bonus unarmed strike after Attack',
      descEs: 'Usa DES para ataques desarmados/armas monje. Daño desarmado es d4. Golpe desarmado adicional tras Atacar' },
    { en: 'Unarmored Defense', es: 'Defensa sin Armadura', type: 'passive',
      descEn: 'AC = 10 + DEX mod + WIS mod when not wearing armor or shield',
      descEs: 'CA = 10 + mod DES + mod SAB cuando no llevas armadura ni escudo' },
  ],
  paladin: [
    { en: 'Divine Sense', es: 'Sentido Divino', type: 'action',
      descEn: '1+CHA mod/day. Detect celestials, fiends, and undead within 60ft',
      descEs: '1+mod CAR/día. Detecta celestiales, infernales y no-muertos en 18m' },
    { en: 'Lay on Hands', es: 'Imposición de Manos', type: 'action',
      descEn: 'Healing pool of 5 HP. Touch to heal or cure disease/poison (5 HP cost)',
      descEs: 'Reserva de 5 HP de sanación. Toca para curar o eliminar enfermedad/veneno (coste 5 HP)' },
  ],
  ranger: [
    { en: 'Favored Enemy', es: 'Enemigo Predilecto', type: 'passive',
      descEn: 'Choose a type of favored enemy:',
      descEs: 'Elige un tipo de enemigo predilecto:',
      choiceKey: 'ranger-favored-enemy',
      choices: [
        { id: 'aberrations', en: 'Aberrations', es: 'Aberraciones',
          descEn: 'Advantage on WIS (Survival) to track and INT to recall info about aberrations',
          descEs: 'Ventaja en SAB (Supervivencia) para rastrear y tiradas INT sobre aberraciones' },
        { id: 'beasts', en: 'Beasts', es: 'Bestias',
          descEn: 'Advantage on WIS (Survival) to track and INT to recall info about beasts',
          descEs: 'Ventaja en SAB (Supervivencia) para rastrear y tiradas INT sobre bestias' },
        { id: 'dragons', en: 'Dragons', es: 'Dragones',
          descEn: 'Advantage on WIS (Survival) to track and INT to recall info about dragons',
          descEs: 'Ventaja en SAB (Supervivencia) para rastrear y tiradas INT sobre dragones' },
        { id: 'fey', en: 'Fey', es: 'Feéricos',
          descEn: 'Advantage on WIS (Survival) to track and INT to recall info about fey',
          descEs: 'Ventaja en SAB (Supervivencia) para rastrear y tiradas INT sobre feéricos' },
        { id: 'fiends', en: 'Fiends', es: 'Infernales',
          descEn: 'Advantage on WIS (Survival) to track and INT to recall info about fiends',
          descEs: 'Ventaja en SAB (Supervivencia) para rastrear y tiradas INT sobre infernales' },
        { id: 'giants', en: 'Giants', es: 'Gigantes',
          descEn: 'Advantage on WIS (Survival) to track and INT to recall info about giants',
          descEs: 'Ventaja en SAB (Supervivencia) para rastrear y tiradas INT sobre gigantes' },
        { id: 'monstrosities', en: 'Monstrosities', es: 'Monstruosidades',
          descEn: 'Advantage on WIS (Survival) to track and INT to recall info about monstrosities',
          descEs: 'Ventaja en SAB (Supervivencia) para rastrear y tiradas INT sobre monstruosidades' },
        { id: 'undead', en: 'Undead', es: 'No-muertos',
          descEn: 'Advantage on WIS (Survival) to track and INT to recall info about undead',
          descEs: 'Ventaja en SAB (Supervivencia) para rastrear y tiradas INT sobre no-muertos' },
      ] },
    { en: 'Natural Explorer', es: 'Explorador Natural', type: 'passive',
      descEn: 'Choose a favored terrain:',
      descEs: 'Elige un terreno predilecto:',
      choiceKey: 'ranger-favored-terrain',
      choices: [
        { id: 'arctic', en: 'Arctic', es: 'Ártico',
          descEn: 'Double proficiency in INT/WIS checks, group ignores difficult terrain in arctic',
          descEs: 'Doble competencia en tiradas INT/SAB, el grupo ignora terreno difícil en ártico' },
        { id: 'coast', en: 'Coast', es: 'Costa',
          descEn: 'Double proficiency in INT/WIS checks, group ignores difficult terrain on coast',
          descEs: 'Doble competencia en tiradas INT/SAB, el grupo ignora terreno difícil en costa' },
        { id: 'desert', en: 'Desert', es: 'Desierto',
          descEn: 'Double proficiency in INT/WIS checks, group ignores difficult terrain in desert',
          descEs: 'Doble competencia en tiradas INT/SAB, el grupo ignora terreno difícil en desierto' },
        { id: 'forest', en: 'Forest', es: 'Bosque',
          descEn: 'Double proficiency in INT/WIS checks, group ignores difficult terrain in forest',
          descEs: 'Doble competencia en tiradas INT/SAB, el grupo ignora terreno difícil en bosque' },
        { id: 'grassland', en: 'Grassland', es: 'Pradera',
          descEn: 'Double proficiency in INT/WIS checks, group ignores difficult terrain in grassland',
          descEs: 'Doble competencia en tiradas INT/SAB, el grupo ignora terreno difícil en pradera' },
        { id: 'mountain', en: 'Mountain', es: 'Montaña',
          descEn: 'Double proficiency in INT/WIS checks, group ignores difficult terrain in mountain',
          descEs: 'Doble competencia en tiradas INT/SAB, el grupo ignora terreno difícil en montaña' },
        { id: 'swamp', en: 'Swamp', es: 'Pantano',
          descEn: 'Double proficiency in INT/WIS checks, group ignores difficult terrain in swamp',
          descEs: 'Doble competencia en tiradas INT/SAB, el grupo ignora terreno difícil en pantano' },
        { id: 'underdark', en: 'Underdark', es: 'Infraoscuridad',
          descEn: 'Double proficiency in INT/WIS checks, group ignores difficult terrain in underdark',
          descEs: 'Doble competencia en tiradas INT/SAB, el grupo ignora terreno difícil en infraoscuridad' },
      ] },
  ],
  rogue: [
    { en: 'Sneak Attack', es: 'Ataque Furtivo', type: 'special',
      descEn: '1/turn. +1d6 damage with finesse/ranged weapon when you have advantage or an ally is near target',
      descEs: '1/turno. +1d6 daño con arma sutil/distancia cuando tienes ventaja o un aliado está cerca del objetivo' },
    { en: 'Expertise', es: 'Pericia', type: 'passive',
      descEn: 'Choose 2 skills to gain double proficiency:',
      descEs: 'Elige 2 habilidades para doble competencia:',
      choiceKey: 'rogue-expertise',
      choices: [
        { id: 'acrobatics', en: 'Acrobatics', es: 'Acrobacias',
          descEn: 'Double proficiency in DEX (Acrobatics)',
          descEs: 'Doble competencia en DES (Acrobacias)' },
        { id: 'athletics', en: 'Athletics', es: 'Atletismo',
          descEn: 'Double proficiency in STR (Athletics)',
          descEs: 'Doble competencia en FUE (Atletismo)' },
        { id: 'deception', en: 'Deception', es: 'Engaño',
          descEn: 'Double proficiency in CHA (Deception)',
          descEs: 'Doble competencia en CAR (Engaño)' },
        { id: 'insight', en: 'Insight', es: 'Perspicacia',
          descEn: 'Double proficiency in WIS (Insight)',
          descEs: 'Doble competencia en SAB (Perspicacia)' },
        { id: 'intimidation', en: 'Intimidation', es: 'Intimidación',
          descEn: 'Double proficiency in CHA (Intimidation)',
          descEs: 'Doble competencia en CAR (Intimidación)' },
        { id: 'investigation', en: 'Investigation', es: 'Investigación',
          descEn: 'Double proficiency in INT (Investigation)',
          descEs: 'Doble competencia en INT (Investigación)' },
        { id: 'perception', en: 'Perception', es: 'Percepción',
          descEn: 'Double proficiency in WIS (Perception)',
          descEs: 'Doble competencia en SAB (Percepción)' },
        { id: 'performance', en: 'Performance', es: 'Interpretación',
          descEn: 'Double proficiency in CHA (Performance)',
          descEs: 'Doble competencia en CAR (Interpretación)' },
        { id: 'persuasion', en: 'Persuasion', es: 'Persuasión',
          descEn: 'Double proficiency in CHA (Persuasion)',
          descEs: 'Doble competencia en CAR (Persuasión)' },
        { id: 'sleight-of-hand', en: 'Sleight of Hand', es: 'Juego de Manos',
          descEn: 'Double proficiency in DEX (Sleight of Hand)',
          descEs: 'Doble competencia en DES (Juego de Manos)' },
        { id: 'stealth', en: 'Stealth', es: 'Sigilo',
          descEn: 'Double proficiency in DEX (Stealth)',
          descEs: 'Doble competencia en DES (Sigilo)' },
        { id: 'thieves-tools', en: "Thieves' Tools", es: 'Herramientas de Ladrón',
          descEn: "Double proficiency with thieves' tools",
          descEs: 'Doble competencia con herramientas de ladrón' },
      ] },
    { en: "Thieves' Cant", es: 'Jerga de Ladrones', type: 'passive',
      descEn: 'Secret rogue language. Understand hidden signs and coded messages',
      descEs: 'Lenguaje secreto de pícaros. Entiende señales ocultas y mensajes cifrados' },
  ],
  sorcerer: [
    { en: 'Spellcasting', es: 'Lanzar Conjuros', type: 'action',
      descEn: '4 cantrips, 2 spells known, 2 1st-level slots. CHA is your spellcasting ability',
      descEs: '4 trucos, 2 conjuros conocidos, 2 slots de nivel 1. CAR es tu aptitud de conjuración' },
    { en: 'Sorcerous Origin', es: 'Origen Hechicero', type: 'passive',
      descEn: 'Your subclass grants a unique innate magical feature at level 1',
      descEs: 'Tu subclase otorga un rasgo mágico innato único en nivel 1' },
  ],
  warlock: [
    { en: 'Pact Magic', es: 'Magia de Pacto', type: 'action',
      descEn: '2 cantrips, 2 spells known, 1 1st-level slot (recovers on short rest). CHA is your ability',
      descEs: '2 trucos, 2 conjuros conocidos, 1 slot de nivel 1 (recupera en descanso corto). CAR es tu aptitud' },
    { en: 'Otherworldly Patron', es: 'Patrón de Otro Mundo', type: 'passive',
      descEn: 'Your subclass patron grants a unique feature and expanded spell list at level 1',
      descEs: 'Tu patrón de subclase otorga un rasgo único y lista de conjuros expandida en nivel 1' },
  ],
  wizard: [
    { en: 'Spellcasting', es: 'Lanzar Conjuros', type: 'action',
      descEn: '3 cantrips, 6 in spellbook, INT mod+1 prepared, 2 1st-level slots. INT is your ability',
      descEs: '3 trucos, 6 en grimorio, mod INT+1 preparados, 2 slots de nivel 1. INT es tu aptitud' },
    { en: 'Arcane Recovery', es: 'Recuperación Arcana', type: 'special',
      descEn: '1/day after short rest. Recover 1 spell slot of 1st level',
      descEs: '1/día tras descanso corto. Recupera 1 slot de conjuro de nivel 1' },
  ],
};

/** Race-specific active abilities at level 1 */
export const RACE_ACTIONS: Record<string, ActionEntry[]> = {
  human: [
    { en: 'Versatile', es: 'Versátil', type: 'passive',
      descEn: '+1 to all ability scores. One extra language of your choice',
      descEs: '+1 a todas las características. Un idioma adicional a tu elección' },
  ],
  elf: [
    { en: 'Darkvision', es: 'Visión en la Oscuridad', type: 'passive',
      descEn: 'See in dim light within 60ft as if bright, and darkness as dim light',
      descEs: 'Ve en penumbra a 18m como si fuera luz brillante, y en oscuridad como penumbra' },
    { en: 'Fey Ancestry', es: 'Linaje Feérico', type: 'passive',
      descEn: 'Advantage on saves against being charmed. Magic can\'t put you to sleep',
      descEs: 'Ventaja en salvaciones contra ser encantado. La magia no puede dormirte' },
    { en: 'Trance', es: 'Trance', type: 'passive',
      descEn: 'Meditate 4 hours instead of sleeping 8. Remain semiconscious',
      descEs: 'Medita 4 horas en vez de dormir 8. Permaneces semiconsciente' },
    { en: 'Keen Senses', es: 'Sentidos Agudos', type: 'passive',
      descEn: 'Proficiency in the Perception skill',
      descEs: 'Competencia en la habilidad Percepción' },
  ],
  dwarf: [
    { en: 'Darkvision', es: 'Visión en la Oscuridad', type: 'passive',
      descEn: 'See in dim light within 60ft as if bright, and darkness as dim light',
      descEs: 'Ve en penumbra a 18m como si fuera luz brillante, y en oscuridad como penumbra' },
    { en: 'Dwarven Resilience', es: 'Resistencia Enana', type: 'passive',
      descEn: 'Advantage on saves against poison. Resistance to poison damage',
      descEs: 'Ventaja en salvaciones contra veneno. Resistencia al daño de veneno' },
    { en: 'Stonecunning', es: 'Afinidad con la Piedra', type: 'passive',
      descEn: 'Double proficiency on INT (History) checks related to stonework',
      descEs: 'Doble competencia en tiradas INT (Historia) relacionadas con piedra' },
  ],
  halfling: [
    { en: 'Lucky', es: 'Afortunado', type: 'special',
      descEn: 'When you roll a 1 on an attack, ability check, or save, reroll and use the new result',
      descEs: 'Cuando sacas un 1 en un ataque, habilidad o salvación, vuelve a tirar y usa el nuevo resultado' },
    { en: 'Brave', es: 'Valiente', type: 'passive',
      descEn: 'Advantage on saves against being frightened',
      descEs: 'Ventaja en salvaciones contra estar asustado' },
    { en: 'Halfling Nimbleness', es: 'Agilidad Halfling', type: 'passive',
      descEn: 'You can move through the space of any creature larger than you',
      descEs: 'Puedes moverte a través del espacio de cualquier criatura más grande que tú' },
  ],
  dragonborn: [
    { en: 'Draconic Ancestry', es: 'Linaje Dracónico', type: 'passive',
      descEn: 'Choose your dragon ancestor (determines breath weapon and resistance):',
      descEs: 'Elige tu ancestro dragón (determina arma de aliento y resistencia):',
      choiceKey: 'dragonborn-ancestry',
      choices: [
        { id: 'black', en: 'Black (Acid)', es: 'Negro (Ácido)',
          descEn: '5×30ft line, DEX save. Resistance to acid damage',
          descEs: 'Línea 1.5×9m, salvación DES. Resistencia al daño de ácido' },
        { id: 'blue', en: 'Blue (Lightning)', es: 'Azul (Relámpago)',
          descEn: '5×30ft line, DEX save. Resistance to lightning damage',
          descEs: 'Línea 1.5×9m, salvación DES. Resistencia al daño de relámpago' },
        { id: 'brass', en: 'Brass (Fire)', es: 'Latón (Fuego)',
          descEn: '5×30ft line, DEX save. Resistance to fire damage',
          descEs: 'Línea 1.5×9m, salvación DES. Resistencia al daño de fuego' },
        { id: 'bronze', en: 'Bronze (Lightning)', es: 'Bronce (Relámpago)',
          descEn: '5×30ft line, DEX save. Resistance to lightning damage',
          descEs: 'Línea 1.5×9m, salvación DES. Resistencia al daño de relámpago' },
        { id: 'copper', en: 'Copper (Acid)', es: 'Cobre (Ácido)',
          descEn: '5×30ft line, DEX save. Resistance to acid damage',
          descEs: 'Línea 1.5×9m, salvación DES. Resistencia al daño de ácido' },
        { id: 'gold', en: 'Gold (Fire)', es: 'Oro (Fuego)',
          descEn: '15ft cone, DEX save. Resistance to fire damage',
          descEs: 'Cono 4.5m, salvación DES. Resistencia al daño de fuego' },
        { id: 'green', en: 'Green (Poison)', es: 'Verde (Veneno)',
          descEn: '15ft cone, CON save. Resistance to poison damage',
          descEs: 'Cono 4.5m, salvación CON. Resistencia al daño de veneno' },
        { id: 'red', en: 'Red (Fire)', es: 'Rojo (Fuego)',
          descEn: '15ft cone, DEX save. Resistance to fire damage',
          descEs: 'Cono 4.5m, salvación DES. Resistencia al daño de fuego' },
        { id: 'silver', en: 'Silver (Cold)', es: 'Plata (Frío)',
          descEn: '15ft cone, CON save. Resistance to cold damage',
          descEs: 'Cono 4.5m, salvación CON. Resistencia al daño de frío' },
        { id: 'white', en: 'White (Cold)', es: 'Blanco (Frío)',
          descEn: '15ft cone, CON save. Resistance to cold damage',
          descEs: 'Cono 4.5m, salvación CON. Resistencia al daño de frío' },
      ] },
    { en: 'Breath Weapon', es: 'Arma de Aliento', type: 'action',
      descEn: 'Exhale destructive energy. 2d6 damage (shape depends on ancestry). 1/rest',
      descEs: 'Exhala energía destructiva. 2d6 de daño (forma según linaje). 1/descanso' },
    { en: 'Damage Resistance', es: 'Resistencia al Daño', type: 'passive',
      descEn: 'Resistance to the damage type of your chosen draconic ancestry',
      descEs: 'Resistencia al tipo de daño de tu linaje dracónico elegido' },
  ],
  gnome: [
    { en: 'Darkvision', es: 'Visión en la Oscuridad', type: 'passive',
      descEn: 'See in dim light within 60ft as if bright, and darkness as dim light',
      descEs: 'Ve en penumbra a 18m como si fuera luz brillante, y en oscuridad como penumbra' },
    { en: 'Gnome Cunning', es: 'Astucia Gnoma', type: 'passive',
      descEn: 'Advantage on INT, WIS, CHA saves against magic',
      descEs: 'Ventaja en salvaciones de INT, SAB, CAR contra magia' },
  ],
  'half-elf': [
    { en: 'Darkvision', es: 'Visión en la Oscuridad', type: 'passive',
      descEn: 'See in dim light within 60ft as if bright, and darkness as dim light',
      descEs: 'Ve en penumbra a 18m como si fuera luz brillante, y en oscuridad como penumbra' },
    { en: 'Fey Ancestry', es: 'Linaje Feérico', type: 'passive',
      descEn: 'Advantage on saves against being charmed. Magic can\'t put you to sleep',
      descEs: 'Ventaja en salvaciones contra ser encantado. La magia no puede dormirte' },
    { en: 'Skill Versatility', es: 'Versatilidad', type: 'passive',
      descEn: 'Proficiency in 2 skills of your choice',
      descEs: 'Competencia en 2 habilidades a tu elección' },
  ],
  'half-orc': [
    { en: 'Relentless Endurance', es: 'Resistencia Incansable', type: 'special',
      descEn: '1/long rest. When reduced to 0 HP, drop to 1 HP instead',
      descEs: '1/descanso largo. Cuando te reducen a 0 HP, caes a 1 HP en su lugar' },
    { en: 'Savage Attacks', es: 'Ataques Salvajes', type: 'passive',
      descEn: 'On a critical melee hit, roll one extra damage die',
      descEs: 'En un golpe crítico cuerpo a cuerpo, tira un dado de daño extra' },
    { en: 'Menacing', es: 'Amenazante', type: 'passive',
      descEn: 'Proficiency in the Intimidation skill',
      descEs: 'Competencia en la habilidad Intimidación' },
  ],
  tiefling: [
    { en: 'Hellish Resistance', es: 'Resistencia Infernal', type: 'passive',
      descEn: 'Resistance to fire damage',
      descEs: 'Resistencia al daño de fuego' },
    { en: 'Infernal Legacy', es: 'Legado Infernal', type: 'special',
      descEn: 'You know the Thaumaturgy cantrip. At level 3: Hellish Rebuke 1/day',
      descEs: 'Conoces el truco Taumaturgia. En nivel 3: Reprensión Infernal 1/día' },
  ],
};

/** Subclass-specific features active at level 1 (only subclasses with lv1 features) */
export const SUBCLASS_ACTIONS: Record<string, ActionEntry[]> = {
  // Cleric Life
  life: [
    { en: 'Disciple of Life', es: 'Discípulo de la Vida', type: 'passive',
      descEn: 'Healing spells restore extra HP equal to 2 + spell level',
      descEs: 'Los conjuros de sanación restauran HP extra igual a 2 + nivel del conjuro' },
    { en: 'Heavy Armor Prof.', es: 'Comp. Armadura Pesada', type: 'passive',
      descEn: 'You gain proficiency with heavy armor',
      descEs: 'Obtienes competencia con armaduras pesadas' },
  ],
  // Cleric War
  war: [
    { en: 'War Priest', es: 'Sacerdote de Guerra', type: 'bonus',
      descEn: 'WIS mod/day. Make one weapon attack as a bonus action after attacking',
      descEs: 'mod SAB/día. Realiza un ataque con arma como acción adicional tras atacar' },
    { en: 'Heavy Armor Prof.', es: 'Comp. Armadura Pesada', type: 'passive',
      descEn: 'You gain proficiency with heavy armor and martial weapons',
      descEs: 'Obtienes competencia con armaduras pesadas y armas marciales' },
  ],
  // Sorcerer Draconic
  draconic: [
    { en: 'Draconic Resilience', es: 'Resistencia Dracónica', type: 'passive',
      descEn: 'HP max increases by 1 per level. AC = 13 + DEX mod when unarmored',
      descEs: 'HP máx aumenta en 1 por nivel. CA = 13 + mod DES sin armadura' },
  ],
  // Sorcerer Wild Magic
  'wild-magic': [
    { en: 'Wild Magic Surge', es: 'Oleada de Magia Salvaje', type: 'special',
      descEn: 'After casting a spell, DM may have you roll d20. On 1, roll on the Wild Magic table',
      descEs: 'Tras lanzar un conjuro, el DM puede pedir que tires d20. En 1, tira en tabla de Magia Salvaje' },
    { en: 'Tides of Chaos', es: 'Mareas del Caos', type: 'special',
      descEn: '1/long rest. Gain advantage on one attack, ability check, or save',
      descEs: '1/descanso largo. Obtén ventaja en un ataque, tirada de habilidad o salvación' },
  ],
  // Warlock Fiend
  fiend: [
    { en: "Dark One's Blessing", es: 'Bendición del Oscuro', type: 'passive',
      descEn: 'When you reduce a hostile creature to 0 HP, gain CHA mod + warlock level temp HP',
      descEs: 'Cuando reduces una criatura hostil a 0 HP, gana mod CAR + nivel brujo HP temporales' },
  ],
  // Warlock Great Old One
  'great-old-one': [
    { en: 'Awakened Mind', es: 'Mente Despierta', type: 'special',
      descEn: 'Communicate telepathically with any creature within 30ft that you can see',
      descEs: 'Comunícate telepáticamente con cualquier criatura a 9m que puedas ver' },
  ],
};
