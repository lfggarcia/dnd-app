/**
 * AppContext.tsx — Dependency Injection container for TORRE.
 *
 * Wires all concrete repository implementations to the use cases.
 * Wrap the app root with <AppProvider> to make all use cases available
 * via useAppContext().
 */

import React, { createContext, useContext, useMemo } from 'react';

// ─── Repository implementations ───────────────────────────
import { SqliteGameRepository } from '../repositories/SqliteGameRepository';
import { SqliteItemRepository } from '../repositories/SqliteItemRepository';
import { SqliteEventRepository } from '../repositories/SqliteEventRepository';
import { SqliteEssenceRepository } from '../repositories/SqliteEssenceRepository';
import { SqliteRivalRepository } from '../repositories/SqliteRivalRepository';
import { SqliteCharacterRepository } from '../repositories/SqliteCharacterRepository';

// ─── External adapter implementations ─────────────────────
import { WorldSimulatorAdapter } from '../adapters/WorldSimulatorAdapter';
import { AIProfileAdapter } from '../adapters/AIProfileAdapter';
import { AllianceStorageAdapter } from '../adapters/AllianceStorageAdapter';

// ─── Use cases ─────────────────────────────────────────────
import { StartNewGameUseCase } from '../../application/use-cases/game/StartNewGameUseCase';
import { LoadGameUseCase } from '../../application/use-cases/game/LoadGameUseCase';
import { SaveGameUseCase } from '../../application/use-cases/game/SaveGameUseCase';
import { EndGameUseCase } from '../../application/use-cases/game/EndGameUseCase';

import { CreatePartyUseCase } from '../../application/use-cases/party/CreatePartyUseCase';
import { ConfirmLevelUpsUseCase } from '../../application/use-cases/party/ConfirmLevelUpsUseCase';
import { ReviveCharacterUseCase } from '../../application/use-cases/party/ReviveCharacterUseCase';
import { LaunchPartyIntoDungeonUseCase } from '../../application/use-cases/party/LaunchPartyIntoDungeonUseCase';

import { ResolveCombatUseCase } from '../../application/use-cases/combat/ResolveCombatUseCase';

import { GenerateDungeonUseCase } from '../../application/use-cases/dungeon/GenerateDungeonUseCase';
import { EnterRoomUseCase } from '../../application/use-cases/dungeon/EnterRoomUseCase';
import { AdvanceFloorUseCase } from '../../application/use-cases/dungeon/AdvanceFloorUseCase';
import { ExtractFromDungeonUseCase } from '../../application/use-cases/dungeon/ExtractFromDungeonUseCase';

import { GenerateLootUseCase } from '../../application/use-cases/economy/GenerateLootUseCase';
import { SellItemUseCase } from '../../application/use-cases/economy/SellItemUseCase';
import { BuyItemUseCase } from '../../application/use-cases/economy/BuyItemUseCase';

import { RunWorldSimulationUseCase } from '../../application/use-cases/simulation/RunWorldSimulationUseCase';
import { AdvanceCycleUseCase } from '../../application/use-cases/simulation/AdvanceCycleUseCase';

import { IssueBountyUseCase } from '../../application/use-cases/bounty/IssueBountyUseCase';
import { ClaimBountyUseCase } from '../../application/use-cases/bounty/ClaimBountyUseCase';

import { ProposeAllianceUseCase } from '../../application/use-cases/alliance/ProposeAllianceUseCase';
import { ResolveNegotiationUseCase } from '../../application/use-cases/alliance/ResolveNegotiationUseCase';

// ─── AppContext shape ──────────────────────────────────────

export interface AppContextValue {
  // Repos (exposed for direct use where needed)
  essenceRepo: SqliteEssenceRepository;
  rivalRepo: SqliteRivalRepository;
  characterRepo: SqliteCharacterRepository;

  // Adapters
  worldSimulator: WorldSimulatorAdapter;
  aiProfile: AIProfileAdapter;

  // Game
  startNewGame: StartNewGameUseCase;
  loadGame: LoadGameUseCase;
  saveGame: SaveGameUseCase;
  endGame: EndGameUseCase;

  // Party
  createParty: CreatePartyUseCase;
  confirmLevelUps: ConfirmLevelUpsUseCase;
  reviveCharacter: ReviveCharacterUseCase;
  launchPartyIntoDungeon: LaunchPartyIntoDungeonUseCase;

  // Combat
  resolveCombat: ResolveCombatUseCase;

  // Dungeon
  generateDungeon: GenerateDungeonUseCase;
  enterRoom: EnterRoomUseCase;
  advanceFloor: AdvanceFloorUseCase;
  extractFromDungeon: ExtractFromDungeonUseCase;

  // Economy
  generateLoot: GenerateLootUseCase;
  sellItem: SellItemUseCase;
  buyItem: BuyItemUseCase;

  // Simulation
  runWorldSimulation: RunWorldSimulationUseCase;
  advanceCycle: AdvanceCycleUseCase;

  // Bounty
  issueBounty: IssueBountyUseCase;
  claimBounty: ClaimBountyUseCase;

  // Alliance
  proposeAlliance: ProposeAllianceUseCase;
  resolveNegotiation: ResolveNegotiationUseCase;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<AppContextValue>(() => {
    // Concrete implementations (singletons per provider mount)
    const gameRepo = new SqliteGameRepository();
    const itemRepo = new SqliteItemRepository();
    const eventRepo = new SqliteEventRepository();
    const essenceRepo = new SqliteEssenceRepository();
    const rivalRepo = new SqliteRivalRepository();
    const characterRepo = new SqliteCharacterRepository();

    const worldSimulator = new WorldSimulatorAdapter();
    const aiProfile = new AIProfileAdapter();
    const allianceStorage = new AllianceStorageAdapter();

    return {
      essenceRepo,
      rivalRepo,
      characterRepo,
      worldSimulator,
      aiProfile,

      startNewGame: new StartNewGameUseCase(gameRepo),
      loadGame: new LoadGameUseCase(gameRepo),
      saveGame: new SaveGameUseCase(gameRepo),
      endGame: new EndGameUseCase(gameRepo),

      createParty: new CreatePartyUseCase(gameRepo),
      confirmLevelUps: new ConfirmLevelUpsUseCase(gameRepo),
      reviveCharacter: new ReviveCharacterUseCase(gameRepo),
      launchPartyIntoDungeon: new LaunchPartyIntoDungeonUseCase(gameRepo),

      resolveCombat: new ResolveCombatUseCase(gameRepo),

      generateDungeon: new GenerateDungeonUseCase(),
      enterRoom: new EnterRoomUseCase(gameRepo),
      advanceFloor: new AdvanceFloorUseCase(gameRepo),
      extractFromDungeon: new ExtractFromDungeonUseCase(gameRepo),

      generateLoot: new GenerateLootUseCase(itemRepo),
      sellItem: new SellItemUseCase(itemRepo, gameRepo),
      buyItem: new BuyItemUseCase(gameRepo),

      runWorldSimulation: new RunWorldSimulationUseCase(worldSimulator, gameRepo),
      advanceCycle: new AdvanceCycleUseCase(gameRepo, worldSimulator),

      issueBounty: new IssueBountyUseCase(eventRepo, gameRepo),
      claimBounty: new ClaimBountyUseCase(eventRepo, gameRepo),

      proposeAlliance: new ProposeAllianceUseCase(allianceStorage, gameRepo),
      resolveNegotiation: new ResolveNegotiationUseCase(allianceStorage, gameRepo),
    };
  }, []);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within <AppProvider>');
  }
  return ctx;
}
