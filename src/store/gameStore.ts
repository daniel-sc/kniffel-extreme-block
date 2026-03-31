import { create } from 'zustand';
import { GameState, GameCell, Player, CURRENT_VERSION } from '@/types/game';
import type { SyncConflictState } from '@/utils/syncResolution';

const GAME_STORAGE_KEY = 'kniffel-extreme-game';
const GAME_PRISTINE_STORAGE_KEY = 'kniffel-extreme-game-pristine';

// --- Helpers ---

const createEmptyCell = (): GameCell => ({ value: null, struck: false });
const createUpdatedAt = () => new Date().toISOString();

const createPlayer = (id: string, name: string = ''): Player => ({
  id,
  name,
  upper: {
    ones: createEmptyCell(),
    twos: createEmptyCell(),
    threes: createEmptyCell(),
    fours: createEmptyCell(),
    fives: createEmptyCell(),
    sixes: createEmptyCell(),
  },
  lower: {
    threeOfKind: createEmptyCell(),
    fourOfKind: createEmptyCell(),
    twoPairs: createEmptyCell(),
    threePairs: createEmptyCell(),
    twoThrees: createEmptyCell(),
    fullHouse: createEmptyCell(),
    largeFullHouse: createEmptyCell(),
    smallStraight: createEmptyCell(),
    largeStraight: createEmptyCell(),
    highway: createEmptyCell(),
    kniffel: createEmptyCell(),
    kniffelExtreme: createEmptyCell(),
    under10: createEmptyCell(),
    over33: createEmptyCell(),
    chance: createEmptyCell(),
    superChance: createEmptyCell(),
  },
});

export const createInitialGameState = (): GameState => ({
  version: CURRENT_VERSION,
  updatedAt: createUpdatedAt(),
  players: [createPlayer('player-1', '')],
});

const normalizeGameState = (state: Partial<GameState>): GameState => ({
  version: CURRENT_VERSION,
  updatedAt:
    typeof state.updatedAt === 'string' && state.updatedAt.length > 0
      ? state.updatedAt
      : createUpdatedAt(),
  players:
    Array.isArray(state.players) && state.players.length > 0
      ? state.players
      : createInitialGameState().players,
  gameId: state.gameId,
});

const touchGameState = (state: GameState): GameState => ({
  ...state,
  updatedAt: createUpdatedAt(),
});

// --- localStorage ---

const readStoredPristineState = () => {
  const storedPristine = localStorage.getItem(GAME_PRISTINE_STORAGE_KEY);
  if (storedPristine === 'true') return true;
  if (storedPristine === 'false') return false;
  return localStorage.getItem(GAME_STORAGE_KEY) === null;
};

const loadInitialGameState = (): GameState => {
  const saved = localStorage.getItem(GAME_STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed.version === CURRENT_VERSION) {
      return normalizeGameState(parsed);
    }
    console.log('Discarding incompatible state version:', parsed.version);
  }
  return createInitialGameState();
};

// --- Broadcast suppression (imperative flag, not reactive) ---

let _suppressNextBroadcast = false;
export const suppressBroadcastOnce = () => {
  _suppressNextBroadcast = true;
};
export const consumeBroadcastSuppression = () => {
  if (_suppressNextBroadcast) {
    _suppressNextBroadcast = false;
    return true;
  }
  return false;
};

// --- Store ---

interface GameStore {
  gameState: GameState;
  isPristineLocalState: boolean;
  syncConflict: SyncConflictState | null;

  updateCell: (
    playerId: string,
    section: 'upper' | 'lower',
    field: string,
    updates: Partial<GameCell>,
  ) => void;
  updatePlayerName: (playerId: string, name: string) => void;
  addPlayer: () => string;
  removePlayer: (playerId: string) => void;
  resetGame: () => void;
  revancheGame: () => void;

  applyRemoteState: (state: GameState) => void;
  setSyncConflict: (conflict: SyncConflictState | null) => void;
  updateConflictServerState: (serverState: GameState) => void;
}

export const useGameStore = create<GameStore>()((set, get) => ({
  gameState: loadInitialGameState(),
  isPristineLocalState: readStoredPristineState(),
  syncConflict: null,

  updateCell: (playerId, section, field, updates) => {
    set((s) => ({
      isPristineLocalState: false,
      gameState: touchGameState({
        ...s.gameState,
        players: s.gameState.players.map((player) => {
          if (player.id !== playerId) return player;
          const currentSection = player[section];
          const currentCell = currentSection[field as keyof typeof currentSection] as GameCell;
          return {
            ...player,
            [section]: {
              ...currentSection,
              [field]: { value: currentCell.value, struck: currentCell.struck, ...updates },
            },
          };
        }),
      }),
    }));
  },

  updatePlayerName: (playerId, name) => {
    set((s) => ({
      isPristineLocalState: false,
      gameState: touchGameState({
        ...s.gameState,
        players: s.gameState.players.map((p) => (p.id === playerId ? { ...p, name } : p)),
      }),
    }));
  },

  addPlayer: () => {
    const newPlayer = createPlayer(`player-${Date.now()}`, '');
    set((s) => ({
      isPristineLocalState: false,
      gameState: touchGameState({
        ...s.gameState,
        players: [...s.gameState.players, newPlayer],
      }),
    }));
    return newPlayer.id;
  },

  removePlayer: (playerId) => {
    set((s) => ({
      isPristineLocalState: false,
      gameState: touchGameState({
        ...s.gameState,
        players: s.gameState.players.filter((p) => p.id !== playerId),
      }),
    }));
  },

  resetGame: () => {
    localStorage.removeItem(GAME_STORAGE_KEY);
    set({ isPristineLocalState: false, gameState: createInitialGameState() });
  },

  revancheGame: () => {
    set((s) => {
      const reversedPlayers = [...s.gameState.players].reverse();
      const timestamp = Date.now();
      const players = reversedPlayers.length
        ? reversedPlayers.map((player, index) =>
            createPlayer(`player-${timestamp + index}`, player.name),
          )
        : createInitialGameState().players;
      return {
        isPristineLocalState: false,
        gameState: { version: CURRENT_VERSION, updatedAt: createUpdatedAt(), players },
      };
    });
  },

  applyRemoteState: (state) => {
    set({ isPristineLocalState: false, gameState: normalizeGameState(state) });
  },

  setSyncConflict: (conflict) => {
    set({ syncConflict: conflict });
  },

  updateConflictServerState: (serverState) => {
    set((s) => {
      if (!s.syncConflict) return s;
      return { syncConflict: { ...s.syncConflict, serverState } };
    });
  },
}));

// Persist game state to localStorage on every change
useGameStore.subscribe((state, prevState) => {
  if (state.gameState !== prevState.gameState) {
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(state.gameState));
  }
  if (state.isPristineLocalState !== prevState.isPristineLocalState) {
    localStorage.setItem(GAME_PRISTINE_STORAGE_KEY, String(state.isPristineLocalState));
  }
});
