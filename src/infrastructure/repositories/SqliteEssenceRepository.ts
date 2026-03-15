/**
 * SqliteEssenceRepository — concrete implementation of IEssenceRepository.
 * Delegates to src/database/essenceRepository.ts.
 */

import {
  saveEssenceDrop,
  saveEssenceDropsBatch,
  getEssencesByChar,
  equipEssence,
  unequipEssence,
  incrementMonsterKills,
  getMonsterKills,
  type EssenceSaveInput,
} from '../../database/essenceRepository';
import { getDB } from '../../database/connection';
import type {
  IEssenceRepository,
  EssenceData,
  EssenceRank,
} from '../../domain/repositories/IEssenceRepository';

function dbRowToEssenceData(e: ReturnType<typeof getEssencesByChar>[number]): EssenceData {
  return {
    id: e.id,
    seedHash: e.seedHash,
    ownerGameId: e.ownerGameId,
    ownerCharName: e.ownerCharName,
    definitionId: e.definitionId,
    rank: e.rank as EssenceRank,
    evolutionLevel: e.evolutionLevel,
    killsOnType: e.killsOnType,
    equipped: e.equipped,
    obtainedCycle: e.obtainedCycle,
    obtainedFloor: e.obtainedFloor,
  };
}

export class SqliteEssenceRepository implements IEssenceRepository {
  findByGame(gameId: string): EssenceData[] {
    const db = getDB();
    const result = db.executeSync(
      'SELECT * FROM essences WHERE owner_game_id = ? ORDER BY obtained_cycle DESC',
      [gameId],
    );
    return (result.rows ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      seedHash: row.seed_hash as string,
      ownerGameId: row.owner_game_id as string,
      ownerCharName: row.owner_char_name as string,
      definitionId: row.definition_id as string,
      rank: row.rank as EssenceRank,
      evolutionLevel: (row.evolution_level ?? 1) as 1 | 2 | 3,
      killsOnType: (row.kills_on_type ?? 0) as number,
      equipped: Boolean(row.equipped),
      obtainedCycle: row.obtained_cycle as number,
      obtainedFloor: row.obtained_floor as number,
    }));
  }

  findByCharacter(gameId: string, charName: string): EssenceData[] {
    return getEssencesByChar(gameId, charName).map(dbRowToEssenceData);
  }

  save(essence: Omit<EssenceData, 'id'> & { id?: string }): void {
    const input: EssenceSaveInput = {
      definitionId: essence.definitionId,
      rank: essence.rank,
      evolutionLevel: essence.evolutionLevel,
      killsOnThisType: essence.killsOnType,
      ownerGameId: essence.ownerGameId,
      ownerCharName: essence.ownerCharName,
      obtainedCycle: essence.obtainedCycle,
      obtainedFloor: essence.obtainedFloor,
      seedHash: essence.seedHash,
    };
    saveEssenceDrop(input);
  }

  saveBatch(essences: Array<Omit<EssenceData, 'id'> & { id?: string }>): void {
    const inputs: EssenceSaveInput[] = essences.map(e => ({
      definitionId: e.definitionId,
      rank: e.rank,
      evolutionLevel: e.evolutionLevel,
      killsOnThisType: e.killsOnType,
      ownerGameId: e.ownerGameId,
      ownerCharName: e.ownerCharName,
      obtainedCycle: e.obtainedCycle,
      obtainedFloor: e.obtainedFloor,
      seedHash: e.seedHash,
    }));
    saveEssenceDropsBatch(inputs);
  }

  updateEquipped(id: string, equipped: boolean): void {
    if (equipped) {
      // equipEssence requires charName and gameId; we look up the essence first
      const db = getDB();
      const result = db.executeSync(
        'SELECT owner_char_name, owner_game_id FROM essences WHERE id = ?',
        [id],
      );
      const row = result.rows?.[0];
      if (!row) return;
      equipEssence(id, row.owner_char_name as string, row.owner_game_id as string);
    } else {
      unequipEssence(id);
    }
  }

  incrementKills(gameId: string, monsterType: string, amount: number): void {
    // Records kills under synthetic char '_game' for game-wide aggregates.
    // seedHash defaults to gameId since this interface doesn't expose seedHash.
    for (let i = 0; i < amount; i++) {
      incrementMonsterKills(gameId, '_game', monsterType, 0, gameId);
    }
  }

  getKillCount(gameId: string, monsterType: string): number {
    return getMonsterKills(gameId, '_game', monsterType);
  }
}
