import type { Character, CharacterProps } from '../entities/Character';
import type { Party } from '../entities/Party';
import type { Item } from '../entities/Item';
import type { BountyContract } from '../entities/BountyContract';
import type { Alliance } from '../entities/Alliance';

/**
 * IGameRepository — port for full SavedGame persistence.
 * Infrastructure (SQLite adapter) implements this interface.
 */

export type GamePhase = 'DAY' | 'NIGHT';
export type GameStatus = 'active' | 'completed' | 'dead';
export type GameLocation = 'village' | 'map';

export interface SavedGameSnapshot {
  id: string;
  seed: string;
  seedHash: string;
  partyName: string | null;
  partyData: CharacterProps[];
  floor: number;
  cycle: number;
  cycleRaw: number;
  phase: GamePhase;
  gold: number;
  status: GameStatus;
  location: GameLocation;
  mapState: string | null;
  partyPortrait: string | null;
  portraitsJson: Record<string, string> | null;
  expressionsJson: Record<string, Record<string, string>> | null;
  inSafeZone: boolean;
  safeZoneRoomId: string | null;
  combatRoomId: string | null;
  combatRoomType: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IGameRepository {
  findAll(): SavedGameSnapshot[];
  findById(id: string): SavedGameSnapshot | null;
  findActive(): SavedGameSnapshot | null;
  create(
    seed: string,
    seedHash: string,
    party: CharacterProps[],
    partyName?: string | null,
  ): SavedGameSnapshot;
  update(id: string, updates: Partial<SavedGameSnapshot>): void;
  delete(id: string): void;
  setActive(id: string): void;
}
