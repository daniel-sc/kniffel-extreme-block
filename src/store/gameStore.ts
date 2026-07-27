import { create } from 'zustand';
import { GameState, GameCell, Player, CURRENT_VERSION } from '@/types/game';
import type { SyncConflictState } from '@/utils/syncResolution';

// --- Types ---

export type SyncMode = 'sync' | 'offline';
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

// --- Storage keys ---

const GAME_STORAGE_KEY = 'kniffel-extreme-game';
const GAME_PRISTINE_STORAGE_KEY = 'kniffel-extreme-game-pristine';
const ROOM_ID_STORAGE_KEY = 'kniffel-extreme-sync-room-id';
const SYNC_MODE_STORAGE_KEY = 'kniffel-extreme-sync-mode';
const LAST_SYNCED_AT_STORAGE_PREFIX = 'kniffel-extreme-sync-last-synced-at';

// --- Game helpers ---

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

// --- localStorage helpers ---

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

const readStoredSyncMode = (): SyncMode => {
  if (typeof window === 'undefined') return 'sync';
  return localStorage.getItem(SYNC_MODE_STORAGE_KEY) === 'offline' ? 'offline' : 'sync';
};

const readStoredRoomId = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(ROOM_ID_STORAGE_KEY) || '';
};

const readStoredLastSyncedAt = (roomId: string) => {
  if (typeof window === 'undefined' || !roomId) return null;
  return localStorage.getItem(`${LAST_SYNCED_AT_STORAGE_PREFIX}:${roomId}`);
};

interface StoredClientSnapshot {
  gameState: GameState;
  isPristineLocalState: boolean;
  roomId: string;
  syncMode: SyncMode;
  lastSyncedAt: string | null;
}

const readStoredClientSnapshot = (): StoredClientSnapshot => {
  const roomId = readStoredRoomId();
  return {
    gameState: loadInitialGameState(),
    isPristineLocalState: readStoredPristineState(),
    roomId,
    syncMode: readStoredSyncMode(),
    lastSyncedAt: readStoredLastSyncedAt(roomId),
  };
};

const writeStoredClientSnapshot = (snapshot: StoredClientSnapshot) => {
  localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(snapshot.gameState));
  localStorage.setItem(GAME_PRISTINE_STORAGE_KEY, String(snapshot.isPristineLocalState));
  localStorage.setItem(ROOM_ID_STORAGE_KEY, snapshot.roomId);
  localStorage.setItem(SYNC_MODE_STORAGE_KEY, snapshot.syncMode);

  if (!snapshot.roomId) return;
  const lastSyncedAtKey = `${LAST_SYNCED_AT_STORAGE_PREFIX}:${snapshot.roomId}`;
  if (snapshot.lastSyncedAt) {
    localStorage.setItem(lastSyncedAtKey, snapshot.lastSyncedAt);
  } else {
    localStorage.removeItem(lastSyncedAtKey);
  }
};

const initialClientSnapshot = readStoredClientSnapshot();

// --- Broadcast suppression (imperative flag, not reactive) ---

let _suppressNextBroadcast = false;
const suppressBroadcastOnce = () => {
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

interface InitialStateResolutionReady {
  applyState?: GameState;
  suppressBroadcast: boolean;
  newLastSyncedAt?: string | null;
}

interface GameStore {
  // Game state
  gameState: GameState;
  isPristineLocalState: boolean;

  // Game actions
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

  // Sync state
  roomId: string;
  connectionStatus: ConnectionStatus;
  isSyncReady: boolean;
  connectedPeers: string[];
  syncMode: SyncMode;
  lastSyncedAt: string | null;
  syncConflict: SyncConflictState | null;

  // Sync: composite operations
  applyRemoteSync: (state: GameState, lastSyncedAt: string) => void;
  applyInitialStateResolution: (
    resolution: InitialStateResolutionReady,
    replaceWithFresh: boolean,
  ) => void;
  resolveConflictKeepLocal: () => void;
  resolveConflictKeepServer: () => void;
  goOffline: () => void;
  beginRoomConnection: (roomId: string) => void;

  // Sync: granular setters (for single-purpose call sites)
  setConnectionStatus: (status: ConnectionStatus) => void;
  setSyncConflict: (conflict: SyncConflictState | null) => void;
  updateConflictServerState: (serverState: GameState) => void;
  setConnectedPeers: (peers: string[]) => void;
  markLastSyncedAt: (updatedAt: string | null) => void;
  updateRoom: (roomId: string) => void;
  resetSyncConnection: () => void;
}

export const useGameStore = create<GameStore>()((set, get) => ({
  // --- Game state ---
  gameState: initialClientSnapshot.gameState,
  isPristineLocalState: initialClientSnapshot.isPristineLocalState,

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

  // --- Sync state ---
  roomId: initialClientSnapshot.roomId,
  connectionStatus: 'disconnected',
  isSyncReady: false,
  connectedPeers: [],
  syncMode: initialClientSnapshot.syncMode,
  lastSyncedAt: initialClientSnapshot.lastSyncedAt,
  syncConflict: null,

  // --- Sync: composite operations ---

  applyRemoteSync: (state, lastSyncedAt) => {
    suppressBroadcastOnce();
    set({
      lastSyncedAt,
      isPristineLocalState: false,
      gameState: normalizeGameState(state),
    });
  },

  applyInitialStateResolution: (resolution, replaceWithFresh) => {
    if (resolution.suppressBroadcast) suppressBroadcastOnce();

    const newGameState = resolution.applyState
      ? normalizeGameState(resolution.applyState)
      : replaceWithFresh
        ? createInitialGameState()
        : undefined;

    set({
      syncConflict: null,
      isSyncReady: true,
      ...(resolution.newLastSyncedAt !== undefined
        ? { lastSyncedAt: resolution.newLastSyncedAt }
        : {}),
      ...(newGameState ? { gameState: newGameState, isPristineLocalState: false } : {}),
    });
  },

  resolveConflictKeepLocal: () => {
    set({ syncConflict: null, isSyncReady: true });
  },

  resolveConflictKeepServer: () => {
    const { syncConflict } = get();
    if (!syncConflict) return;
    suppressBroadcastOnce();
    set({
      lastSyncedAt: syncConflict.serverState.updatedAt,
      isPristineLocalState: false,
      gameState: normalizeGameState(syncConflict.serverState),
      syncConflict: null,
      isSyncReady: true,
    });
  },

  goOffline: () => {
    set({ syncMode: 'offline', syncConflict: null });
  },

  beginRoomConnection: (nextRoomId) => {
    set((state) => ({
      roomId: nextRoomId,
      lastSyncedAt:
        state.roomId === nextRoomId
          ? state.lastSyncedAt
          : readStoredLastSyncedAt(nextRoomId),
      syncMode: 'sync',
      connectionStatus: 'connecting',
      isSyncReady: false,
    }));
  },

  // --- Sync: granular setters ---

  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setConnectedPeers: (peers) => set({ connectedPeers: peers }),
  resetSyncConnection: () =>
    set({ connectionStatus: 'disconnected', isSyncReady: false, connectedPeers: [] }),

  setSyncConflict: (conflict) => set({ syncConflict: conflict }),
  updateConflictServerState: (serverState) => {
    set((s) => {
      if (!s.syncConflict) return s;
      return { syncConflict: { ...s.syncConflict, serverState } };
    });
  },

  markLastSyncedAt: (updatedAt) => {
    set({ lastSyncedAt: updatedAt });
  },

  updateRoom: (nextRoomId) => {
    set((state) => ({
      roomId: nextRoomId,
      lastSyncedAt:
        state.roomId === nextRoomId
          ? state.lastSyncedAt
          : readStoredLastSyncedAt(nextRoomId),
    }));
  },
}));

// Persist one coherent client snapshot whenever one of its fields changes.
useGameStore.subscribe((state, prevState) => {
  if (
    state.gameState === prevState.gameState &&
    state.isPristineLocalState === prevState.isPristineLocalState &&
    state.roomId === prevState.roomId &&
    state.syncMode === prevState.syncMode &&
    state.lastSyncedAt === prevState.lastSyncedAt
  ) {
    return;
  }

  writeStoredClientSnapshot({
    gameState: state.gameState,
    isPristineLocalState: state.isPristineLocalState,
    roomId: state.roomId,
    syncMode: state.syncMode,
    lastSyncedAt: state.lastSyncedAt,
  });
});
