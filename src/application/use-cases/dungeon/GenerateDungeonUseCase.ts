import { DungeonGeneratorService } from '../../domain/services/DungeonGeneratorService';
import { Dungeon, DungeonLayout } from '../../domain/entities/Dungeon';

/**
 * GenerateDungeonUseCase — creates a new dungeon floor layout for a given floor.
 */
export class GenerateDungeonUseCase {
  private readonly generator = new DungeonGeneratorService();

  execute(seedHash: string, floorIndex: number): DungeonLayout {
    return this.generator.generateFloor(seedHash, floorIndex);
  }
}
