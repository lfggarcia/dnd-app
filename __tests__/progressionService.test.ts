/**
 * progressionService.test.ts — Unit tests for XP and level progression.
 */

import { awardXP, getInheritedLevel, MAX_LEVEL_MVP } from '../src/services/progressionService';
import type { CharacterSave } from '../src/database/gameRepository';

// Minimal CharacterSave factory for tests
function makeChar(overrides: Partial<CharacterSave> = {}): CharacterSave {
  return {
    name: 'TestHero',
    race: 'Human',
    charClass: 'Fighter',
    subclass: '',
    background: 'Soldier',
    alignment: 'Neutral',
    baseStats: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
    hp: 45,
    maxHp: 45,
    ac: 16,
    speed: 30,
    initiative: 1,
    level: 1,
    xp: 0,
    pendingLevelUps: 0,
    alive: true,
    portrait: null,
    moralScore: 50,
    deathCount: 0,
    featureChoices: {},
    statMethod: 'standard',
    unlockedAbilities: [],
    ...overrides,
  } as CharacterSave;
}

describe('awardXP', () => {
  test('distributes XP evenly among alive party members', () => {
    const party = [
      makeChar({ name: 'A', alive: true }),
      makeChar({ name: 'B', alive: true }),
    ];
    const result = awardXP(party, 'MONSTER');
    // 25 XP / 2 alive = 12 each
    expect(result[0].xp).toBe(12);
    expect(result[1].xp).toBe(12);
  });

  test('dead characters receive no XP', () => {
    const party = [
      makeChar({ name: 'Alive', alive: true }),
      makeChar({ name: 'Dead', alive: false, xp: 0 }),
    ];
    const result = awardXP(party, 'MONSTER');
    expect(result[1].xp).toBe(0);
  });

  test('returns unchanged party when all are dead', () => {
    const party = [makeChar({ alive: false })];
    const result = awardXP(party, 'BOSS');
    expect(result[0].xp).toBe(0);
  });

  test('does not exceed MAX_LEVEL_MVP', () => {
    const party = [makeChar({ alive: true, xp: 999999, level: MAX_LEVEL_MVP })];
    const result = awardXP(party, 'BOSS');
    expect(result[0].level).toBeLessThanOrEqual(MAX_LEVEL_MVP);
  });
});

describe('getInheritedLevel', () => {
  test('returns average level of survivors (floored)', () => {
    const party = [
      makeChar({ alive: true, level: 4 }),
      makeChar({ alive: true, level: 6 }),
      makeChar({ alive: false, level: 8 }),
    ];
    // avg of survivors: (4 + 6) / 2 = 5
    expect(getInheritedLevel(party)).toBe(5);
  });

  test('returns 50% of max level when all dead (wipe penalty)', () => {
    const party = [
      makeChar({ alive: false, level: 8 }),
      makeChar({ alive: false, level: 4 }),
    ];
    // max = 8, penalty = floor(8 * 0.5) = 4
    expect(getInheritedLevel(party)).toBe(4);
  });

  test('returns minimum 1 even for empty party', () => {
    expect(getInheritedLevel([])).toBe(1);
  });

  test('floors the average correctly', () => {
    const party = [
      makeChar({ alive: true, level: 3 }),
      makeChar({ alive: true, level: 4 }),
    ];
    // avg = 3.5 → floor = 3
    expect(getInheritedLevel(party)).toBe(3);
  });
});
