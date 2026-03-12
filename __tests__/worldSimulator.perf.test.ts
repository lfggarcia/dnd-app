/**
 * worldSimulator.perf.test.ts — Performance and correctness tests for worldSimulator.
 * Validates that the RT-01 time limit guard works correctly.
 */

// Mock the dynamic import of rivalGenerator and the db
jest.mock('../src/services/rivalGenerator', () => ({
  generateRivals: jest.fn().mockReturnValue([
    {
      id: 'rival_001',
      name: 'Shadow Wolves',
      seedHash: 'abc123',
      floor: 2,
      cycle: 1,
      status: 'alive',
      gold: 200,
      kills: 3,
      deaths: 1,
      profileTag: 'AGGRESSIVE',
    },
    {
      id: 'rival_002',
      name: 'Iron Guard',
      seedHash: 'abc123',
      floor: 3,
      cycle: 1,
      status: 'alive',
      gold: 300,
      kills: 5,
      deaths: 0,
      profileTag: 'DEFENSIVE',
    },
  ]),
}));

jest.mock('../src/database', () => ({
  createWorldEvent: jest.fn(),
  getWorldEventsBySeed: jest.fn().mockReturnValue([]),
  createBounty: jest.fn(),
  getActiveBounties: jest.fn().mockReturnValue([]),
}));

import { simulateWorld } from '../src/services/worldSimulator';
import type { SavedGame } from '../src/database/gameRepository';

function makeMockGame(overrides: Partial<SavedGame> = {}): SavedGame {
  return {
    id: 'game_test_001',
    seed: 'test_seed',
    seedHash: 'abc123',
    partyData: [],
    floor: 1,
    cycle: 1,
    cycleRaw: 1,
    phase: 'DAY',
    gold: 500,
    status: 'active',
    location: 'VILLAGE',
    highestFloor: 1,
    mapState: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as SavedGame;
}

describe('simulateWorld performance (RT-01)', () => {
  test('completes within 500ms even with many cycles', async () => {
    const game = makeMockGame();
    const start = Date.now();
    await simulateWorld('abc123', 50, game);
    const elapsed = Date.now() - start;
    // Should be well under 500ms due to RT-01 guard
    expect(elapsed).toBeLessThan(500);
  });

  test('returns a SimulationResult with events and updatedRivals', async () => {
    const game = makeMockGame();
    const result = await simulateWorld('abc123', 5, game);
    expect(result).toHaveProperty('events');
    expect(result).toHaveProperty('updatedRivals');
    expect(Array.isArray(result.events)).toBe(true);
    expect(Array.isArray(result.updatedRivals)).toBe(true);
  });

  test('produces deterministic results for same seed and cycle', async () => {
    const game = makeMockGame();
    const result1 = await simulateWorld('abc123', 3, game);
    const result2 = await simulateWorld('abc123', 3, game);
    // Events and rival counts should match
    expect(result1.events.length).toBe(result2.events.length);
    expect(result1.updatedRivals.length).toBe(result2.updatedRivals.length);
  });

  test('events have required fields', async () => {
    const game = makeMockGame();
    const result = await simulateWorld('abc123', 5, game);
    for (const event of result.events) {
      expect(event).toHaveProperty('type');
      expect(event).toHaveProperty('cycle');
      expect(event).toHaveProperty('partyName');
      expect(event).toHaveProperty('summary');
    }
  });
});
