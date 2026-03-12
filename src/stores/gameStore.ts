import { create } from 'zustand';
import {
  createSavedGame,
  updateSavedGame,
  getSavedGame,
  getActiveSavedGame,
  getAllSavedGames,
  deleteSavedGame,
  migrateStripPartyPortraits,
  type SavedGame,
  type CharacterSave,
} from '../database/gameRepository';
import { saveRivals } from '../database/rivalRepository';
import type { CombatResult } from '../services/combatEngine';

// ─── Types ────────────────────────────────────────────────

type GameState = {
  // Current active game
  activeGame: SavedGame | null;
  // All saved games for the load screen
  savedGames: SavedGame[];
  // Loading flag
  loading: boolean;
  /** Last combat result — in-memory only, not persisted */
  lastCombatResult: CombatResult | null;
  /** Last world simulation events — updated on each advanceCycle call */
  lastSimulationEvents: import('../services/worldSimulator').SimulationEvent[] | null;
};

type GameActions = {
  /** Load all saved games + last active into store */
  hydrate: () => void;
  /** Create a new game from seed + party, set as active */
  startNewGame: (seed: string, seedHash: string, party: CharacterSave[]) => SavedGame;
  /** Resume a saved game by id */
  loadGame: (id: string) => boolean;
  /** Update current game progress (floor, cycle, phase, gold, party, location, mapState, safeZone) */
  updateProgress: (updates: Partial<Pick<SavedGame, 'partyData' | 'floor' | 'cycle' | 'phase' | 'gold' | 'status' | 'location' | 'mapState' | 'inSafeZone' | 'safeZoneRoomId'>>) => void;
  /** Save the AI-generated party portrait (base64 data URI) */
  savePortrait: (portrait: string) => void;
  /** Save individual character portraits as a map of index → base64 data URI */
  saveCharacterPortraits: (portraits: Record<string, string>) => void;
  /** Save expression variants for characters: map of index → { expressionKey → base64 data URI } */
  saveCharacterExpressions: (expressions: Record<string, Record<string, string>>) => void;
  /** Mark current game as dead/completed */
  endGame: (status: 'completed' | 'dead') => void;
  /** Delete a saved game */
  removeGame: (id: string) => void;
  /** Clear the active game from memory (for going back to menu) */
  clearActive: () => void;
  /** Store the result of the last combat for ReportScreen to consume */
  setCombatResult: (result: CombatResult) => void;
  /** Advance game time by the cost of an action; runs world simulation and persists cycleRaw */
  advanceCycle: (action: import('../services/timeService').TimeAction) => Promise<void>;
  /** Fast-forward to end of season (cycle 60) for testing / debug purposes */
  advanceToVillage: () => Promise<void>;
  /** Overwrite the last simulation events (useful after manual world sim calls) */
  setSimulationEvents: (events: import('../services/worldSimulator').SimulationEvent[]) => void;
};

// ─── Store ────────────────────────────────────────────────

export const useGameStore = create<GameState & GameActions>((set, get) => ({
  activeGame: null,
  savedGames: [],
  loading: false,
  lastCombatResult: null,
  lastSimulationEvents: null,

  hydrate: () => {
    set({ loading: true });
    migrateStripPartyPortraits();
    const savedGames = getAllSavedGames();
    const activeGame = getActiveSavedGame();
    set({ savedGames, activeGame, loading: false });
  },

  startNewGame: (seed, seedHash, party) => {
    const game = createSavedGame(seed, seedHash, party);
    set(state => ({
      activeGame: game,
      savedGames: [game, ...state.savedGames],
    }));
    return game;
  },

  loadGame: (id) => {
    const game = getSavedGame(id);
    if (!game) return false;
    set({ activeGame: game });
    return true;
  },

  updateProgress: (updates) => {
    const { activeGame } = get();
    if (!activeGame) return;

    updateSavedGame(activeGame.id, updates);

    set({
      activeGame: { ...activeGame, ...updates, updatedAt: new Date().toISOString() },
    });
  },

  savePortrait: (portrait) => {
    const { activeGame } = get();
    if (!activeGame) return;
    updateSavedGame(activeGame.id, { partyPortrait: portrait });
    set({
      activeGame: { ...activeGame, partyPortrait: portrait, updatedAt: new Date().toISOString() },
    });
  },

  saveCharacterPortraits: (portraits) => {
    const { activeGame } = get();
    if (!activeGame) return;
    const merged = { ...(activeGame.portraitsJson ?? {}), ...portraits };
    updateSavedGame(activeGame.id, { portraitsJson: merged });
    set({
      activeGame: { ...activeGame, portraitsJson: merged, updatedAt: new Date().toISOString() },
    });
  },

  saveCharacterExpressions: (expressions) => {
    const { activeGame } = get();
    if (!activeGame) return;
    // Deep merge: preserve existing expressions for characters not in this batch
    const existing = activeGame.expressionsJson ?? {};
    const merged: Record<string, Record<string, string>> = { ...existing };
    for (const [idx, variants] of Object.entries(expressions)) {
      merged[idx] = { ...(existing[idx] ?? {}), ...variants };
    }
    updateSavedGame(activeGame.id, { expressionsJson: merged });
    set({
      activeGame: { ...activeGame, expressionsJson: merged, updatedAt: new Date().toISOString() },
    });
  },

  endGame: (status) => {
    const { activeGame } = get();
    if (!activeGame) return;

    updateSavedGame(activeGame.id, { status });

    const updated = { ...activeGame, status, updatedAt: new Date().toISOString() };
    set(state => ({
      activeGame: updated,
      savedGames: state.savedGames.map(g => g.id === updated.id ? updated : g),
    }));
  },

  removeGame: (id) => {
    deleteSavedGame(id);
    set(state => ({
      savedGames: state.savedGames.filter(g => g.id !== id),
      activeGame: state.activeGame?.id === id ? null : state.activeGame,
    }));
  },

  clearActive: () => set({ activeGame: null }),

  setCombatResult: (result) => set({ lastCombatResult: result }),

  advanceCycle: async (action) => {
    const { activeGame } = get();
    if (!activeGame) return;

    const { advanceTime } = await import('../services/timeService');
    const { newCycleRaw, newCycle } = advanceTime(activeGame.cycleRaw ?? activeGame.cycle, action);

    // GAP-04: only run world simulation when a full cycle integer boundary is crossed
    const prevCycleInt = Math.floor(activeGame.cycleRaw ?? activeGame.cycle);
    const newCycleInt  = Math.floor(newCycleRaw);

    let simResult = { events: [] as import('../services/worldSimulator').SimulationEvent[], updatedRivals: [] as import('../services/rivalGenerator').RivalEntry[] };
    if (newCycleInt !== prevCycleInt) {
      const { simulateWorld } = await import('../services/worldSimulator');
      simResult = await simulateWorld(
        activeGame.seedHash,
        newCycleInt,
        activeGame,
        prevCycleInt + 1, // only simulate new cycles, not from the beginning
      );
      // GAP-01: persist updated rival states with memory
      if (simResult.updatedRivals.length > 0) {
        saveRivals(activeGame.seedHash, simResult.updatedRivals, newCycleInt);
      }
    }

    const updates = {
      cycleRaw: newCycleRaw,
      cycle: newCycleInt,
      ...(simResult.events.length > 0 && {
        lastSimEvents: JSON.stringify(simResult.events),
        lastActionAt: new Date().toISOString(),
      }),
    };

    updateSavedGame(activeGame.id, updates as Parameters<typeof updateSavedGame>[1]);
    set({
      activeGame: { ...activeGame, ...updates, updatedAt: new Date().toISOString() },
      ...(simResult.events.length > 0 && { lastSimulationEvents: simResult.events }),
    });
  },

  advanceToVillage: async () => {
    const { activeGame } = get();
    if (!activeGame) return;

    const { advanceToEndOfSeason } = await import('../services/timeService');
    const { simulateWorld } = await import('../services/worldSimulator');

    const { newCycle } = advanceToEndOfSeason(activeGame.cycleRaw ?? activeGame.cycle);

    const simResult = await simulateWorld(activeGame.seedHash, newCycle, activeGame);

    // GAP-01: persist updated rival states with memory
    if (simResult.updatedRivals.length > 0) {
      saveRivals(activeGame.seedHash, simResult.updatedRivals, newCycle as number);
    }

    const updates = {
      cycleRaw: newCycle as number,
      cycle: newCycle as number,
      lastSimEvents: JSON.stringify(simResult.events),
      lastActionAt: new Date().toISOString(),
    };

    updateSavedGame(activeGame.id, updates as Parameters<typeof updateSavedGame>[1]);
    set({
      activeGame: { ...activeGame, ...updates, updatedAt: new Date().toISOString() },
      lastSimulationEvents: simResult.events,
    });
  },

  setSimulationEvents: (events) => set({ lastSimulationEvents: events }),
}));
