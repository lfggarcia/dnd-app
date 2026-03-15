import type { IItemRepository } from '../../../domain/repositories/IItemRepository';
import type { IGameRepository } from '../../../domain/repositories/IGameRepository';
import { LootDomainService } from '../../../domain/services/LootDomainService';
import { GameStateError } from '../../../domain/errors/DomainError';

/**
 * SellItemUseCase — sells an item and adds gold to the game.
 */
export class SellItemUseCase {
  private readonly lootService = new LootDomainService();

  constructor(
    private readonly itemRepo: IItemRepository,
    private readonly gameRepo: IGameRepository,
  ) {}

  execute(gameId: string, itemId: string, currentGold: number): number {
    const item = this.itemRepo.findById(itemId);
    if (!item) throw new GameStateError(`Item ${itemId} not found`);
    if (item.ownerGameId !== gameId) throw new GameStateError('Item does not belong to this game');

    const sellPrice = this.lootService.getSellPrice(item.goldValue);
    const newGold = currentGold + sellPrice;

    this.itemRepo.delete(itemId);
    this.gameRepo.update(gameId, { gold: newGold });

    return newGold;
  }
}
