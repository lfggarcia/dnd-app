/**
 * SqliteRivalRepository — concrete implementation of IRivalRepository.
 * Delegates to src/database/rivalRepository.ts.
 */

import {
  loadRivals as dbLoadRivals,
  saveRivals as dbSaveRivals,
  type PersistedRival,
} from '../../database/rivalRepository';
import { getDB } from '../../database/connection';
import type { IRivalRepository, RivalData } from '../../domain/repositories/IRivalRepository';

function persistedRivalToData(r: PersistedRival): RivalData {
  return {
    id: r.id,
    seedHash: r.seedHash,
    name: r.id.replace(`${r.seedHash}_`, ''), // ID format: `${seedHash}_${name}`
    floor: r.floor,
    rep: r.rep,
    profile: JSON.stringify(r.profile),
    memory: JSON.stringify(r.memory),
    lastCycle: r.lastCycle,
    updatedAt: new Date().toISOString(), // not persisted separately; approximation
  };
}

export class SqliteRivalRepository implements IRivalRepository {
  findBySeed(seedHash: string): RivalData[] {
    return dbLoadRivals(seedHash).map(persistedRivalToData);
  }

  findById(id: string): RivalData | null {
    const db = getDB();
    const result = db.executeSync(
      'SELECT * FROM rival_states WHERE id = ?',
      [id],
    );
    const r = result.rows?.[0];
    if (!r) return null;
    return {
      id: r.id as string,
      seedHash: r.seed_hash as string,
      name: (r.id as string).replace(`${r.seed_hash as string}_`, ''),
      floor: r.floor as number,
      rep: r.rep as number,
      profile: r.profile as string,
      memory: r.memory as string,
      lastCycle: r.last_cycle as number,
      updatedAt: r.updated_at as string,
    };
  }

  save(rivals: RivalData[]): void {
    if (rivals.length === 0) return;
    const db = getDB();
    const now = new Date().toISOString();
    const sql = `INSERT OR REPLACE INTO rival_states
       (id, seed_hash, floor, rep, profile, memory, last_cycle, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    for (const r of rivals) {
      db.executeSync(sql, [r.id, r.seedHash, r.floor, r.rep, r.profile, r.memory, r.lastCycle, now]);
    }
  }

  delete(id: string): void {
    const db = getDB();
    db.executeSync('DELETE FROM rival_states WHERE id = ?', [id]);
  }

  deleteAllBySeed(seedHash: string): void {
    const db = getDB();
    db.executeSync('DELETE FROM rival_states WHERE seed_hash = ?', [seedHash]);
  }
}
