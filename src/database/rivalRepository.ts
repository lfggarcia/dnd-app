import { getDB } from './connection';
import type { RivalEntry } from '../services/rivalGenerator';
import type { AIProfile } from '../services/aiProfileEngine';
import type { AIMemoryState } from '../services/aiMemoryService';

export interface PersistedRival {
  id: string;
  seedHash: string;
  floor: number;
  rep: number;
  profile: AIProfile;
  memory: AIMemoryState;
  lastCycle: number;
}

export function saveRivals(seedHash: string, rivals: RivalEntry[], cycle: number): void {
  if (rivals.length === 0) return;
  const db = getDB();
  const now = new Date().toISOString();
  // op-sqlite: use executeBatch for multiple INSERTs — one native call vs N calls
  db.executeBatch(
    rivals.map(r => [
      `INSERT OR REPLACE INTO rival_states
       (id, seed_hash, floor, rep, profile, memory, last_cycle, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `${seedHash}_${r.name}`,
        seedHash,
        r.floor,
        r.rep ?? 0,
        JSON.stringify('OPPORTUNISTIC' as AIProfile),
        JSON.stringify({}),
        cycle,
        now,
      ],
    ] as [string, unknown[]]),
  );
}

export function saveRivalsWithState(
  seedHash: string,
  rivals: RivalEntry[],
  profiles: Record<string, AIProfile>,
  memories: Record<string, AIMemoryState>,
  cycle: number,
): void {
  if (rivals.length === 0) return;
  const db = getDB();
  const now = new Date().toISOString();
  // op-sqlite: use executeBatch — one native call vs N calls (Best Practices § 6.3)
  db.executeBatch(
    rivals.map(r => {
      const profile = profiles[r.name] ?? 'OPPORTUNISTIC';
      const memory = memories[r.name] ?? {};
      return [
        `INSERT OR REPLACE INTO rival_states
         (id, seed_hash, floor, rep, profile, memory, last_cycle, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `${seedHash}_${r.name}`,
          seedHash,
          r.floor,
          r.rep ?? 0,
          JSON.stringify(profile),
          JSON.stringify(memory),
          cycle,
          now,
        ],
      ] as [string, unknown[]];
    }),
  );
}

export function loadRivals(seedHash: string): PersistedRival[] {
  const db = getDB();
  const rows = db.execute(
    'SELECT * FROM rival_states WHERE seed_hash = ? ORDER BY floor ASC',
    [seedHash],
  ).rows;
  return rows.map(r => ({
    id: r.id as string,
    seedHash: r.seed_hash as string,
    floor: r.floor as number,
    rep: r.rep as number,
    profile: JSON.parse(r.profile as string) as AIProfile,
    memory: JSON.parse(r.memory as string) as AIMemoryState,
    lastCycle: r.last_cycle as number,
  }));
}
