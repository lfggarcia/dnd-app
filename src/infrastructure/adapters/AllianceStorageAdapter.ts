/**
 * AllianceStorageAdapter — implements IAllianceStorage (defined in ProposeAllianceUseCase).
 * Reads/writes directly to the `alliances` SQLite table (migration v10).
 *
 * Table schema:
 *   id, seed_hash, party_a, party_b, protection_fee, expires_at_cycle,
 *   status (active|expired|terminated), created_at, created_cycle
 */

import { getDB } from '../../database/connection';
import type { IAllianceStorage } from '../../application/use-cases/alliance/ProposeAllianceUseCase';
import type { AllianceProps } from '../../domain/entities/Alliance';

export class AllianceStorageAdapter implements IAllianceStorage {
  getActiveAlliances(gameId: string, seedHash: string): AllianceProps[] {
    const db = getDB();
    const result = db.executeSync(
      `SELECT * FROM alliances
       WHERE seed_hash = ? AND party_a = ? AND status = 'active'`,
      [seedHash, gameId],
    );
    return (result.rows ?? []).map(r => ({
      id: r.id as string,
      seedHash: r.seed_hash as string,
      partyA: r.party_a as string,
      partyB: r.party_b as string,
      protectionFee: r.protection_fee as number,
      expiresAtCycle: r.expires_at_cycle as number,
      status: r.status as AllianceProps['status'],
      createdCycle: r.created_cycle as number,
    }));
  }

  saveAlliance(alliance: AllianceProps): void {
    const db = getDB();
    const now = new Date().toISOString();
    db.executeSync(
      `INSERT OR REPLACE INTO alliances
         (id, seed_hash, party_a, party_b, protection_fee, expires_at_cycle,
          status, created_at, created_cycle)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        alliance.id,
        alliance.seedHash,
        alliance.partyA,
        alliance.partyB,
        alliance.protectionFee,
        alliance.expiresAtCycle,
        alliance.status,
        now,
        alliance.createdCycle,
      ],
    );
  }

  terminateAlliance(id: string): void {
    const db = getDB();
    db.executeSync(
      `UPDATE alliances SET status = 'terminated' WHERE id = ?`,
      [id],
    );
  }
}
