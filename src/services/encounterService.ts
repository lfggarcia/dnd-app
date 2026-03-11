/**
 * encounterService.ts
 * Detección y resolución de encuentros entre parties — Sprint 6 (doc 03).
 *
 * Detecta colisiones piso+zona+ciclo para activar PvP o negociación.
 * Huida y negociación son determinísticas por seed.
 */

import { makePRNG } from '../utils/prng';
import type { RivalEntry } from './rivalGenerator';
import type { CharacterSave } from '../database/gameRepository';

// ─── Types ────────────────────────────────────────────────

export type EncounterResult =
  | { type: 'none' }
  | { type: 'encounter'; rival: RivalEntry; isAmbush: boolean; canNegotiate: boolean };

export type FleeResult = {
  success: boolean;
  log: string[];
  memberLost?: string;
};

export type NegotiationOffer = {
  type: 'gold' | 'free_passage' | 'alliance';
  amount?: number;
};

export type NegotiationResult = {
  accepted: boolean;
  log: string[];
};

export type RivalCombatant = {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attackBonus: number;
  ac: number;
  damage: string;
};

// ─── Detección de encuentro ───────────────────────────────

/**
 * SYSTEMS.MD: "Ocurren si coinciden mismo piso, misma zona, mismo ciclo (día/noche)."
 */
export function checkForEncounter(
  floor: number,
  cycle: number,
  phase: 'DAY' | 'NIGHT',
  seedHash: string,
  rivals: RivalEntry[],
): EncounterResult {
  const rng = makePRNG(`${seedHash}_encounter_${floor}_${cycle}_${phase}`);

  const nearbyRivals = rivals.filter(
    r => r.status === 'active' && Math.abs(r.floor - floor) <= 2,
  );
  if (nearbyRivals.length === 0) return { type: 'none' };

  // SYSTEMS.MD: BaseEncounter(10%) + noiseLevel + floorDensity
  const baseChance   = 0.10;
  const noiseBonus   = nearbyRivals.length * 0.05;
  const floorBonus   = Math.min(floor * 0.002, 0.15);
  const encounterChance = Math.min(baseChance + noiseBonus + floorBonus, 0.60);

  if (rng.float() > encounterChance) return { type: 'none' };

  const rival = nearbyRivals[Math.floor(rng.float() * nearbyRivals.length)];
  const isAmbush = rng.float() < 0.20;

  return { type: 'encounter', rival, isAmbush, canNegotiate: true };
}

// ─── Huida ────────────────────────────────────────────────

/**
 * SYSTEMS.MD: "Chequeo de habilidad (Atletismo / Sigilo). Riesgo de perder miembros."
 */
export function attemptFlee(
  party: CharacterSave[],
  rivalPower: number,
  seedHash: string,
  roomId: string,
): FleeResult {
  const rng = makePRNG(`${seedHash}_flee_${roomId}`);
  const log: string[] = ['INTENTANDO HUIDA...'];

  const alive = party.filter(c => c.alive);
  if (alive.length === 0) return { success: false, log: ['Party sin miembros vivos'] };

  const bestRunner = alive.reduce((best, c) => {
    const score = Math.max(c.baseStats.DEX, c.baseStats.STR);
    const bestScore = Math.max(best.baseStats.DEX, best.baseStats.STR);
    return score > bestScore ? c : best;
  });

  const athlMod   = Math.floor((bestRunner.baseStats.STR - 10) / 2);
  const stealthMod = Math.floor((bestRunner.baseStats.DEX - 10) / 2);
  const bonus = Math.max(athlMod, stealthMod);
  const roll  = rng.next(1, 20) + bonus;
  const dc    = 10 + Math.floor(rivalPower / 20);

  log.push(`${bestRunner.name.toUpperCase()} chequeo huida: ${roll} vs DC ${dc}`);

  if (roll >= dc) {
    log.push('✓ HUIDA EXITOSA');
    return { success: true, log };
  }

  // Huida fallida — posible pérdida de miembro
  if (rng.bool(0.30) && alive.length > 1) {
    const slowest = alive.reduce((s, c) => {
      return c.baseStats.DEX < s.baseStats.DEX ? c : s;
    });
    log.push(`✗ HUIDA FALLIDA — ${slowest.name.toUpperCase()} quedó atrás`);
    return { success: false, log, memberLost: slowest.name };
  }

  log.push('✗ HUIDA FALLIDA — El grupo fue alcanzado');
  return { success: false, log };
}

// ─── Negociación ──────────────────────────────────────────

/**
 * Evalúa si una party rival acepta la oferta del jugador.
 */
export function resolveNegotiation(
  offer: NegotiationOffer,
  rival: RivalEntry,
  playerBountyLevel: number,
  seedHash: string,
  cycle: number,
): NegotiationResult {
  const rng = makePRNG(`${seedHash}_negotiate_${rival.name}_${cycle}`);
  const log: string[] = [];

  // Rivales de alto bounty son más suspicaces
  const suspicion = playerBountyLevel * 0.1;

  if (offer.type === 'free_passage') {
    const acceptChance = Math.max(0.1, 0.6 - suspicion - rival.rep * 0.003);
    if (rng.bool(acceptChance)) {
      log.push(`${rival.name} acepta paso libre`);
      return { accepted: true, log };
    }
    log.push(`${rival.name} rechaza la oferta`);
    return { accepted: false, log };
  }

  if (offer.type === 'gold' && offer.amount) {
    const minDesired = rival.floor * 20;
    if (offer.amount >= minDesired) {
      log.push(`${rival.name} acepta ${offer.amount}G`);
      return { accepted: true, log };
    }
    log.push(`${rival.name} rechaza — ofrece mínimo ${minDesired}G`);
    return { accepted: false, log };
  }

  log.push(`${rival.name} rechaza la propuesta`);
  return { accepted: false, log };
}

// ─── Power Score ──────────────────────────────────────────

/**
 * Estima el poder de una party rival basado en su floor + rep.
 */
export function estimateRivalPower(rival: RivalEntry): number {
  return rival.floor * 10 + (rival.rep ?? 0) * 0.5;
}
