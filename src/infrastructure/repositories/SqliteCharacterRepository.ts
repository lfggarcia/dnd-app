/**
 * SqliteCharacterRepository — concrete implementation of ICharacterRepository.
 *
 * Characters in TORRE are stored inside SavedGame.partyData (JSON array).
 * There is no separate `characters` table. This adapter reads/writes the
 * party by re-using gameRepository functions.
 */

import {
  getSavedGame,
  updateSavedGame,
  type CharacterSave,
} from '../../database/gameRepository';
import type { ICharacterRepository } from '../../domain/repositories/ICharacterRepository';
import type { CharacterProps } from '../../domain/entities/Character';

/** CharacterSave and CharacterProps are structurally identical. */
function charSaveToProps(c: CharacterSave): CharacterProps {
  return {
    characterId: c.characterId,
    name: c.name,
    race: c.race,
    charClass: c.charClass,
    subclass: c.subclass,
    background: c.background,
    alignment: c.alignment,
    baseStats: c.baseStats,
    statMethod: c.statMethod,
    featureChoices: c.featureChoices,
    hp: c.hp,
    maxHp: c.maxHp,
    alive: c.alive,
    portrait: c.portrait,
    level: c.level,
    xp: c.xp,
    deathCount: c.deathCount,
    pendingLevelUps: c.pendingLevelUps,
    morale: c.morale,
    killCount: c.killCount,
    isAscended: c.isAscended,
    ascensionPath: c.ascensionPath,
    unlockedAbilities: c.unlockedAbilities,
  };
}

export class SqliteCharacterRepository implements ICharacterRepository {
  findAllInGame(gameId: string): CharacterProps[] {
    const game = getSavedGame(gameId);
    if (!game) return [];
    return (game.partyData ?? []).map(charSaveToProps);
  }

  findById(gameId: string, characterId: string): CharacterProps | null {
    const game = getSavedGame(gameId);
    if (!game) return null;
    const found = (game.partyData ?? []).find(c => c.characterId === characterId);
    return found ? charSaveToProps(found) : null;
  }

  updateInGame(gameId: string, updated: CharacterProps): void {
    const game = getSavedGame(gameId);
    if (!game) return;
    const newParty = (game.partyData ?? []).map(c =>
      c.characterId === updated.characterId ? (updated as unknown as CharacterSave) : c,
    );
    updateSavedGame(gameId, { partyData: newParty });
  }

  updateParty(gameId: string, party: CharacterProps[]): void {
    updateSavedGame(gameId, { partyData: party as unknown as CharacterSave[] });
  }
}
