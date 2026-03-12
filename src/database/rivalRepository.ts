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
  const db = getDB();
  const now = new Date().toISOString();
  for (const r of rivals) {
    db.execute(
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
    );
  }
}

export function saveRivalsWithState(
  seedHash: string,
  rivals: RivalEntry[],
  profiles: Record<string, AIProfile>,
  memories: Record<string, AIMemoryState>,
  cycle: number,
): void {
  const db = getDB();
  const now = new Date().toISOString();
  for (const r of rivals) {
    const profile = profiles[r.name] ?? 'OPPORTUNISTIC';
    const memory = memories[r.name] ?? {};
    db.execute(
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
    );
  }
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
