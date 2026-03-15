/**
 * IEssenceRepository — port for the essence/ascension system persistence.
 */
export type EssenceRank = 1 | 2 | 3 | 4 | 5;

export interface EssenceData {
  id: string;
  seedHash: string;
  ownerGameId: string;
  ownerCharName: string;
  definitionId: string;
  rank: EssenceRank;
  evolutionLevel: 1 | 2 | 3;
  killsOnType: number;
  equipped: boolean;
  obtainedCycle: number;
  obtainedFloor: number;
}

export interface IEssenceRepository {
  findByGame(gameId: string): EssenceData[];
  findByCharacter(gameId: string, charName: string): EssenceData[];
  save(essence: Omit<EssenceData, 'id'> & { id?: string }): void;
  updateEquipped(id: string, equipped: boolean): void;
  incrementKills(gameId: string, monsterType: string, amount: number): void;
  getKillCount(gameId: string, monsterType: string): number;
}
