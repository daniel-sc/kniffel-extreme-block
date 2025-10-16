import { useState, useEffect } from 'react';
import { GameState, GameCell, Player } from '@/types/game';

const createEmptyCell = (): GameCell => ({ value: null, struck: false });

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

const createInitialState = (): GameState => ({
  players: [createPlayer('player-1', '')],
});

export const useGameState = () => {
  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = localStorage.getItem('kniffel-extreme-game');
    return saved ? JSON.parse(saved) : createInitialState();
  });

  useEffect(() => {
    localStorage.setItem('kniffel-extreme-game', JSON.stringify(gameState));
  }, [gameState]);

  const updateCell = (
    playerId: string,
    section: 'upper' | 'lower',
    field: string,
    updates: Partial<GameCell>
  ) => {
    setGameState((prev) => ({
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
    }));
  };

  const updatePlayerName = (playerId: string, name: string) => {
    setGameState((prev) => ({
      ...prev,
      players: prev.players.map((player) =>
        player.id === playerId ? { ...player, name } : player
      ),
    }));
  };

  const addPlayer = () => {
    setGameState((prev) => ({
      ...prev,
      players: [...prev.players, createPlayer(`player-${Date.now()}`, '')],
    }));
  };

  const removePlayer = (playerId: string) => {
    setGameState((prev) => ({
      ...prev,
      players: prev.players.filter((p) => p.id !== playerId),
    }));
  };

  const resetGame = () => {
    setGameState(createInitialState());
    localStorage.removeItem('kniffel-extreme-game');
  };

  return {
    gameState,
    updateCell,
    updatePlayerName,
    addPlayer,
    removePlayer,
    resetGame,
  };
};
