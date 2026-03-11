/**
 * bountyService.ts
 * Sistema de recompensas por violencia — Sprint 6 (doc 05).
 *
 * SYSTEMS.MD: "El historial de violencia es PERMANENTE. No existe redención automática."
 * Los bounties se acumulan conforme el jugador elimina parties rivales.
 */

import { getDB } from '../database/connection';

// ─── Types ────────────────────────────────────────────────

export type BountyRecord = {
  id: string;
  seedHash: string;
  targetGameId: string;
  rewardAmount: number;
  bountyLevel: number;  // 0–5
  isActive: boolean;
  killCount: number;
};

// ─── Umbrales ─────────────────────────────────────────────

const BOUNTY_THRESHOLDS = [
  { kills: 1,  level: 1, reward: 200,   label: 'SOSPECHOSO' },
  { kills: 3,  level: 2, reward: 500,   label: 'BUSCADO' },
  { kills: 5,  level: 3, reward: 1200,  label: 'PELIGROSO' },
  { kills: 8,  level: 4, reward: 3000,  label: 'MUY_PELIGROSO' },
  { kills: 12, level: 5, reward: 7500,  label: 'ASESINO_EN_SERIE' },
];

// ─── Helpers ──────────────────────────────────────────────

function rowToBounty(row: Record<string, unknown>): BountyRecord {
  return {
    id: row.id as string,
    seedHash: row.seed_hash as string,
    targetGameId: row.target_game_id as string,
    rewardAmount: row.reward_amount as number,
    bountyLevel: row.bounty_level as number,
    isActive: Boolean(row.is_active),
    killCount: row.kill_count as number,
  };
}

// ─── CRUD ─────────────────────────────────────────────────

export function getBounty(gameId: string, seedHash: string): BountyRecord | null {
  const db = getDB();
  const result = db.executeSync(
    'SELECT * FROM bounties WHERE target_game_id = ? AND seed_hash = ? AND is_active = 1',
    [gameId, seedHash],
  );
  const row = result.rows?.[0] as Record<string, unknown> | undefined;
  return row ? rowToBounty(row) : null;
}

/**
 * Se llama CADA VEZ que el jugador elimina una party rival.
 * Registra el evento y actualiza/crea el bounty.
 */
export function recordPartyKill(
  gameId: string,
  seedHash: string,
  victimName: string,
  cycle: number,
  floor: number,
): BountyRecord {
  const db = getDB();

  // Registrar el evento (permanente e idempotente)
  const eventId = `${seedHash}_kill_${cycle}_${victimName}`;
  db.executeSync(
    `INSERT OR IGNORE INTO events
       (id, seed_hash, type, floor, cycle, party_name, target_name, data, created_at)
     VALUES (?, ?, 'PARTY_KILL', ?, ?, 'PLAYER', ?, '{}', datetime('now'))`,
    [eventId, seedHash, floor, cycle, victimName],
  );

  let bounty = getBounty(gameId, seedHash);

  if (!bounty) {
    const id = `${seedHash}_bounty_${gameId}`;
    db.executeSync(
      `INSERT INTO bounties
         (id, seed_hash, target_game_id, issued_by, reward_amount, bounty_level,
          is_active, kill_count, created_at, updated_at)
       VALUES (?, ?, ?, 'GUILD', 200, 1, 1, 1, datetime('now'), datetime('now'))`,
      [id, seedHash, gameId],
    );
    bounty = getBounty(gameId, seedHash)!;
  } else {
    const newKills = bounty.killCount + 1;
    const threshold = BOUNTY_THRESHOLDS
      .filter(t => t.kills <= newKills)
      .reduce((best, t) => t.level > best.level ? t : best, BOUNTY_THRESHOLDS[0]);

    db.executeSync(
      `UPDATE bounties
       SET kill_count = ?, bounty_level = ?, reward_amount = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [newKills, threshold.level, threshold.reward, bounty.id],
    );
    bounty = getBounty(gameId, seedHash)!;
  }

  return bounty;
}

// ─── Cálculos ─────────────────────────────────────────────

/**
 * SYSTEMS.MD: "BountyRiskMultiplier = 1 + (BountyLevel × 0.2)"
 */
export function getBountyRiskMultiplier(bountyLevel: number): number {
  return 1 + bountyLevel * 0.2;
}

/**
 * Label visible del bounty para la UI.
 */
export function getBountyLabel(bountyLevel: number): string {
  return BOUNTY_THRESHOLDS.find(t => t.level === bountyLevel)?.label ?? 'LIMPIO';
}
