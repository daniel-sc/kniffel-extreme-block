import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScoreRow } from '@/components/ScoreRow';
import { TotalRow } from '@/components/TotalRow';
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
import { Dices, RotateCcw, Plus, X } from 'lucide-react';

const Index = () => {
  const { gameState, updateCell, updatePlayerName, addPlayer, removePlayer, resetGame } = useGameState();

  // Peer sync
  const handleRemoteUpdate = (remoteState: GameState) => {
    // This would need more sophisticated merging logic for multiplayer
    // For now, we'll keep it simple
  };

  const { peerId, connectedPeers, isConnecting, connectToPeer, broadcastState } = 
    usePeerSync(gameState, handleRemoteUpdate);

  // Broadcast state changes to connected peers
  useEffect(() => {
    if (connectedPeers.length > 0) {
      broadcastState(gameState);
    }
  }, [gameState]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b-4 border-transparent bg-clip-padding shadow-[var(--shadow-elevated)]" 
        style={{ 
          backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box'
        }}>
        <div className="container max-w-full mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Dices className="w-8 h-8 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Kniffel Extreme</h1>
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
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-full mx-auto px-2 py-4">
        {/* Player Names Header */}
        <div className="mb-4 overflow-x-auto">
          <div className="grid gap-2 min-w-max" style={{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${gameState.players.length}, minmax(80px, 1fr))` }}>
            <div className="sticky left-0 bg-card border border-border rounded-lg px-3 py-2 font-bold text-sm">
              Spieler
            </div>
            {gameState.players.map((player) => (
              <div key={player.id} className="relative bg-card border border-border rounded-lg px-2 py-2">
                <Input
                  value={player.name}
                  onChange={(e) => updatePlayerName(player.id, e.target.value)}
                  placeholder={`Spieler ${gameState.players.indexOf(player) + 1}`}
                  className="h-7 text-sm text-center font-medium pr-6"
                />
                {gameState.players.length > 1 && (
                  <button
                    onClick={() => removePlayer(player.id)}
                    className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <Button
            onClick={addPlayer}
            variant="outline"
            size="sm"
            className="mt-2 w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Spieler hinzufügen
          </Button>
        </div>

        {/* Score Table */}
        <div className="bg-card rounded-lg border border-border overflow-x-auto">
          <div className="min-w-max">
            {/* Upper Section */}
            <div className="border-b-2 border-border pb-2">
              <div className="bg-muted/50 px-3 py-2 font-bold text-sm sticky left-0">
                Oberer Teil
              </div>
              <ScoreRow label="Einser" description="nur Einser" players={gameState.players} fieldKey="ones" section="upper" onUpdate={updateCell} />
              <ScoreRow label="Zweier" description="nur Zweier" players={gameState.players} fieldKey="twos" section="upper" onUpdate={updateCell} />
              <ScoreRow label="Dreier" description="nur Dreier" players={gameState.players} fieldKey="threes" section="upper" onUpdate={updateCell} />
              <ScoreRow label="Vierer" description="nur Vierer" players={gameState.players} fieldKey="fours" section="upper" onUpdate={updateCell} />
              <ScoreRow label="Fünfer" description="nur Fünfer" players={gameState.players} fieldKey="fives" section="upper" onUpdate={updateCell} />
              <ScoreRow label="Sechser" description="nur Sechser" players={gameState.players} fieldKey="sixes" section="upper" onUpdate={updateCell} />
              
              <TotalRow label="Gesamt" players={gameState.players} getValue={calculateUpperSum} />
              <TotalRow label="Bonus (≥73)" players={gameState.players} getValue={(p) => calculateUpperBonus(calculateUpperSum(p))} />
              <TotalRow label="Gesamt oberer Teil" players={gameState.players} getValue={calculateUpperTotal} highlighted />
            </div>

            {/* Lower Section */}
            <div className="pt-2">
              <div className="bg-muted/50 px-3 py-2 font-bold text-sm sticky left-0">
                Unterer Teil
              </div>
              <ScoreRow label="Dreierpasch" description="alle Augen" players={gameState.players} fieldKey="threeOfKind" section="lower" onUpdate={updateCell} />
              <ScoreRow label="Viererpasch" description="alle Augen" players={gameState.players} fieldKey="fourOfKind" section="lower" onUpdate={updateCell} />
              <ScoreRow label="Zwei Paare" description="alle Augen" players={gameState.players} fieldKey="twoPairs" section="lower" onUpdate={updateCell} />
              <ScoreRow label="Drei Paare" players={gameState.players} fieldKey="threePairs" section="lower" onUpdate={updateCell} isFixed fixedPoints={FIXED_SCORES.threePairs} />
              <ScoreRow label="Zwei Dreier" players={gameState.players} fieldKey="twoThrees" section="lower" onUpdate={updateCell} isFixed fixedPoints={FIXED_SCORES.twoThrees} />
              <ScoreRow label="Full-House" players={gameState.players} fieldKey="fullHouse" section="lower" onUpdate={updateCell} isFixed fixedPoints={FIXED_SCORES.fullHouse} />
              <ScoreRow label="Großes Full-House" players={gameState.players} fieldKey="largeFullHouse" section="lower" onUpdate={updateCell} isFixed fixedPoints={FIXED_SCORES.largeFullHouse} />
              <ScoreRow label="Kleine Straße" players={gameState.players} fieldKey="smallStraight" section="lower" onUpdate={updateCell} isFixed fixedPoints={FIXED_SCORES.smallStraight} />
              <ScoreRow label="Große Straße" players={gameState.players} fieldKey="largeStraight" section="lower" onUpdate={updateCell} isFixed fixedPoints={FIXED_SCORES.largeStraight} />
              <ScoreRow label="Highway" players={gameState.players} fieldKey="highway" section="lower" onUpdate={updateCell} isFixed fixedPoints={FIXED_SCORES.highway} />
              <ScoreRow label="Kniffel" players={gameState.players} fieldKey="kniffel" section="lower" onUpdate={updateCell} isFixed fixedPoints={FIXED_SCORES.kniffel} />
              <ScoreRow label="Kniffel Extreme" players={gameState.players} fieldKey="kniffelExtreme" section="lower" onUpdate={updateCell} isFixed fixedPoints={FIXED_SCORES.kniffelExtreme} />
              <ScoreRow label="10 oder weniger" players={gameState.players} fieldKey="under10" section="lower" onUpdate={updateCell} isFixed fixedPoints={FIXED_SCORES.under10} />
              <ScoreRow label="33 oder mehr" players={gameState.players} fieldKey="over33" section="lower" onUpdate={updateCell} isFixed fixedPoints={FIXED_SCORES.over33} />
              <ScoreRow label="Chance" description="alle Augen" players={gameState.players} fieldKey="chance" section="lower" onUpdate={updateCell} />
              <ScoreRow label="Super Chance" description="alle Augen x2" players={gameState.players} fieldKey="superChance" section="lower" onUpdate={updateCell} />
              
              <TotalRow label="Gesamt unterer Teil" players={gameState.players} getValue={calculateLowerSum} />
              <TotalRow label="Endsumme" players={gameState.players} getValue={calculateGrandTotal} highlighted />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
