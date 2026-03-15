/**
 * SqliteGameRepository — concrete implementation of IGameRepository.
 * Delegates directly to src/database/gameRepository.ts functions.
 */

import {
  createSavedGame,
  updateSavedGame,
  getSavedGame,
  getActiveSavedGame,
  getAllSavedGames,
  deleteSavedGame,
  type SavedGame,
  type CharacterSave,
} from '../../database/gameRepository';
import type { IGameRepository, SavedGameSnapshot } from '../../domain/repositories/IGameRepository';
import type { CharacterProps } from '../../domain/entities/Character';

function savedGameToSnapshot(game: SavedGame): SavedGameSnapshot {
  return {
    id: game.id,
    seed: game.seed,
    seedHash: game.seedHash,
    partyName: game.partyName,
    partyData: game.partyData as unknown as CharacterProps[],
    floor: game.floor,
    cycle: game.cycle,
    cycleRaw: game.cycleRaw,
    phase: game.phase,
    gold: game.gold,
    status: game.status,
    location: game.location,
    mapState: game.mapState,
    partyPortrait: game.partyPortrait,
    portraitsJson: game.portraitsJson,
    expressionsJson: game.expressionsJson,
    inSafeZone: game.inSafeZone,
    safeZoneRoomId: game.safeZoneRoomId,
    combatRoomId: game.combatRoomId,
    combatRoomType: game.combatRoomType,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
  };
}

export class SqliteGameRepository implements IGameRepository {
  findAll(): SavedGameSnapshot[] {
    return getAllSavedGames().map(savedGameToSnapshot);
  }

  findById(id: string): SavedGameSnapshot | null {
    const game = getSavedGame(id);
    return game ? savedGameToSnapshot(game) : null;
  }

  findActive(): SavedGameSnapshot | null {
    const game = getActiveSavedGame();
    return game ? savedGameToSnapshot(game) : null;
  }

  create(
    seed: string,
    seedHash: string,
    party: CharacterProps[],
    partyName?: string | null,
  ): SavedGameSnapshot {
    const game = createSavedGame(seed, seedHash, party as unknown as CharacterSave[], partyName);
    return savedGameToSnapshot(game);
  }

  update(id: string, updates: Partial<SavedGameSnapshot>): void {
    updateSavedGame(id, updates as Parameters<typeof updateSavedGame>[1]);
  }

  delete(id: string): void {
    deleteSavedGame(id);
  }

  setActive(id: string): void {
    updateSavedGame(id, { status: 'active' });
  }
}
