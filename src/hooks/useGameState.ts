import { useState, useEffect } from 'react';
import { GameState, GameCell, UpperSection, LowerSection } from '@/types/game';

const createEmptyCell = (): GameCell => ({ value: null, struck: false });

const createInitialState = (): GameState => ({
  playerName: '',
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

export const useGameState = () => {
  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = localStorage.getItem('kniffel-extreme-game');
    return saved ? JSON.parse(saved) : createInitialState();
  });

  useEffect(() => {
    localStorage.setItem('kniffel-extreme-game', JSON.stringify(gameState));
  }, [gameState]);

  const updateCell = (
    section: 'upper' | 'lower',
    field: string,
    updates: Partial<GameCell>
  ) => {
    setGameState((prev) => {
      const currentSection = prev[section];
      const currentCell = currentSection[field as keyof typeof currentSection] as GameCell;
      
      return {
        ...prev,
        [section]: {
          ...currentSection,
          [field]: {
            value: currentCell.value,
            struck: currentCell.struck,
            ...updates,
          },
        },
      };
    });
  };

  const updatePlayerName = (name: string) => {
    setGameState((prev) => ({ ...prev, playerName: name }));
  };

  const resetGame = () => {
    setGameState(createInitialState());
    localStorage.removeItem('kniffel-extreme-game');
  };

  return {
    gameState,
    updateCell,
    updatePlayerName,
    resetGame,
  };
};
