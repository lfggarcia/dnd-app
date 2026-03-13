/**
 * migrations.test.ts — DB migration system tests.
 * Verifies that runMigrations runs all 17 versions without throwing
 * and that the schema_version table is maintained correctly.
 */

// ─── Mock @op-engineering/op-sqlite ──────────────────────────────────────────

const executedSQL: string[] = [];
let mockVersion = 0;

const mockDB = {
  executeSync: jest.fn((sql: string, params?: unknown[]) => {
    executedSQL.push(sql.trim().substring(0, 80));

    if (sql.includes('SELECT MAX(version)')) {
      return { rows: [{ v: mockVersion }] };
    }
    if (sql.includes('INSERT INTO schema_version') && params) {
      mockVersion = params[0] as number;
    }
    return { rows: [] };
  }),
};

jest.mock('@op-engineering/op-sqlite', () => ({
  open: jest.fn(() => mockDB),
}));

// Stub the connection module to return our mockDB
jest.mock('../src/database/connection', () => ({
  getDB: () => mockDB,
  initDB: jest.fn(),
}));

import { runMigrations } from '../src/database/migrations';

describe('runMigrations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    executedSQL.length = 0;
    mockVersion = 0;
    mockDB.executeSync.mockImplementation((sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT MAX(version)')) {
        return { rows: [{ v: mockVersion }] };
      }
      if (sql.includes('INSERT INTO schema_version') && params) {
        mockVersion = params[0] as number;
      }
      return { rows: [] };
    });
  });

  test('runs without throwing when DB is at version 0', () => {
    expect(() => runMigrations()).not.toThrow();
  });

  test('skips migrations when already at CURRENT_VERSION (17)', () => {
    mockDB.executeSync.mockImplementation((sql: string) => {
      if (sql.includes('SELECT MAX(version)')) {
        return { rows: [{ v: 17 }] };
      }
      return { rows: [] };
    });

    runMigrations();

    // Should not have called BEGIN TRANSACTION (no migrations to run)
    const calls = mockDB.executeSync.mock.calls.map((c: unknown[]) => c[0] as string);
    const transactionCalls = calls.filter((s: string) => s.includes('BEGIN TRANSACTION'));
    expect(transactionCalls.length).toBe(0);
  });

  test('creates schema_version table on every run', () => {
    runMigrations();
    const calls = mockDB.executeSync.mock.calls.map((c: unknown[]) => c[0] as string);
    const createCalls = calls.filter((s: string) => s.includes('CREATE TABLE IF NOT EXISTS schema_version'));
    expect(createCalls.length).toBeGreaterThanOrEqual(1);
  });

  test('wraps each migration version in a transaction', () => {
    runMigrations();
    const calls = mockDB.executeSync.mock.calls.map((c: unknown[]) => c[0] as string);
    const beginCalls = calls.filter((s: string) => s.includes('BEGIN TRANSACTION'));
    const commitCalls = calls.filter((s: string) => s.includes('COMMIT'));
    // 17 versions → 17 begin + 17 commit
    expect(beginCalls.length).toBe(17);
    expect(commitCalls.length).toBe(17);
  });

  test('rolls back and rethrows on migration error', () => {
    let callCount = 0;
    mockDB.executeSync.mockImplementation((sql: string) => {
      if (sql.includes('SELECT MAX(version)')) {
        return { rows: [{ v: 0 }] };
      }
      callCount++;
      // Fail on the first CREATE TABLE inside a migration (after schema_version + SELECT)
      if (callCount > 3 && sql.includes('CREATE TABLE')) {
        throw new Error('Simulated DB error');
      }
      return { rows: [] };
    });

    expect(() => runMigrations()).toThrow('Simulated DB error');

    const calls = mockDB.executeSync.mock.calls.map((c: unknown[]) => c[0] as string);
    const rollbackCalls = calls.filter((s: string) => s.includes('ROLLBACK'));
    expect(rollbackCalls.length).toBeGreaterThanOrEqual(1);
  });
});
