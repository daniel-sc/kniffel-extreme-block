import { Player, FIXED_SCORES } from '@/types/game';

export const calculateUpperSum = (player: Player): number => {
  return Object.values(player.upper).reduce((sum, cell) => {
    if (cell.struck) return sum;
    return sum + (cell.value || 0);
  }, 0);
};

export const calculateUpperBonus = (upperSum: number): number => {
  return upperSum >= 73 ? 45 : 0;
};

export const calculateUpperTotal = (player: Player): number => {
  const sum = calculateUpperSum(player);
  const bonus = calculateUpperBonus(sum);
  return sum + bonus;
};

export const calculateLowerSum = (player: Player): number => {
  return Object.entries(player.lower).reduce((sum, [key, cell]) => {
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

export const calculateGrandTotal = (player: Player): number => {
  return calculateUpperTotal(player) + calculateLowerSum(player);
};
