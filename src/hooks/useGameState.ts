import { useState, useEffect } from 'react';
import { GameState, GameCell, Player, CURRENT_VERSION } from '@/types/game';

const GAME_STORAGE_KEY = 'kniffel-extreme-game';
const GAME_PRISTINE_STORAGE_KEY = 'kniffel-extreme-game-pristine';

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
  updatedAt: typeof state.updatedAt === 'string' && state.updatedAt.length > 0 ? state.updatedAt : createUpdatedAt(),
  players: Array.isArray(state.players) && state.players.length > 0 ? state.players : createInitialGameState().players,
  gameId: state.gameId,
});

const touchGameState = (state: GameState): GameState => ({
  ...state,
  updatedAt: createUpdatedAt(),
});

const readStoredPristineState = () => {
  const storedPristine = localStorage.getItem(GAME_PRISTINE_STORAGE_KEY);
  if (storedPristine === 'true') {
    return true;
  }

  if (storedPristine === 'false') {
    return false;
  }

  return localStorage.getItem(GAME_STORAGE_KEY) === null;
};

export const useGameState = () => {
  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = localStorage.getItem(GAME_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Check version compatibility
      if (parsed.version === CURRENT_VERSION) {
        return normalizeGameState(parsed);
      }
      // Discard incompatible state
      console.log('Discarding incompatible state version:', parsed.version);
    }
    return createInitialGameState();
  });
  const [isPristineLocalState, setIsPristineLocalState] = useState(() => readStoredPristineState());

  useEffect(() => {
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  useEffect(() => {
    localStorage.setItem(GAME_PRISTINE_STORAGE_KEY, String(isPristineLocalState));
  }, [isPristineLocalState]);

  const updateCell = (
    playerId: string,
    section: 'upper' | 'lower',
    field: string,
    updates: Partial<GameCell>
  ) => {
    setIsPristineLocalState(false);
    setGameState((prev) =>
      touchGameState({
        ...prev,
        players: prev.players.map((player) => {
          if (player.id !== playerId) return player;

          const currentSection = player[section];
          const currentCell = currentSection[field as keyof typeof currentSection] as GameCell;

          return {
            ...player,
            [section]: {
              ...currentSection,
              [field]: {
                value: currentCell.value,
                struck: currentCell.struck,
                ...updates,
              },
            },
          };
        }),
      }),
    );
  };

  const updatePlayerName = (playerId: string, name: string) => {
    setIsPristineLocalState(false);
    setGameState((prev) =>
      touchGameState({
        ...prev,
        players: prev.players.map((player) =>
          player.id === playerId ? { ...player, name } : player,
        ),
      }),
    );
  };

  const addPlayer = () => {
    const newPlayer = createPlayer(`player-${Date.now()}`, '');
    setIsPristineLocalState(false);
    setGameState((prev) =>
      touchGameState({
        ...prev,
        players: [...prev.players, newPlayer],
      }),
    );
    return newPlayer.id;
  };

  const removePlayer = (playerId: string) => {
    setIsPristineLocalState(false);
    setGameState((prev) =>
      touchGameState({
        ...prev,
        players: prev.players.filter((p) => p.id !== playerId),
      }),
    );
  };

  const resetGame = () => {
    setIsPristineLocalState(false);
    setGameState(createInitialGameState());
    localStorage.removeItem(GAME_STORAGE_KEY);
  };

  const revancheGame = () => {
    setIsPristineLocalState(false);
    setGameState((prev) => {
      const reversedPlayers = [...prev.players].reverse();
      const timestamp = Date.now();
      const players = reversedPlayers.length
        ? reversedPlayers.map((player, index) =>
            createPlayer(`player-${timestamp + index}`, player.name)
          )
        : createInitialGameState().players;

      return {
        version: CURRENT_VERSION,
        updatedAt: createUpdatedAt(),
        players,
      };
    });
  };

  const setRemoteGameState = (state: GameState) => {
    setIsPristineLocalState(false);
    setGameState(normalizeGameState(state));
  };

  return {
    gameState,
    isPristineLocalState,
    setGameState: setRemoteGameState,
    updateCell,
    updatePlayerName,
    addPlayer,
    removePlayer,
    resetGame,
    revancheGame,
  };
};
