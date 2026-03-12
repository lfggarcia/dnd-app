/**
 * lootService.test.ts — Unit tests for loot generation.
 */

// Mock the DB dependency used by isBossLootClaimed inside lootService
jest.mock('../src/database/itemRepository', () => ({
  isBossLootClaimed: jest.fn().mockReturnValue(false),
  calculateItemPrice: jest.fn((base: number) => base),
}));

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

import { generateRoomLoot, generateBossUniqueLoot } from '../src/services/lootService';

describe('generateRoomLoot', () => {
  test('returns an array (may be empty for low chance)', () => {
    const drops = generateRoomLoot('room_001', 'NORMAL', 1, 1, 'seed123');
    expect(Array.isArray(drops)).toBe(true);
  });

  test('same params always produce the same result (deterministic)', () => {
    const drops1 = generateRoomLoot('room_abc', 'BOSS', 3, 2, 'myhash');
    const drops2 = generateRoomLoot('room_abc', 'BOSS', 3, 2, 'myhash');
    expect(drops1).toEqual(drops2);
  });

  test('different roomIds produce different drops', () => {
    const drops1 = generateRoomLoot('room_001', 'NORMAL', 1, 1, 'seed');
    const drops2 = generateRoomLoot('room_999', 'NORMAL', 1, 1, 'seed');
    // High probability of being different (not guaranteed, but statistically)
    const ids1 = drops1.map(d => d.id).join(',');
    const ids2 = drops2.map(d => d.id).join(',');
    expect(ids1).not.toBe(ids2);
  });

  test('each drop has required fields', () => {
    // Use BOSS for higher chance of drops
    const drops = generateRoomLoot('boss_room', 'BOSS', 5, 1, 'seedA');
    for (const drop of drops) {
      expect(drop).toHaveProperty('id');
      expect(drop).toHaveProperty('name');
      expect(drop).toHaveProperty('type');
      expect(drop).toHaveProperty('rarity');
      expect(drop).toHaveProperty('goldValue');
    }
  });
});

describe('generateBossUniqueLoot', () => {
  test('returns a LootDrop with unique rarity', () => {
    const drop = generateBossUniqueLoot('seed_test', 'boss_floor3', 3);
    expect(drop).not.toBeNull();
    expect(drop?.rarity).toBe('unique');
    expect(drop?.type).toBe('boss_loot');
  });

  test('is deterministic for same seed + bossRoomId', () => {
    const drop1 = generateBossUniqueLoot('myseed', 'boss_001', 1);
    const drop2 = generateBossUniqueLoot('myseed', 'boss_001', 1);
    expect(drop1).toEqual(drop2);
  });

  test('returns null when boss loot already claimed', () => {
    const { isBossLootClaimed } = require('../src/database/itemRepository');
    (isBossLootClaimed as jest.Mock).mockReturnValueOnce(true);
    const drop = generateBossUniqueLoot('seed_test', 'boss_claimed', 1);
    expect(drop).toBeNull();
  });

  test('goldValue scales with floor', () => {
    const floor1 = generateBossUniqueLoot('scale_seed', 'boss_room', 1);
    const floor10 = generateBossUniqueLoot('scale_seed', 'boss_room', 10);
    if (floor1 && floor10) {
      expect(floor10.goldValue).toBeGreaterThan(floor1.goldValue);
    }
  });
});
