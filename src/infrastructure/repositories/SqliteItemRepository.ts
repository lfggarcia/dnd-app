/**
 * SqliteItemRepository — concrete implementation of IItemRepository.
 * Delegates to src/database/itemRepository.ts.
 */

import {
  getItemsByGame,
  getItemById,
  createItem,
  deleteItem,
  claimItem,
  equipItem,
  unequipItem,
  type Item,
} from '../../database/itemRepository';
import type { IItemRepository } from '../../domain/repositories/IItemRepository';
import type { ItemProps } from '../../domain/entities/Item';

function toProps(item: Item): ItemProps {
  return {
    id: item.id,
    seedHash: item.seedHash,
    ownerGameId: item.ownerGameId,
    ownerCharName: item.ownerCharName,
    name: item.name,
    type: item.type,
    rarity: item.rarity,
    isEquipped: item.isEquipped,
    isUnique: item.isUnique,
    obtainedCycle: item.obtainedCycle,
    floorObtained: item.floorObtained,
    goldValue: item.goldValue,
    data: item.data,
    claimed: item.claimed,
  };
}

export class SqliteItemRepository implements IItemRepository {
  findByGame(gameId: string): ItemProps[] {
    return getItemsByGame(gameId).map(toProps);
  }

  findById(id: string): ItemProps | null {
    const item = getItemById(id);
    return item ? toProps(item) : null;
  }

  create(item: Omit<ItemProps, 'id'>): ItemProps {
    const created = createItem({
      ...item,
      seedHash: item.seedHash,
    });
    return toProps(created);
  }

  update(id: string, updates: Partial<ItemProps>): void {
    if (updates.isEquipped === true && updates.ownerCharName) {
      equipItem(id, updates.ownerCharName);
    } else if (updates.isEquipped === false) {
      unequipItem(id);
    }
    if (updates.claimed) claimItem(id);
  }

  delete(id: string): void {
    deleteItem(id);
  }

  claim(id: string): void {
    claimItem(id);
  }
}
