/**
 * D&D 5e Level 1 reference data for TORRE.
 * Subclass features, class starting features, race traits, and stat validation.
 */

// ─── Subclass Features (PHB) ─────────────────────────────

export type FeatureEntry = { name: string; level: number };

/**
 * Complete subclass feature map for all 24 subclasses (2 per class).
 * Used as fallback when the D&D 5e API doesn't return data (non-SRD subclasses).
 */
export const SUBCLASS_FEATURES: Record<string, FeatureEntry[]> = {
  // ── Barbarian ──
  berserker: [
    { name: 'Frenzy', level: 3 },
    { name: 'Mindless Rage', level: 6 },
    { name: 'Intimidating Presence', level: 10 },
    { name: 'Retaliation', level: 14 },
  ],
  'totem-warrior': [
    { name: 'Spirit Seeker', level: 3 },
    { name: 'Totem Spirit', level: 3 },
    { name: 'Aspect of the Beast', level: 6 },
    { name: 'Spirit Walker', level: 10 },
    { name: 'Totemic Attunement', level: 14 },
  ],
  // ── Bard ──
  lore: [
    { name: 'Bonus Proficiencies', level: 3 },
    { name: 'Cutting Words', level: 3 },
    { name: 'Additional Magical Secrets', level: 6 },
    { name: 'Peerless Skill', level: 14 },
  ],
  valor: [
    { name: 'Bonus Proficiencies', level: 3 },
    { name: 'Combat Inspiration', level: 3 },
    { name: 'Extra Attack', level: 6 },
    { name: 'Battle Magic', level: 14 },
  ],
  // ── Cleric ──
  life: [
    { name: 'Bonus Proficiency', level: 1 },
    { name: 'Disciple of Life', level: 1 },
    { name: 'Preserve Life', level: 2 },
    { name: 'Blessed Healer', level: 6 },
    { name: 'Divine Strike', level: 8 },
    { name: 'Supreme Healing', level: 17 },
  ],
  war: [
    { name: 'Bonus Proficiencies', level: 1 },
    { name: 'War Priest', level: 1 },
    { name: 'Guided Strike', level: 2 },
    { name: "War God's Blessing", level: 6 },
    { name: 'Divine Strike', level: 8 },
    { name: 'Avatar of Battle', level: 17 },
  ],
  // ── Druid ──
  land: [
    { name: 'Bonus Cantrip', level: 2 },
    { name: 'Natural Recovery', level: 2 },
    { name: "Land's Stride", level: 6 },
    { name: "Nature's Ward", level: 10 },
    { name: "Nature's Sanctuary", level: 14 },
  ],
  moon: [
    { name: 'Combat Wild Shape', level: 2 },
    { name: 'Circle Forms', level: 2 },
    { name: 'Primal Strike', level: 6 },
    { name: 'Elemental Wild Shape', level: 10 },
    { name: 'Thousand Forms', level: 14 },
  ],
  // ── Fighter ──
  champion: [
    { name: 'Improved Critical', level: 3 },
    { name: 'Remarkable Athlete', level: 7 },
    { name: 'Additional Fighting Style', level: 10 },
    { name: 'Superior Critical', level: 15 },
    { name: 'Survivor', level: 18 },
  ],
  'battle-master': [
    { name: 'Combat Superiority', level: 3 },
    { name: 'Student of War', level: 3 },
    { name: 'Know Your Enemy', level: 7 },
    { name: 'Improved Combat Superiority', level: 10 },
    { name: 'Relentless', level: 15 },
  ],
  // ── Monk ──
  'open-hand': [
    { name: 'Open Hand Technique', level: 3 },
    { name: 'Wholeness of Body', level: 6 },
    { name: 'Tranquility', level: 11 },
    { name: 'Quivering Palm', level: 17 },
  ],
  shadow: [
    { name: 'Shadow Arts', level: 3 },
    { name: 'Shadow Step', level: 6 },
    { name: 'Cloak of Shadows', level: 11 },
    { name: 'Opportunist', level: 17 },
  ],
  // ── Paladin ──
  devotion: [
    { name: 'Sacred Weapon', level: 3 },
    { name: 'Turn the Unholy', level: 3 },
    { name: 'Aura of Devotion', level: 7 },
    { name: 'Purity of Spirit', level: 15 },
    { name: 'Holy Nimbus', level: 20 },
  ],
  vengeance: [
    { name: 'Abjure Enemy', level: 3 },
    { name: 'Vow of Enmity', level: 3 },
    { name: 'Relentless Avenger', level: 7 },
    { name: 'Soul of Vengeance', level: 15 },
    { name: 'Avenging Angel', level: 20 },
  ],
  // ── Ranger ──
  hunter: [
    { name: "Hunter's Prey", level: 3 },
    { name: 'Defensive Tactics', level: 7 },
    { name: 'Multiattack', level: 11 },
    { name: "Superior Hunter's Defense", level: 15 },
  ],
  'beast-master': [
    { name: "Ranger's Companion", level: 3 },
    { name: 'Exceptional Training', level: 7 },
    { name: 'Bestial Fury', level: 11 },
    { name: 'Share Spells', level: 15 },
  ],
  // ── Rogue ──
  thief: [
    { name: 'Fast Hands', level: 3 },
    { name: 'Second-Story Work', level: 3 },
    { name: 'Supreme Sneak', level: 9 },
    { name: 'Use Magic Device', level: 13 },
    { name: "Thief's Reflexes", level: 17 },
  ],
  assassin: [
    { name: 'Bonus Proficiencies', level: 3 },
    { name: 'Assassinate', level: 3 },
    { name: 'Infiltration Expertise', level: 9 },
    { name: 'Impostor', level: 13 },
    { name: 'Death Strike', level: 17 },
  ],
  // ── Sorcerer ──
  draconic: [
    { name: 'Dragon Ancestor', level: 1 },
    { name: 'Draconic Resilience', level: 1 },
    { name: 'Elemental Affinity', level: 6 },
    { name: 'Dragon Wings', level: 14 },
    { name: 'Draconic Presence', level: 18 },
  ],
  'wild-magic': [
    { name: 'Wild Magic Surge', level: 1 },
    { name: 'Tides of Chaos', level: 1 },
    { name: 'Bend Luck', level: 6 },
    { name: 'Controlled Chaos', level: 14 },
    { name: 'Spell Bombardment', level: 18 },
  ],
  // ── Warlock ──
  fiend: [
    { name: "Dark One's Blessing", level: 1 },
    { name: "Dark One's Own Luck", level: 6 },
    { name: 'Fiendish Resilience', level: 10 },
    { name: 'Hurl Through Hell', level: 14 },
  ],
  'great-old-one': [
    { name: 'Awakened Mind', level: 1 },
    { name: 'Entropic Ward', level: 6 },
    { name: 'Thought Shield', level: 10 },
    { name: 'Create Thrall', level: 14 },
  ],
  // ── Wizard ──
  evocation: [
    { name: 'Evocation Savant', level: 2 },
    { name: 'Sculpt Spells', level: 2 },
    { name: 'Potent Cantrip', level: 6 },
    { name: 'Empowered Evocation', level: 10 },
    { name: 'Overchannel', level: 14 },
  ],
  abjuration: [
    { name: 'Abjuration Savant', level: 2 },
    { name: 'Arcane Ward', level: 2 },
    { name: 'Projected Ward', level: 6 },
    { name: 'Improved Abjuration', level: 10 },
    { name: 'Spell Resistance', level: 14 },
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
