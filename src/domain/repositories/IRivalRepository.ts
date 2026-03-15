/**
 * IRivalRepository — port for AI rival party persistence.
 */
export interface RivalData {
  id: string;
  seedHash: string;
  name: string;
  floor: number;
  rep: number;
  profile: string; // serialized AIProfile
  memory: string;  // serialized AIMemoryState
  lastCycle: number;
  updatedAt: string;
}

export interface IRivalRepository {
  findBySeed(seedHash: string): RivalData[];
  findById(id: string): RivalData | null;
  save(rivals: RivalData[]): void;
  delete(id: string): void;
  deleteAllBySeed(seedHash: string): void;
}
