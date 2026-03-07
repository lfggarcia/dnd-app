// Pure D&D 5e stat utilities — no React, no state, safe to import anywhere.
import type { Stats } from '../database/gameRepository';
import { SUBCLASS_FEATURES, LVL1_RULES, type FeatureEntry } from '../constants/dnd5eLevel1';

export const STAT_KEYS: (keyof Stats)[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export const ALIGNMENT_ORDER = [
  'lawful-good', 'neutral-good', 'chaotic-good',
  'lawful-neutral', 'neutral', 'chaotic-neutral',
  'lawful-evil', 'neutral-evil', 'chaotic-evil',
];

export const CLASS_STAT_PRIORITY: Record<string, (keyof Stats)[]> = {
  barbarian: ['STR', 'CON', 'DEX', 'WIS', 'CHA', 'INT'],
  bard:      ['CHA', 'DEX', 'CON', 'WIS', 'INT', 'STR'],
  cleric:    ['WIS', 'CON', 'STR', 'DEX', 'CHA', 'INT'],
  druid:     ['WIS', 'CON', 'DEX', 'INT', 'CHA', 'STR'],
  fighter:   ['STR', 'CON', 'DEX', 'WIS', 'CHA', 'INT'],
  monk:      ['DEX', 'WIS', 'CON', 'STR', 'CHA', 'INT'],
  paladin:   ['STR', 'CHA', 'CON', 'WIS', 'DEX', 'INT'],
  ranger:    ['DEX', 'WIS', 'CON', 'STR', 'INT', 'CHA'],
  rogue:     ['DEX', 'CON', 'WIS', 'CHA', 'INT', 'STR'],
  sorcerer:  ['CHA', 'CON', 'DEX', 'WIS', 'INT', 'STR'],
  warlock:   ['CHA', 'CON', 'DEX', 'WIS', 'INT', 'STR'],
  wizard:    ['INT', 'CON', 'DEX', 'WIS', 'CHA', 'STR'],
};

const RACE_NAMES: Record<string, string[]> = {
  human:       ['Aldric', 'Beric', 'Caden', 'Dorian', 'Edric', 'Freya', 'Gareth', 'Hilda', 'Iria', 'Jorah', 'Kira', 'Lorn'],
  elf:         ['Aelindra', 'Caladrel', 'Elendir', 'Faendal', 'Ilyana', 'Liriel', 'Naeris', 'Quellin', 'Sylara', 'Taeral'],
  dwarf:       ['Bofri', 'Durgin', 'Fargrim', 'Gimral', 'Harnoth', 'Ildrak', 'Korrak', 'Marduk', 'Norgrim', 'Tordak'],
  halfling:    ['Cade', 'Cordo', 'Eldon', 'Garret', 'Lindin', 'Merric', 'Osborn', 'Perrin', 'Rosie', 'Tobias'],
  'half-orc':  ['Dench', 'Feng', 'Gell', 'Henk', 'Imsh', 'Keth', 'Krusk', 'Mhurren', 'Ront', 'Thokk'],
  tiefling:    ['Akmenos', 'Amnon', 'Barakas', 'Damakos', 'Ekemon', 'Iados', 'Kairon', 'Leucis', 'Mordai', 'Skamos'],
  dragonborn:  ['Arjhan', 'Balasar', 'Bharash', 'Donaar', 'Ghesh', 'Heskan', 'Kriv', 'Medrash', 'Rhogar', 'Torinn'],
  gnome:       ['Alston', 'Alvyn', 'Boddynock', 'Brocc', 'Dimble', 'Eldon', 'Erky', 'Fonkin', 'Gerbo', 'Gimble'],
  'half-elf':  ['Aelith', 'Briana', 'Corvan', 'Dara', 'Elysia', 'Faramir', 'Gaerlan', 'Haelra', 'Ilris', 'Jaeron'],
};

export function assignStandardArray(classIndex: string): Stats {
  const priority = CLASS_STAT_PRIORITY[classIndex] || STAT_KEYS;
  const stats: Stats = { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 };
  priority.forEach((key, i) => { stats[key] = STANDARD_ARRAY[i]; });
  return stats;
}

function roll4d6DropLowest(): number {
  const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  dice.sort((a, b) => a - b);
  return dice[1] + dice[2] + dice[3];
}

export function generateValidRolledStats(): Stats {
  for (let i = 0; i < 100; i++) {
    const stats: Stats = {
      STR: roll4d6DropLowest(), DEX: roll4d6DropLowest(), CON: roll4d6DropLowest(),
      INT: roll4d6DropLowest(), WIS: roll4d6DropLowest(), CHA: roll4d6DropLowest(),
    };
    const total = STAT_KEYS.reduce((sum, k) => sum + stats[k], 0);
    if (total >= LVL1_RULES.MIN_ROLL_TOTAL && total <= LVL1_RULES.MAX_ROLL_TOTAL) return stats;
  }
  return assignStandardArray('fighter');
}

export function getRacialBonuses(raceRaw: Record<string, unknown>): Partial<Stats> {
  const bonuses: Partial<Stats> = {};
  const ab = raceRaw.ability_bonuses as
    | Array<{ ability_score: { index: string }; bonus: number }>
    | undefined;
  if (ab) {
    for (const b of ab) {
      const key = b.ability_score.index.toUpperCase() as keyof Stats;
      if (STAT_KEYS.includes(key)) bonuses[key] = b.bonus;
    }
  }
  return bonuses;
}

export function computeFinalStats(base: Stats, racial: Partial<Stats>): Stats {
  const s = { ...base };
  for (const k of STAT_KEYS) s[k] = Math.min(20, s[k] + (racial[k] || 0));
  return s;
}

export function getDescFromRaw(raw: Record<string, unknown>): string {
  const d = raw.desc;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.join(' ');
  return '';
}

export function getSubclassFeatures(idx: string): FeatureEntry[] {
  return SUBCLASS_FEATURES[idx] || [];
}

export function pickRaceName(raceIndex: string): string {
  const pool = RACE_NAMES[raceIndex] ?? RACE_NAMES.human;
  return pool[Math.floor(Math.random() * pool.length)];
}
