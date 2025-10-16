import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScoreInput } from '@/components/ScoreInput';
import { FixedScoreToggle } from '@/components/FixedScoreToggle';
import { SectionTotal } from '@/components/SectionTotal';
import { ShareDialog } from '@/components/ShareDialog';
import { useGameState } from '@/hooks/useGameState';
import { usePeerSync } from '@/hooks/usePeerSync';
import { FIXED_SCORES, GameState } from '@/types/game';
import {
  calculateUpperSum,
  calculateUpperBonus,
  calculateUpperTotal,
  calculateLowerSum,
  calculateGrandTotal,
} from '@/utils/scoreCalculations';
import { Dices, RotateCcw } from 'lucide-react';

const Index = () => {
  const { gameState, updateCell, updatePlayerName, resetGame } = useGameState();
  const [showNameInput, setShowNameInput] = useState(!gameState.playerName);

  // Peer sync
  const handleRemoteUpdate = (remoteState: GameState) => {
    // Update local state from remote
    Object.entries(remoteState.upper).forEach(([key, value]) => {
      updateCell('upper', key, value);
    });
    Object.entries(remoteState.lower).forEach(([key, value]) => {
      updateCell('lower', key, value);
    });
  };

  const { peerId, connectedPeers, isConnecting, connectToPeer, broadcastState } = 
    usePeerSync(gameState, handleRemoteUpdate);

  // Broadcast state changes to connected peers
  useEffect(() => {
    if (connectedPeers.length > 0) {
      broadcastState(gameState);
    }
  }, [gameState]);

  const upperSum = calculateUpperSum(gameState);
  const upperBonus = calculateUpperBonus(upperSum);
  const upperTotal = calculateUpperTotal(gameState);
  const lowerSum = calculateLowerSum(gameState);
  const grandTotal = calculateGrandTotal(gameState);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-[var(--shadow-elevated)]">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Dices className="w-8 h-8" />
              <div>
                <h1 className="text-xl font-bold">Kniffel Extreme</h1>
                {gameState.playerName && (
                  <p className="text-sm opacity-90">{gameState.playerName}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <ShareDialog
                peerId={peerId}
                connectedPeers={connectedPeers}
                isConnecting={isConnecting}
                onConnect={connectToPeer}
              />
              <Button
                variant="secondary"
                size="icon"
                onClick={resetGame}
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Player Name Input */}
        {showNameInput && (
          <div className="bg-card p-6 rounded-xl shadow-[var(--shadow-card)] border border-border">
            <h2 className="text-lg font-bold mb-3">Spielername</h2>
            <div className="flex gap-2">
              <Input
                placeholder="Dein Name"
                value={gameState.playerName}
                onChange={(e) => updatePlayerName(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={() => setShowNameInput(false)}
                disabled={!gameState.playerName}
              >
                Start
              </Button>
            </div>
          </div>
        )}

        {/* Upper Section */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground px-2">Oberer Teil</h2>
          
          <ScoreInput
            label="Einser"
            description="nur Einser zählen"
            cell={gameState.upper.ones}
            onValueChange={(value) => updateCell('upper', 'ones', { value })}
            onStruckChange={(struck) => updateCell('upper', 'ones', { struck })}
          />
          
          <ScoreInput
            label="Zweier"
            description="nur Zweier zählen"
            cell={gameState.upper.twos}
            onValueChange={(value) => updateCell('upper', 'twos', { value })}
            onStruckChange={(struck) => updateCell('upper', 'twos', { struck })}
          />
          
          <ScoreInput
            label="Dreier"
            description="nur Dreier zählen"
            cell={gameState.upper.threes}
            onValueChange={(value) => updateCell('upper', 'threes', { value })}
            onStruckChange={(struck) => updateCell('upper', 'threes', { struck })}
          />
          
          <ScoreInput
            label="Vierer"
            description="nur Vierer zählen"
            cell={gameState.upper.fours}
            onValueChange={(value) => updateCell('upper', 'fours', { value })}
            onStruckChange={(struck) => updateCell('upper', 'fours', { struck })}
          />
          
          <ScoreInput
            label="Fünfer"
            description="nur Fünfer zählen"
            cell={gameState.upper.fives}
            onValueChange={(value) => updateCell('upper', 'fives', { value })}
            onStruckChange={(struck) => updateCell('upper', 'fives', { struck })}
          />
          
          <ScoreInput
            label="Sechser"
            description="nur Sechser zählen"
            cell={gameState.upper.sixes}
            onValueChange={(value) => updateCell('upper', 'sixes', { value })}
            onStruckChange={(struck) => updateCell('upper', 'sixes', { struck })}
          />

          <div className="space-y-2 pt-2">
            <SectionTotal label="Gesamt" value={upperSum} />
            <SectionTotal label="Bonus (bei ≥73)" value={upperBonus} highlighted={upperBonus > 0} />
            <SectionTotal label="Gesamt oberer Teil" value={upperTotal} highlighted />
          </div>
        </section>

        {/* Lower Section */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground px-2">Unterer Teil</h2>
          
          <ScoreInput
            label="Dreierpasch"
            description="alle Augen zählen"
            cell={gameState.lower.threeOfKind}
            onValueChange={(value) => updateCell('lower', 'threeOfKind', { value })}
            onStruckChange={(struck) => updateCell('lower', 'threeOfKind', { struck })}
          />
          
          <ScoreInput
            label="Viererpasch"
            description="alle Augen zählen"
            cell={gameState.lower.fourOfKind}
            onValueChange={(value) => updateCell('lower', 'fourOfKind', { value })}
            onStruckChange={(struck) => updateCell('lower', 'fourOfKind', { struck })}
          />
          
          <ScoreInput
            label="Zwei Paare"
            description="alle Augen zählen"
            cell={gameState.lower.twoPairs}
            onValueChange={(value) => updateCell('lower', 'twoPairs', { value })}
            onStruckChange={(struck) => updateCell('lower', 'twoPairs', { struck })}
          />
          
          <FixedScoreToggle
            label="Drei Paare"
            points={FIXED_SCORES.threePairs}
            cell={gameState.lower.threePairs}
            onToggle={(achieved) => updateCell('lower', 'threePairs', { value: achieved ? 1 : null })}
            onStruckChange={(struck) => updateCell('lower', 'threePairs', { struck })}
          />
          
          <FixedScoreToggle
            label="Zwei Dreier"
            points={FIXED_SCORES.twoThrees}
            cell={gameState.lower.twoThrees}
            onToggle={(achieved) => updateCell('lower', 'twoThrees', { value: achieved ? 1 : null })}
            onStruckChange={(struck) => updateCell('lower', 'twoThrees', { struck })}
          />
          
          <FixedScoreToggle
            label="Full-House"
            points={FIXED_SCORES.fullHouse}
            cell={gameState.lower.fullHouse}
            onToggle={(achieved) => updateCell('lower', 'fullHouse', { value: achieved ? 1 : null })}
            onStruckChange={(struck) => updateCell('lower', 'fullHouse', { struck })}
          />
          
          <FixedScoreToggle
            label="Großes Full-House"
            points={FIXED_SCORES.largeFullHouse}
            cell={gameState.lower.largeFullHouse}
            onToggle={(achieved) => updateCell('lower', 'largeFullHouse', { value: achieved ? 1 : null })}
            onStruckChange={(struck) => updateCell('lower', 'largeFullHouse', { struck })}
          />
          
          <FixedScoreToggle
            label="Kleine Straße"
            points={FIXED_SCORES.smallStraight}
            cell={gameState.lower.smallStraight}
            onToggle={(achieved) => updateCell('lower', 'smallStraight', { value: achieved ? 1 : null })}
            onStruckChange={(struck) => updateCell('lower', 'smallStraight', { struck })}
          />
          
          <FixedScoreToggle
            label="Große Straße"
            points={FIXED_SCORES.largeStraight}
            cell={gameState.lower.largeStraight}
            onToggle={(achieved) => updateCell('lower', 'largeStraight', { value: achieved ? 1 : null })}
            onStruckChange={(struck) => updateCell('lower', 'largeStraight', { struck })}
          />
          
          <FixedScoreToggle
            label="Highway"
            points={FIXED_SCORES.highway}
            cell={gameState.lower.highway}
            onToggle={(achieved) => updateCell('lower', 'highway', { value: achieved ? 1 : null })}
            onStruckChange={(struck) => updateCell('lower', 'highway', { struck })}
          />
          
          <FixedScoreToggle
            label="Kniffel"
            points={FIXED_SCORES.kniffel}
            cell={gameState.lower.kniffel}
            onToggle={(achieved) => updateCell('lower', 'kniffel', { value: achieved ? 1 : null })}
            onStruckChange={(struck) => updateCell('lower', 'kniffel', { struck })}
          />
          
          <FixedScoreToggle
            label="Kniffel Extreme"
            points={FIXED_SCORES.kniffelExtreme}
            cell={gameState.lower.kniffelExtreme}
            onToggle={(achieved) => updateCell('lower', 'kniffelExtreme', { value: achieved ? 1 : null })}
            onStruckChange={(struck) => updateCell('lower', 'kniffelExtreme', { struck })}
          />
          
          <ScoreInput
            label="10 oder weniger"
            description="alle Augen zählen"
            cell={gameState.lower.under10}
            onValueChange={(value) => updateCell('lower', 'under10', { value })}
            onStruckChange={(struck) => updateCell('lower', 'under10', { struck })}
          />
          
          <FixedScoreToggle
            label="33 oder mehr"
            points={FIXED_SCORES.over33}
            cell={gameState.lower.over33}
            onToggle={(achieved) => updateCell('lower', 'over33', { value: achieved ? 1 : null })}
            onStruckChange={(struck) => updateCell('lower', 'over33', { struck })}
          />
          
          <ScoreInput
            label="Chance"
            description="alle Augen zählen"
            cell={gameState.lower.chance}
            onValueChange={(value) => updateCell('lower', 'chance', { value })}
            onStruckChange={(struck) => updateCell('lower', 'chance', { struck })}
          />
          
          <ScoreInput
            label="Super Chance"
            description="alle Augen zählen x2"
            cell={gameState.lower.superChance}
            onValueChange={(value) => updateCell('lower', 'superChance', { value })}
            onStruckChange={(struck) => updateCell('lower', 'superChance', { struck })}
          />

          <div className="space-y-2 pt-2">
            <SectionTotal label="Gesamt unterer Teil" value={lowerSum} />
          </div>
        </section>

        {/* Grand Total */}
        <section>
          <SectionTotal label="Endsumme" value={grandTotal} highlighted />
        </section>
      </main>
    </div>
  );
};

export default Index;
