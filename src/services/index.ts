export { fetchList, fetchDetail, fetchAllDetails, API_ENDPOINTS } from './api5e';
export type { ApiEndpoint } from './api5e';
export {
  syncEndpoint,
  syncEndpointList,
  syncAll,
  getSyncStatus,
} from './syncService';
export type { SyncProgress, FullSyncProgress } from './syncService';
export { seedSpanishTranslations } from './translationSeed';
export { seedCustomSubclasses } from './subclassSeed';
export { seedCustomBackgrounds } from './backgroundSeed';
export {
  getTranslatedField,
  getTranslatedResource,
  getTranslatedName,
} from './translationBridge';
export { generateFloorNodes } from './mapGenerator';
export type { MapNode, NodeType } from './mapGenerator';
export {
  generateDungeonFloor,
  applyExplorationState,
  revealAdjacentRooms,
  applyFloorMutations,
  serializeExplorationState,
  rollGroupPerception,
} from './dungeonGraphService';
export type {
  DungeonRoom,
  DungeonFloor,
  FloorExplorationState,
  RoomType,
  PerceptionResult,
} from './dungeonGraphService';
export {
  getEvolvedMonster,
  getMonsterStats,
  calculateXP,
  recordKill,
  getKillCount,
  checkSecretBossTriggers,
  getEvolutionTier,
  SECRET_BOSS_CONDITIONS,
} from './monsterEvolutionService';
export type {
  MonsterStats,
  KillRecord,
  SecretBossCondition,
} from './monsterEvolutionService';
export {
  getEnemySprite,
  preloadFloorSprites,
  hasCachedSprite,
  getEnemyEvolutionTier,
  getEvolvedEnemyType,
} from './enemySpriteService';
export type { EnemyType, EnemySprite } from './enemySpriteService';

export { generateRivals, buildRivalPool } from './rivalGenerator';
export type { RivalEntry } from './rivalGenerator';
export {
  CLASS_SUBCLASS_MAP,
  ALL_CLASSES,
  ALL_SUBCLASSES,
  getSubclassesForClass,
  getClassForSubclass,
  isValidSubclass,
  CLASS_HIT_DICE,
  CLASS_PRIMARY_ABILITY,
  CLASS_SAVING_THROWS,
  SPELLCASTING_CLASSES,
  XP_TABLE,
  PROFICIENCY_BONUS,
  getLevelForXP,
  getXPToNextLevel,
} from './rulesConfig';

// ─── Sprint 4C ────────────────────────────────────────────
export {
  resolveEmotion,
  tickEmotionDurations,
  isSignificantEvent,
  applyEmotionToDamage,
} from './emotionalNarrativeService';
export type {
  ExpressionKey,
  EmotionFamily,
  EmotionState,
  PartyEmotionalState,
} from './emotionalNarrativeService';

// ─── Sprint 5B ────────────────────────────────────────────
export {
  advanceTime,
  advanceToEndOfSeason,
  isTowerClosed,
  cyclesRemaining,
  CYCLE_COST,
  SEASON_LENGTH,
} from './timeService';
export type { TimeAction } from './timeService';

// ─── Sprint 5C ────────────────────────────────────────────
export { simulateWorld, calculatePartyPower } from './worldSimulator';
export type {
  SimulationEvent,
  SimulationEventType,
  SimulationResult,
} from './worldSimulator';

// ─── Sprint 6 — Economy ───────────────────────────────────
export {
  calculateReviveCost,
  calculateItemPrice,
  calculateSellValue,
  calculateInnCost,
  calculateRoomGold,
  REVIVE_BASE_COST,
} from './economyService';
export type { ReviveCostResult } from './economyService';

// ─── Sprint 6 — Loot ──────────────────────────────────────
export { generateRoomLoot, generateBossUniqueLoot } from './lootService';
export type { LootDrop } from './lootService';

// ─── Sprint 6 — Progression ───────────────────────────────
export {
  awardXP,
  confirmLevelUps,
  formatXPProgress,
  MAX_LEVEL_MVP,
  XP_REWARDS,
} from './progressionService';
export type { LevelUpResult } from './progressionService';

// ─── Sprint 6 — Moral ─────────────────────────────────────
export {
  applyMoralEvent,
  checkForAbandonment,
  generateReplacementAdventurer,
  getMoraleLabel,
  MORALE_INITIAL,
} from './moralSystem';
export type { MoralEvent } from './moralSystem';

// ─── Sprint 6 — Bounty ────────────────────────────────────
export {
  getBounty,
  recordPartyKill,
  getBountyRiskMultiplier,
  getBountyLabel,
} from './bountyService';

// ─── Sprint 6 — Encounter ─────────────────────────────────
export {
  checkForEncounter,
  attemptFlee,
  resolveNegotiation,
  estimateRivalPower,
} from './encounterService';
export type { EncounterResult, FleeResult } from './encounterService';

// ─── Sprint 6 — Safe Zone ─────────────────────────────────
export {
  isSafeZoneNode,
  calculateRestHeal,
  isInSafeZone,
  getSafeZoneDescription,
} from './safeZoneService';

// ─── Sprint 6 — Alliances ─────────────────────────────────
export {
  getActiveAlliances,
  isAlliedWith,
  formAlliance,
  terminateAlliance,
  expireOldAlliances,
  chargeAllianceFees,
  evaluateAllianceOffer,
} from './allianceService';
export type { Alliance, AllianceOffer } from './allianceService';

// ─── Sprint 7 — AI Memory ─────────────────────────────────
export {
  createMemory,
  recordDecision,
  recordCombat,
  getAdaptiveWeights,
  evaluateCulturalAdoption,
  mutatePreferences,
  MUTATION_INTERVAL,
} from './aiMemoryService';
export type { AIMemoryState, CombatMemory } from './aiMemoryService';

// ─── Sprint 7 — Essences ─────────────────────────────────
export {
  resolveEssenceDrop,
  getEssenceDefinition,
  getActiveEffect,
  getEssenceSlots,
  rollEssenceRank,
  ESSENCE_CATALOG,
  ESSENCE_SLOTS_BY_LEVEL,
  ASCENDED_BONUS_SLOTS,
  DROP_CHANCE_BY_ENEMY_TYPE,
} from './essenceService';
export type {
  EssenceRank,
  EssenceCategory,
  EssenceDefinition,
  EssenceDrop,
  EssenceEffect,
  EssenceEffectType,
} from './essenceService';
