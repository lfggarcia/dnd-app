import { LootDomainService } from '../../domain/services/LootDomainService';
import type { LootDrop } from '../../domain/services/LootDomainService';
import type { RoomType } from '../../domain/entities/Room';
import type { IItemRepository } from '../../domain/repositories/IItemRepository';

/**
 * GenerateLootUseCase — generates and persists room loot.
 */
export class GenerateLootUseCase {
  private readonly lootService = new LootDomainService();

  constructor(private readonly itemRepo: IItemRepository) {}

  execute(
    gameId: string,
    seedHash: string,
    roomId: string | number,
    roomType: RoomType,
    floor: number,
    cycle: number,
  ): LootDrop[] {
    const drops = this.lootService.generateRoomLoot(roomId, roomType, floor, cycle, seedHash);

    for (const drop of drops) {
      this.itemRepo.create({
        seedHash,
        ownerGameId: gameId,
        ownerCharName: null,
        name: drop.name,
        type: drop.type,
        rarity: drop.rarity,
        isEquipped: false,
        isUnique: drop.rarity === 'unique',
        obtainedCycle: cycle,
        floorObtained: floor,
        goldValue: drop.goldValue,
        data: drop.data,
        claimed: false,
      });
    }

    return drops;
  }
}
