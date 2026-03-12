export { getDB, closeDB } from './connection';
export { runMigrations } from './migrations';
export {
  upsertResource,
  upsertResourceBatch,
  getResource,
  getResourcesByEndpoint,
  getFirstResourceByEndpoint,
  getResourceCount,
  searchResources,
  upsertTranslation,
  upsertTranslationBatch,
  getTranslation,
  getTranslationsForResource,
  setSyncMeta,
  getSyncMeta,
  getAllSyncMeta,
} from './repository';
export type { Resource, Translation } from './repository';
export {
  createItem,
  getItemById,
  getItemsByGame,
  getItemsByCharacter,
  isBossLootClaimed,
  equipItem,
  unequipItem,
  claimItem,
  assignItemToGame,
  deleteItem,
  deleteItemsByGame,
} from './itemRepository';
export type { Item, ItemType, ItemRarity, CreateItemInput } from './itemRepository';
export {
  createWorldEvent,
  getWorldEventsBySeed,
  getWorldEventsByType,
  countPartyKills,
  createBounty,
  getActiveBounties,
  getBountyForTarget,
  deactivateBounty,
  escalateBounty,
} from './eventRepository';
export type { WorldEvent, WorldEventType, Bounty, CreateWorldEventInput, CreateBountyInput } from './eventRepository';

// ─── Sprint 7 — Essence Repository ───────────────────────
export {
  saveEssenceDrop,
  getEssencesByChar,
  getEquippedCount,
  equipEssence,
  unequipEssence,
  incrementMonsterKills,
  getMonsterKills,
} from './essenceRepository';
export type { SavedEssence, EssenceSaveInput } from './essenceRepository';

