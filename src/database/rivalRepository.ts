import { getDB } from './connection';
import type { RivalEntry } from '../services/rivalGenerator';
import type { AIProfile } from '../services/aiProfileEngine';
import type { AIMemoryState } from '../services/aiMemoryService';
import type { Scalar } from '@op-engineering/op-sqlite';

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
  const sql = `INSERT OR REPLACE INTO rival_states
     (id, seed_hash, floor, rep, profile, memory, last_cycle, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  for (const r of rivals) {
    const params: Scalar[] = [
      `${seedHash}_${r.name}`,
      seedHash,
      r.floor,
      r.rep ?? 0,
      JSON.stringify('OPPORTUNISTIC' as AIProfile),
      JSON.stringify({}),
      cycle,
      now,
    ];
    db.executeSync(sql, params);
  }
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
  const sql = `INSERT OR REPLACE INTO rival_states
       (id, seed_hash, floor, rep, profile, memory, last_cycle, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  for (const r of rivals) {
    const profile = profiles[r.name] ?? 'OPPORTUNISTIC';
    const memory = memories[r.name] ?? {};
    const params: Scalar[] = [
      `${seedHash}_${r.name}`,
      seedHash,
      r.floor,
      r.rep ?? 0,
      JSON.stringify(profile),
      JSON.stringify(memory),
      cycle,
      now,
    ];
    db.executeSync(sql, params);
  }
}

export function loadRivals(seedHash: string, limit = 15): PersistedRival[] {
  const db = getDB();
  const result = db.executeSync(
    'SELECT * FROM rival_states WHERE seed_hash = ? ORDER BY floor DESC LIMIT ?',
    [seedHash, limit],
  );
  return result.rows.map(r => ({
    id: r.id as string,
    seedHash: r.seed_hash as string,
    floor: r.floor as number,
    rep: r.rep as number,
    profile: (() => { try { return JSON.parse(r.profile as string) as AIProfile; } catch { return {} as AIProfile; } })(),
    memory: (() => { try { return JSON.parse(r.memory as string) as AIMemoryState; } catch { return {} as AIMemoryState; } })(),
    lastCycle: r.last_cycle as number,
  }));
}
