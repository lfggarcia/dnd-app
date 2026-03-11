/**
 * allianceService.ts
 * Gestión de alianzas/contratos de protección — Sprint 6 (doc 07).
 *
 * SYSTEMS.MD: "No existe traición arbitraria. La ruptura es contractual."
 * Las alianzas duran un número fijo de ciclos y se cobran cada ciclo.
 */

import { getDB } from '../database/connection';
import type { RivalEntry } from './rivalGenerator';

// ─── Types ────────────────────────────────────────────────

export type Alliance = {
  id: string;
  seedHash: string;
  partyA: string;           // gameId del jugador
  partyB: string;           // nombre de la party IA
  protectionFee: number;    // gold por ciclo
  expiresAtCycle: number;
  status: 'active' | 'expired' | 'terminated';
  createdCycle: number;
};

export type AllianceOffer = {
  rivalName: string;
  protectionFee: number;
  durationCycles: number;
  totalCost: number;
};

// ─── Helpers ──────────────────────────────────────────────

function rowToAlliance(row: Record<string, unknown>): Alliance {
  return {
    id: row.id as string,
    seedHash: row.seed_hash as string,
    partyA: row.party_a as string,
    partyB: row.party_b as string,
    protectionFee: row.protection_fee as number,
    expiresAtCycle: row.expires_at_cycle as number,
    status: row.status as Alliance['status'],
    createdCycle: row.created_cycle as number,
  };
}

// ─── CRUD ─────────────────────────────────────────────────

export function getActiveAlliances(gameId: string, seedHash: string): Alliance[] {
  const db = getDB();
  const result = db.executeSync(
    `SELECT * FROM alliances
     WHERE party_a = ? AND seed_hash = ? AND status = 'active'
     ORDER BY expires_at_cycle ASC`,
    [gameId, seedHash],
  );
  return (result.rows ?? []).map(r => rowToAlliance(r as Record<string, unknown>));
}

export function isAlliedWith(gameId: string, rivalName: string, seedHash: string): boolean {
  const db = getDB();
  const result = db.executeSync(
    `SELECT id FROM alliances
     WHERE party_a = ? AND party_b = ? AND seed_hash = ? AND status = 'active'`,
    [gameId, rivalName, seedHash],
  );
  return (result.rows?.length ?? 0) > 0;
}

/**
 * Crea un nuevo contrato de alianza con una party IA.
 */
export function formAlliance(
  gameId: string,
  seedHash: string,
  rivalName: string,
  protectionFee: number,
  durationCycles: number,
  currentCycle: number,
): Alliance {
  const db = getDB();
  const id = `${seedHash}_alliance_${gameId}_${rivalName}_${currentCycle}`;
  const expiresAt = currentCycle + durationCycles;

  db.executeSync(
    `INSERT INTO alliances
       (id, seed_hash, party_a, party_b, protection_fee, expires_at_cycle,
        status, created_at, created_cycle)
     VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'), ?)`,
    [id, seedHash, gameId, rivalName, protectionFee, expiresAt, currentCycle],
  );

  return {
    id, seedHash,
    partyA: gameId, partyB: rivalName,
    protectionFee, expiresAtCycle: expiresAt,
    status: 'active', createdCycle: currentCycle,
  };
}

/**
 * Termina una alianza por contrato (no traición).
 */
export function terminateAlliance(allianceId: string): void {
  const db = getDB();
  db.executeSync(
    `UPDATE alliances SET status = 'terminated' WHERE id = ?`,
    [allianceId],
  );
}

/**
 * Verifica y expira alianzas vencidas. Retorna los nombres de los aliados que expiraron.
 * Llamar desde gameStore.advanceCycle().
 */
export function expireOldAlliances(
  gameId: string,
  seedHash: string,
  currentCycle: number,
): string[] {
  const db = getDB();
  const expired = db.executeSync(
    `SELECT id, party_b FROM alliances
     WHERE party_a = ? AND seed_hash = ? AND status = 'active' AND expires_at_cycle <= ?`,
    [gameId, seedHash, currentCycle],
  );

  const expiredNames: string[] = [];
  for (const row of (expired.rows ?? [])) {
    const r = row as Record<string, unknown>;
    db.executeSync(
      `UPDATE alliances SET status = 'expired' WHERE id = ?`,
      [r.id as string],
    );
    expiredNames.push(r.party_b as string);
  }

  return expiredNames;
}

/**
 * Cobra la cuota de protección del ciclo actual.
 * Retorna el gold total a descontar.
 */
export function chargeAllianceFees(gameId: string, seedHash: string): number {
  const alliances = getActiveAlliances(gameId, seedHash);
  return alliances.reduce((total, a) => total + a.protectionFee, 0);
}

// ─── Evaluación IA ────────────────────────────────────────

/**
 * SYSTEMS.MD: "La IA evalúa si atacar/aliarse conviene más que confrontar."
 */
export function evaluateAllianceOffer(
  offer: AllianceOffer,
  rival: RivalEntry,
  playerBountyLevel: number,
): { accepts: boolean; counterOffer?: AllianceOffer } {
  const desiredFee = rival.floor * 30;
  void playerBountyLevel; // reservado para futura lógica de riesgo

  if (offer.protectionFee >= desiredFee * 0.9) {
    return { accepts: true };
  }

  if (offer.protectionFee >= desiredFee * 0.5) {
    return {
      accepts: false,
      counterOffer: {
        rivalName: offer.rivalName,
        protectionFee: desiredFee,
        durationCycles: offer.durationCycles,
        totalCost: desiredFee * offer.durationCycles,
      },
    };
  }

  return { accepts: false };
}
