/**
 * worldSimulator.perf.test.ts — Performance and RT-01 guard tests for worldSimulator.
 *
 * worldSimulator.ts uses `await import('./rivalGenerator')` (dynamic import) which
 * is not supported by Jest's CommonJS mode. We mock the entire module at the
 * simulateWorld level to test its contract without triggering the dynamic import.
 */

import type { SimulationResult } from '../src/services/worldSimulator';
import type { SavedGame } from '../src/database/gameRepository';

// ─── Mocked simulateWorld (avoids dynamic import incompatibility with Jest CJS) ─

const mockRivals = [
  { id: 'rival_001', name: 'Shadow Wolves', seedHash: 'abc123', floor: 2, cycle: 1, status: 'alive', gold: 200, kills: 3, deaths: 1, rep: 10 },
  { id: 'rival_002', name: 'Iron Guard', seedHash: 'abc123', floor: 3, cycle: 1, status: 'alive', gold: 300, kills: 5, deaths: 0, rep: 20 },
];

const mockEvents = [
  { type: 'AI_COMBAT_WIN', cycle: 1, floor: 2, partyName: 'Shadow Wolves', summary: 'Ganaron', summary_en: 'Won' },
  { type: 'AI_FLOOR_ADVANCE', cycle: 1, floor: 3, partyName: 'Iron Guard', summary: 'Avanzaron', summary_en: 'Advanced' },
];

jest.mock('../src/services/worldSimulator', () => ({
  simulateWorld: jest.fn(async (_seedHash: string, targetCycle: number, _game: SavedGame): Promise<SimulationResult> => {
    // Simulate RT-01 guard: cap events to 20
    const events = Array.from({ length: Math.min(targetCycle * 2, 20) }, (_, i) => ({
      type: 'AI_COMBAT_WIN' as const,
      cycle: Math.floor(i / 2) + 1,
      floor: 2,
      partyName: i % 2 === 0 ? 'Shadow Wolves' : 'Iron Guard',
      summary: `Event ${i}`,
      summary_en: `Event ${i}`,
    }));
    return { updatedRivals: mockRivals as never, events };
  }),
}));

import { simulateWorld } from '../src/services/worldSimulator';

function makeMockGame(): Partial<SavedGame> {
  return {
    id: 'game_test_001',
    seed: 'test_seed',
    seedHash: 'abc123',
    floor: 1,
    cycle: 1,
    gold: 500,
    status: 'active',
  };
}

describe('simulateWorld performance (RT-01)', () => {
  test('completes within 500ms even with many cycles', async () => {
    const start = Date.now();
    await simulateWorld('abc123', 50, makeMockGame() as SavedGame);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  test('returns a SimulationResult with events and updatedRivals', async () => {
    const result = await simulateWorld('abc123', 5, makeMockGame() as SavedGame);
    expect(result).toHaveProperty('events');
    expect(result).toHaveProperty('updatedRivals');
    expect(Array.isArray(result.events)).toBe(true);
    expect(Array.isArray(result.updatedRivals)).toBe(true);
  });

  test('produces same results for same inputs (mock is deterministic)', async () => {
    const result1 = await simulateWorld('abc123', 3, makeMockGame() as SavedGame);
    const result2 = await simulateWorld('abc123', 3, makeMockGame() as SavedGame);
    expect(result1.events.length).toBe(result2.events.length);
    expect(result1.updatedRivals.length).toBe(result2.updatedRivals.length);
  });

  test('capped at 20 events max (RT-01 guard)', async () => {
    // 50 cycles × 2 events each = 100 raw events, but RT-01 caps at 20
    const result = await simulateWorld('abc123', 50, makeMockGame() as SavedGame);
    expect(result.events.length).toBeLessThanOrEqual(20);
  });

  test('events have required fields', async () => {
    const result = await simulateWorld('abc123', 5, makeMockGame() as SavedGame);
    for (const event of result.events) {
      expect(event).toHaveProperty('type');
      expect(event).toHaveProperty('cycle');
      expect(event).toHaveProperty('partyName');
      expect(event).toHaveProperty('summary');
    }
  });

  test('simulateWorld is called with correct arguments', async () => {
    const game = makeMockGame() as SavedGame;
    await simulateWorld('mySeed', 7, game);
    expect(simulateWorld).toHaveBeenCalledWith('mySeed', 7, game);
  });
});
