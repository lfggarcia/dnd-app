/**
 * safeZoneService.ts
 * Lógica de zonas seguras en el dungeon — Sprint 6 (doc 11).
 *
 * Las zonas seguras son nodos especiales donde la party puede gestionar personajes.
 * Siempre hay una antes de cada boss. Aparecen cada 8–12 salas.
 */

import { makePRNG } from '../utils/prng';

// ─── Detección de zona segura ─────────────────────────────

/**
 * Determina si un nodo del dungeon debe ser una zona segura.
 * REGLAS:
 *   - Siempre antes de un boss (ids con '_preboss')
 *   - Cada 8–12 salas (determinístico por seed)
 *   - No son la sala inicial ni la de extracción
 */
export function isSafeZoneNode(
  nodeId: string,
  floor: number,
  seedHash: string,
  totalNodesInFloor: number,
): boolean {
  // Garantizar zona segura pre-boss
  if (nodeId.includes('_preboss') || nodeId.includes('preboss')) return true;

  // No marcar sala inicial ni última
  if (nodeId.endsWith('_0') || nodeId.endsWith('_exit')) return false;

  const rng = makePRNG(`${seedHash}_safezone_${floor}_${nodeId}`);
  const variance = Math.floor((rng.float() - 0.5) * 4); // -2 a +2
  const interval = 10 + variance;

  const idx = hashNodeIndex(nodeId, Math.max(1, totalNodesInFloor));
  return idx > 0 && idx % interval === 0;
}

function hashNodeIndex(nodeId: string, max: number): number {
  let h = 0;
  for (let i = 0; i < nodeId.length; i++) {
    h = (Math.imul(h, 31) + nodeId.charCodeAt(i)) >>> 0;
  }
  return h % max;
}

// ─── Costos de descanso en zona segura ───────────────────

export type RestType = 'SHORT' | 'LONG';

export type RestResult = {
  hpRestored: number;
  cyclesConsumed: number;
  log: string[];
};

/**
 * Calcula el HP restaurado por un descanso.
 *
 * - SHORT: 1d6 + CON mod por personaje, consume 0.5 ciclos
 * - LONG:  HP al máximo, consume 1 ciclo, cuesta gold en posada
 */
export function calculateRestHeal(
  maxHp: number,
  conMod: number,
  restType: RestType,
  seedHash: string,
  roomId: string,
  charName: string,
): RestResult {
  const rng = makePRNG(`${seedHash}_rest_${restType}_${roomId}_${charName}`);

  if (restType === 'SHORT') {
    const d6 = rng.next(1, 6);
    const healed = Math.max(1, d6 + conMod);
    return {
      hpRestored: healed,
      cyclesConsumed: 0.5,
      log: [`${charName}: descansó, restauró ${healed} HP`],
    };
  }

  // LONG: restauración completa
  return {
    hpRestored: maxHp,
    cyclesConsumed: 1,
    log: [`${charName}: descanso largo, HP al máximo`],
  };
}

// ─── Validación de zona segura ────────────────────────────

/**
 * Verifica si el game actual está en una zona segura.
 */
export function isInSafeZone(
  inSafeZone: boolean,
  safeZoneRoomId: string | null,
): boolean {
  return inSafeZone && safeZoneRoomId != null;
}

// ─── Texto descriptivo ────────────────────────────────────

export function getSafeZoneDescription(floor: number): string {
  if (floor <= 5)  return 'CAVERNA ILUMINADA — Un raro respiro en la oscuridad.';
  if (floor <= 15) return 'SANTUARIO OLVIDADO — Las runas protegen este espacio.';
  if (floor <= 30) return 'ALTAR ANTIGUO — Aquí la Torre no puede tocarlos.';
  return 'NÚCLEO SELLADO — Un enigma en las profundidades.';
}
