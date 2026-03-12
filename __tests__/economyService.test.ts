/**
 * economyService.test.ts — Unit tests for gold/economy formulas.
 */

import {
  calculateReviveCost,
  calculateItemPrice,
  calculateSellValue,
  calculateInnCost,
  calculateRoomGold,
  REVIVE_BASE_COST,
} from '../src/services/economyService';

describe('calculateReviveCost', () => {
  test('base cost at level 1 with 0 deaths is REVIVE_BASE_COST', () => {
    const result = calculateReviveCost({ level: 1, deathCount: 0, alive: false }, 1000);
    expect(result.cost).toBe(REVIVE_BASE_COST);
  });

  test('scales with level', () => {
    const lv1 = calculateReviveCost({ level: 1, deathCount: 0, alive: false }, 1000);
    const lv4 = calculateReviveCost({ level: 4, deathCount: 0, alive: false }, 1000);
    expect(lv4.cost).toBe(lv1.cost * 4);
  });

  test('scales with death count (15% per death)', () => {
    const zero = calculateReviveCost({ level: 1, deathCount: 0, alive: false }, 1000);
    const one  = calculateReviveCost({ level: 1, deathCount: 1, alive: false }, 1000);
    expect(one.cost).toBe(Math.round(REVIVE_BASE_COST * 1 * 1.15));
  });

  test('canAfford is true when gold >= cost', () => {
    const result = calculateReviveCost({ level: 1, deathCount: 0, alive: false }, 1000);
    expect(result.canAfford).toBe(true);
  });

  test('canAfford is false when gold < cost', () => {
    const result = calculateReviveCost({ level: 5, deathCount: 0, alive: false }, 10);
    expect(result.canAfford).toBe(false);
  });
});

describe('calculateItemPrice', () => {
  test('common rarity has multiplier 1', () => {
    const price = calculateItemPrice(100, 'common', 0);
    expect(price).toBe(100); // 100 * 1 * (1 + 0) = 100
  });

  test('unique rarity is 20x base', () => {
    const price = calculateItemPrice(100, 'unique', 0);
    expect(price).toBe(2000);
  });

  test('floor increases price', () => {
    const floor0 = calculateItemPrice(100, 'common', 0);
    const floor10 = calculateItemPrice(100, 'common', 10);
    expect(floor10).toBeGreaterThan(floor0);
  });
});

describe('calculateSellValue', () => {
  test('returns 60% of goldValue', () => {
    expect(calculateSellValue({ goldValue: 100 })).toBe(60);
    expect(calculateSellValue({ goldValue: 50 })).toBe(30);
  });

  test('floors the result', () => {
    expect(calculateSellValue({ goldValue: 1 })).toBe(0); // floor(0.6)
  });
});

describe('calculateInnCost', () => {
  test('floor 1 costs REST_INN_COST', () => {
    const base = calculateInnCost(1);
    expect(base).toBe(50);
  });

  test('scales every 10 floors', () => {
    expect(calculateInnCost(10)).toBe(50);  // floor(10/10)=1 → 50*1
    expect(calculateInnCost(20)).toBe(100); // floor(20/10)=2 → 50*2
  });
});

describe('calculateRoomGold', () => {
  test('floor 1 NORMAL gives 10 gold', () => {
    expect(calculateRoomGold(1, 'NORMAL')).toBe(10);
  });

  test('BOSS gives 5x normal gold', () => {
    const normal = calculateRoomGold(1, 'NORMAL');
    const boss   = calculateRoomGold(1, 'BOSS');
    expect(boss).toBe(normal * 5);
  });

  test('gold scales with floor', () => {
    const floor1 = calculateRoomGold(1, 'NORMAL');
    const floor5 = calculateRoomGold(5, 'NORMAL');
    expect(floor5).toBeGreaterThan(floor1);
  });
});
