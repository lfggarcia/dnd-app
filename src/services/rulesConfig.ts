/**
 * D&D 5e rules configuration for TORRE.
 * Defines which subclasses are available per class (exactly 2 each).
 */

/** Map of class index → [subclass1, subclass2] */
export const CLASS_SUBCLASS_MAP: Record<string, [string, string]> = {
  barbarian: ['berserker', 'totem-warrior'],
  bard: ['lore', 'valor'],
  cleric: ['life', 'war'],
  druid: ['land', 'moon'],
  fighter: ['champion', 'battle-master'],
  monk: ['open-hand', 'shadow'],
  paladin: ['devotion', 'vengeance'],
  ranger: ['hunter', 'beast-master'],
  rogue: ['thief', 'assassin'],
  sorcerer: ['draconic', 'wild-magic'],
  warlock: ['fiend', 'great-old-one'],
  wizard: ['evocation', 'abjuration'],
};

/** All 12 class indexes */
export const ALL_CLASSES = Object.keys(CLASS_SUBCLASS_MAP);

/** All 24 subclass indexes */
export const ALL_SUBCLASSES = Object.values(CLASS_SUBCLASS_MAP).flat();

/** Get the 2 subclass indexes for a given class */
export function getSubclassesForClass(classIndex: string): [string, string] | null {
  return CLASS_SUBCLASS_MAP[classIndex] ?? null;
}

/** Get which class a subclass belongs to */
export function getClassForSubclass(subclassIndex: string): string | null {
  for (const [classIdx, [sub1, sub2]] of Object.entries(CLASS_SUBCLASS_MAP)) {
    if (sub1 === subclassIndex || sub2 === subclassIndex) {
      return classIdx;
    }
  }
  return null;
}

/** Check if a subclass belongs to a specific class */
export function isValidSubclass(classIndex: string, subclassIndex: string): boolean {
  const subs = CLASS_SUBCLASS_MAP[classIndex];
  return subs ? subs.includes(subclassIndex) : false;
}

/**
 * Hit dice per class (used for character creation and leveling).
 */
export const CLASS_HIT_DICE: Record<string, number> = {
  barbarian: 12,
  bard: 8,
  cleric: 8,
  druid: 8,
  fighter: 10,
  monk: 8,
  paladin: 10,
  ranger: 10,
  rogue: 8,
  sorcerer: 6,
  warlock: 8,
  wizard: 6,
};

/**
 * Primary ability score per class (used for the simulation engine).
 */
export const CLASS_PRIMARY_ABILITY: Record<string, string> = {
  barbarian: 'str',
  bard: 'cha',
  cleric: 'wis',
  druid: 'wis',
  fighter: 'str',
  monk: 'dex',
  paladin: 'str',
  ranger: 'dex',
  rogue: 'dex',
  sorcerer: 'cha',
  warlock: 'cha',
  wizard: 'int',
};

/**
 * Saving throw proficiencies per class.
 */
export const CLASS_SAVING_THROWS: Record<string, [string, string]> = {
  barbarian: ['str', 'con'],
  bard: ['dex', 'cha'],
  cleric: ['wis', 'cha'],
  druid: ['int', 'wis'],
  fighter: ['str', 'con'],
  monk: ['str', 'dex'],
  paladin: ['wis', 'cha'],
  ranger: ['str', 'dex'],
  rogue: ['dex', 'int'],
  sorcerer: ['con', 'cha'],
  warlock: ['wis', 'cha'],
  wizard: ['int', 'wis'],
};

/**
 * Spellcasting classes (classes that have spell slots).
 */
export const SPELLCASTING_CLASSES = [
  'bard', 'cleric', 'druid', 'paladin', 'ranger',
  'sorcerer', 'warlock', 'wizard',
] as const;

/**
 * Maximum level available in the MVP game (CR-PS-02: single source of truth).
 * Per SYSTEMS.MD: "MAX_LEVEL MVP = 10".
 */
export const MAX_LEVEL_MVP = 10;

/**
 * XP thresholds for levels 1-20 (cumulative).
 */
export const XP_TABLE: Record<number, number> = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000,
};

/**
 * Proficiency bonus by level.
 */
export const PROFICIENCY_BONUS: Record<number, number> = {
  1: 2, 2: 2, 3: 2, 4: 2,
  5: 3, 6: 3, 7: 3, 8: 3,
  9: 4, 10: 4, 11: 4, 12: 4,
  13: 5, 14: 5, 15: 5, 16: 5,
  17: 6, 18: 6, 19: 6, 20: 6,
};

/** Get the level for a given XP total */
export function getLevelForXP(xp: number): number {
  for (let level = 20; level >= 1; level--) {
    if (xp >= XP_TABLE[level]) return level;
  }
  return 1;
}

/** Get XP needed to reach the next level */
export function getXPToNextLevel(currentXP: number): number {
  const currentLevel = getLevelForXP(currentXP);
  if (currentLevel >= 20) return 0;
  return XP_TABLE[currentLevel + 1] - currentXP;
}
