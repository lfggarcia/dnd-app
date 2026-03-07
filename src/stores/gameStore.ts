import { create } from 'zustand';
import {
  createSavedGame,
  updateSavedGame,
  getSavedGame,
  getActiveSavedGame,
  getAllSavedGames,
  deleteSavedGame,
  type SavedGame,
  type CharacterSave,
} from '../database/gameRepository';

// ─── Types ────────────────────────────────────────────────

type GameState = {
  // Current active game
  activeGame: SavedGame | null;
  // All saved games for the load screen
  savedGames: SavedGame[];
  // Loading flag
  loading: boolean;
};

type GameActions = {
  /** Load all saved games + last active into store */
  hydrate: () => void;
  /** Create a new game from seed + party, set as active */
  startNewGame: (seed: string, seedHash: string, party: CharacterSave[]) => SavedGame;
  /** Resume a saved game by id */
  loadGame: (id: string) => boolean;
  /** Update current game progress (floor, cycle, phase, gold, party, location, mapState) */
  updateProgress: (updates: Partial<Pick<SavedGame, 'partyData' | 'floor' | 'cycle' | 'phase' | 'gold' | 'status' | 'location' | 'mapState'>>) => void;
  /** Save the AI-generated party portrait (base64 data URI) */
  savePortrait: (portrait: string) => void;
  /** Mark current game as dead/completed */
  endGame: (status: 'completed' | 'dead') => void;
  /** Delete a saved game */
  removeGame: (id: string) => void;
  /** Clear the active game from memory (for going back to menu) */
  clearActive: () => void;
};

// ─── Store ────────────────────────────────────────────────

export const useGameStore = create<GameState & GameActions>((set, get) => ({
  activeGame: null,
  savedGames: [],
  loading: false,

  hydrate: () => {
    set({ loading: true });
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
}));
