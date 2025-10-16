import { GameState, FIXED_SCORES } from '@/types/game';

export const calculateUpperSum = (state: GameState): number => {
  return Object.values(state.upper).reduce((sum, cell) => {
    if (cell.struck) return sum;
    return sum + (cell.value || 0);
  }, 0);
};

export const calculateUpperBonus = (upperSum: number): number => {
  return upperSum >= 73 ? 45 : 0;
};

export const calculateUpperTotal = (state: GameState): number => {
  const sum = calculateUpperSum(state);
  const bonus = calculateUpperBonus(sum);
  return sum + bonus;
};

export const calculateLowerSum = (state: GameState): number => {
  return Object.entries(state.lower).reduce((sum, [key, cell]) => {
    if (cell.struck) return sum;
    
    const fixedScore = FIXED_SCORES[key as keyof typeof FIXED_SCORES];
    if (fixedScore !== undefined) {
      return sum + (cell.value ? fixedScore : 0);
    }
    
    // For super chance, value is doubled
    if (key === 'superChance' && cell.value) {
      return sum + (cell.value * 2);
    }
    
    return sum + (cell.value || 0);
  }, 0);
};

export const calculateGrandTotal = (state: GameState): number => {
  return calculateUpperTotal(state) + calculateLowerSum(state);
};
