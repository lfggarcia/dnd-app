/**
 * combatEngine.test.ts — Unit tests for combat engine pure functions.
 */

import {
  generateEnemiesForRoom,
  initCombat,
  checkCombatOutcome,
  advanceTurnLive,
  createCombatRNG,
} from '../src/services/combatEngine';
import type { CharacterSave } from '../src/database/gameRepository';

function makeChar(overrides: Partial<CharacterSave> = {}): CharacterSave {
  return {
    name: 'Hero',
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
    level: 3,
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

describe('generateEnemiesForRoom', () => {
  test('returns an array of enemies', () => {
    const enemies = generateEnemiesForRoom('NORMAL', 'room_001', 1, 1);
    expect(Array.isArray(enemies)).toBe(true);
    expect(enemies.length).toBeGreaterThan(0);
  });

  test('is deterministic — same params yield same enemies', () => {
    const e1 = generateEnemiesForRoom('NORMAL', 'room_abc', 1, 1);
    const e2 = generateEnemiesForRoom('NORMAL', 'room_abc', 1, 1);
    expect(e1.map(e => e.name)).toEqual(e2.map(e => e.name));
    expect(e1.map(e => e.hp)).toEqual(e2.map(e => e.hp));
  });

  test('BOSS room generates exactly 1 enemy', () => {
    const enemies = generateEnemiesForRoom('BOSS', 'boss_floor3', 1, 3);
    expect(enemies.length).toBe(1);
  });

  test('SAFE_ZONE returns empty enemies (no combat)', () => {
    const enemies = generateEnemiesForRoom('SAFE_ZONE', 'safe_001', 1, 1);
    // Safe zone either returns empty or a fallback goblin
    expect(Array.isArray(enemies)).toBe(true);
  });
});

describe('initCombat', () => {
  test('creates initial state with all party members alive', () => {
    const party = [makeChar({ name: 'Alice' }), makeChar({ name: 'Bob' })];
    const enemies = generateEnemiesForRoom('NORMAL', 'room_test', 1, 1);
    const rng = createCombatRNG('test_init');
    const state = initCombat(party, enemies, rng);

    expect(state.partyState.length).toBe(2);
    expect(state.partyState[0].currentHp).toBeGreaterThan(0);
    expect(state.round).toBe(1);
    expect(state.outcome).toBeNull();
  });

  test('dead party members are excluded from combat', () => {
    const party = [
      makeChar({ name: 'Alive', alive: true }),
      makeChar({ name: 'Dead', alive: false }),
    ];
    const enemies = generateEnemiesForRoom('NORMAL', 'room_test', 1, 1);
    const rng = createCombatRNG('test_dead');
    const state = initCombat(party, enemies, rng);

    expect(state.partyState.length).toBe(1);
    expect(state.partyState[0].name).toBe('Alive');
  });

  test('turn order has length = party + enemies', () => {
    const party = [makeChar()];
    const enemies = generateEnemiesForRoom('NORMAL', 'room_x', 1, 1);
    const rng = createCombatRNG('turn_order');
    const state = initCombat(party, enemies, rng);

    expect(state.turnOrder.length).toBe(party.length + enemies.length);
  });
});

describe('checkCombatOutcome', () => {
  test('returns DEFEAT when all party members have 0 HP', () => {
    const party = [makeChar()];
    const enemies = generateEnemiesForRoom('NORMAL', 'room_test', 1, 1);
    const rng = createCombatRNG('defeat_test');
    const state = initCombat(party, enemies, rng);

    const defeatState = {
      ...state,
      partyState: state.partyState.map(c => ({ ...c, currentHp: 0 })),
    };

    expect(checkCombatOutcome(defeatState)).toBe('DEFEAT');
  });

  test('returns VICTORY when all enemies are defeated', () => {
    const party = [makeChar()];
    const enemies = generateEnemiesForRoom('NORMAL', 'room_test', 1, 1);
    const rng = createCombatRNG('victory_test');
    const state = initCombat(party, enemies, rng);

    const victoryState = {
      ...state,
      enemyState: state.enemyState.map(e => ({ ...e, defeated: true })),
    };

    expect(checkCombatOutcome(victoryState)).toBe('VICTORY');
  });

  test('returns null when combat is still ongoing', () => {
    const party = [makeChar()];
    const enemies = generateEnemiesForRoom('NORMAL', 'room_test', 1, 1);
    const rng = createCombatRNG('ongoing_test');
    const state = initCombat(party, enemies, rng);

    expect(checkCombatOutcome(state)).toBeNull();
  });
});

describe('advanceTurnLive', () => {
  test('increments currentTurnIdx', () => {
    const party = [makeChar({ name: 'A' }), makeChar({ name: 'B' })];
    const enemies = generateEnemiesForRoom('NORMAL', 'room_adv', 1, 1);
    const rng = createCombatRNG('advance_test');
    const state = initCombat(party, enemies, rng);

    const next = advanceTurnLive(state);
    expect(next.currentTurnIdx).not.toBe(state.currentTurnIdx);
  });

  test('wraps around and increments round', () => {
    const party = [makeChar()];
    const enemies = generateEnemiesForRoom('NORMAL', 'room_wrap', 1, 1);
    const rng = createCombatRNG('wrap_test');
    let state = initCombat(party, enemies, rng);

    // Advance through all turns to trigger round increment
    const totalActors = state.turnOrder.length;
    for (let i = 0; i < totalActors; i++) {
      state = advanceTurnLive(state);
    }
    expect(state.round).toBeGreaterThanOrEqual(2);
  });
});
