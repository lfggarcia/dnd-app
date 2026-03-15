import { Character } from '../entities/Character';
import { Monster } from '../entities/Monster';
import { CombatSession, CombatOutcome } from '../entities/CombatSession';
import { makePRNG, type PRNG } from '../../utils/prng';
import { CombatError } from '../errors/DomainError';
import type { AbilityScoreName } from '../value-objects/AbilityScore';

export interface CombatTurnResult {
  log: string[];
  partyAfter: Character[];
  enemiesAlive: Monster[];
  outcome: CombatOutcome;
}

export interface CombatResolutionResult {
  session: CombatSession;
  totalXP: number;
  goldEarned: number;
  damageDone: Record<string, number>;
}

/** LiveEnemy — mutable snapshot for one combat resolution */
interface LiveEnemy {
  monster: Monster;
  currentHP: number;
}

/** LivePartyMember — mutable snapshot */
interface LivePartyMember {
  character: Character;
  currentHP: number;
}

/**
 * CombatDomainService
 * Auto-resolves DnD 5e combat between a party and dungeon enemies.
 * Deterministic per roomId + seedHash (same inputs → same result).
 * Pure logic — no infrastructure imports.
 */
export class CombatDomainService {
  private readonly MAX_ROUNDS = 50;

  /**
   * Fully resolve a combat session. Returns updated session + rewards.
   */
  resolve(
    session: CombatSession,
    seedHash: string,
  ): CombatResolutionResult {
    const rng = makePRNG(`${seedHash}_combat_${session.roomId}`);
    const liveParty: LivePartyMember[] = session.partyMembers.map(c => ({
      character: c,
      currentHP: c.hp.current,
    }));
    const liveEnemies: LiveEnemy[] = session.enemies.map(m => ({
      monster: m,
      currentHP: m.hp,
    }));

    let log: string[] = [];
    let round = 0;
    let outcome: CombatOutcome = 'ONGOING';
    const damageDone: Record<string, number> = {};

    while (outcome === 'ONGOING' && round < this.MAX_ROUNDS) {
      round++;
      log.push(`\n— Round ${round} —`);

      // ── Party attacks ──────────────────────────────────
      for (const pm of liveParty) {
        if (pm.currentHP <= 0) continue;
        const target = liveEnemies.find(e => e.currentHP > 0);
        if (!target) break;

        const attackRoll = rng.next(1, 20);
        const attackMod = pm.character.getModifier('STR') + pm.character.proficiencyBonus;
        const hits = attackRoll === 20 || (attackRoll !== 1 && attackRoll + attackMod >= target.monster.ac);
        if (hits) {
          const isCrit = attackRoll === 20;
          const dmg = this.rollDamage('1d8+2', rng, isCrit);
          target.currentHP = Math.max(0, target.currentHP - dmg);
          damageDone[pm.character.name] = (damageDone[pm.character.name] ?? 0) + dmg;
          log.push(`${pm.character.name} → ${target.monster.displayName}: ${dmg} dmg${isCrit ? ' (CRIT!)' : ''}`);
          if (target.currentHP <= 0) {
            log.push(`  ☠ ${target.monster.displayName} defeated`);
          }
        } else {
          log.push(`${pm.character.name} misses ${target.monster.displayName}`);
        }
      }

      // ── Enemy attacks ──────────────────────────────────
      for (const enemy of liveEnemies) {
        if (enemy.currentHP <= 0) continue;
        const targets = liveParty.filter(p => p.currentHP > 0);
        if (targets.length === 0) break;
        const target = targets[rng.next(0, targets.length - 1)];

        const attackRoll = rng.next(1, 20);
        const hits = attackRoll === 20 || (attackRoll !== 1 && attackRoll + enemy.monster.attackBonus >= 13);
        if (hits) {
          const isCrit = attackRoll === 20;
          const dmg = this.rollDamage(enemy.monster.damage, rng, isCrit);
          target.currentHP = Math.max(0, target.currentHP - dmg);
          log.push(`${enemy.monster.displayName} → ${target.character.name}: ${dmg} dmg${isCrit ? ' (CRIT!)' : ''}`);
          if (target.currentHP <= 0) {
            log.push(`  ☠ ${target.character.name} fell!`);
          }
        }
      }

      // ── Check end conditions ───────────────────────────
      const partyAlive = liveParty.some(p => p.currentHP > 0);
      const enemiesAlive = liveEnemies.some(e => e.currentHP > 0);
      if (!partyAlive) outcome = 'DEFEAT';
      else if (!enemiesAlive) outcome = 'VICTORY';
    }

    if (outcome === 'ONGOING') outcome = 'DEFEAT'; // timeout = defeat

    // ── Apply damage to Character entities ────────────────
    const updatedParty = session.partyMembers.map(original => {
      const live = liveParty.find(p => p.character.characterId === original.characterId)!;
      const dmgTaken = original.hp.current - live.currentHP;
      return dmgTaken > 0 ? original.takeDamage(dmgTaken) : original;
    });

    const defeated = liveEnemies.filter(e => e.currentHP <= 0).map(e => e.monster);
    const totalXP = defeated.reduce((sum, m) => sum + m.xpReward, 0);
    const goldEarned = Math.floor(totalXP * 0.5);

    log = [`${outcome}: ${round} rounds`, ...log];

    const finalSession = new CombatSession({
      ...session.toProps(),
      partyMembers: updatedParty,
      currentRound: round,
      log,
      outcome,
    });

    return { session: finalSession, totalXP, goldEarned, damageDone };
  }

  private rollDamage(notation: string, rng: PRNG, crit: boolean): number {
    const m = notation.match(/^(\d+)d(\d+)([+-]\d+)?$/);
    if (!m) return 1;
    const count = parseInt(m[1], 10) * (crit ? 2 : 1);
    const sides = parseInt(m[2], 10);
    const bonus = m[3] ? parseInt(m[3], 10) : 0;
    let total = bonus;
    for (let i = 0; i < count; i++) total += rng.next(1, sides);
    return Math.max(1, total);
  }
}
