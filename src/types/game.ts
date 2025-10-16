export interface GameCell {
  value: number | null;
  struck: boolean;
}

export interface UpperSection {
  ones: GameCell;
  twos: GameCell;
  threes: GameCell;
  fours: GameCell;
  fives: GameCell;
  sixes: GameCell;
}

export interface LowerSection {
  threeOfKind: GameCell;
  fourOfKind: GameCell;
  twoPairs: GameCell;
  threePairs: GameCell;
  twoThrees: GameCell;
  fullHouse: GameCell;
  largeFullHouse: GameCell;
  smallStraight: GameCell;
  largeStraight: GameCell;
  highway: GameCell;
  kniffel: GameCell;
  kniffelExtreme: GameCell;
  under10: GameCell;
  over33: GameCell;
  chance: GameCell;
  superChance: GameCell;
}

export interface GameState {
  playerName: string;
  upper: UpperSection;
  lower: LowerSection;
  gameId?: string;
}

export const FIXED_SCORES = {
  threePairs: 35,
  twoThrees: 45,
  fullHouse: 25,
  largeFullHouse: 45,
  smallStraight: 30,
  largeStraight: 40,
  highway: 50,
  kniffel: 50,
  kniffelExtreme: 75,
  over33: 40,
} as const;
