import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScoreRow } from '@/components/ScoreRow';
import { TotalRow } from '@/components/TotalRow';
import { ShareDialog } from '@/components/ShareDialog';
import { ShareNutsAboutStatsButton } from '@/components/ShareNutsAboutStatsButton';
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
  const { gameState, setGameState, updateCell, updatePlayerName, addPlayer, removePlayer, resetGame } = useGameState();
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const lastAddedPlayerId = useRef<string | null>(null);

  const handleAddPlayer = () => {
    const newPlayerId = addPlayer();
    if (newPlayerId) {
      lastAddedPlayerId.current = newPlayerId;
    }
  };

  // Peer sync
  const handleRemoteUpdate = (remoteState: GameState) => {
    setGameState(remoteState);
  };

  const { peerId, connectedPeers, isConnecting, connectToPeer, broadcastState } =
    usePeerSync(gameState, handleRemoteUpdate);

  // Broadcast state changes to connected peers
  useEffect(() => {
    if (connectedPeers.length > 0) {
      broadcastState(gameState);
    }
  }, [gameState, connectedPeers.length, broadcastState]);

  useEffect(() => {
    if (!lastAddedPlayerId.current) return;
    const newInput = inputRefs.current[lastAddedPlayerId.current];
    if (newInput) {
      newInput.focus();
      lastAddedPlayerId.current = null;
    }
  }, [gameState.players]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b-4">
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
              <ShareNutsAboutStatsButton />
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

      <main className="container max-w-full mx-auto px-0 py-4">
        {/* Player Names Management */}
        <div className="bg-card rounded-lg border border-border p-4 mb-4 mx-2">
          <h2 className="text-sm font-bold mb-3">Spieler</h2>
          <div className="space-y-2">
            {gameState.players.map((player, index) => (
              <div key={player.id} className="flex gap-2 items-center">
                <Input
                  value={player.name}
                  onChange={(e) => updatePlayerName(player.id, e.target.value)}
                  placeholder={`Spieler ${index + 1}`}
                  className="h-9 text-sm flex-1"
                  ref={(el) => {
                    if (el) {
                      inputRefs.current[player.id] = el;
                    } else {
                      delete inputRefs.current[player.id];
                    }
                  }}
                />
                {gameState.players.length > 1 && (
                  <Button
                    onClick={() => removePlayer(player.id)}
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              onClick={handleAddPlayer}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-1" />
              Spieler hinzufügen
            </Button>
          </div>
        </div>

        {/* Score Table */}
        <div className="bg-card rounded-lg border border-border">
            <div className="w-full overflow-x-auto overflow-y-visible">
          <div className="min-w-min bg-background">
            {/* Player Names Header - Read Only */}
            {/* TODO sticky brokwn */}
            <div className="sticky top-0 z-30 bg-card border-b-2 border-border">
              <div className="grid gap-2 py-2" style={{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${gameState.players.length}, minmax(80px, 1fr))` }}>
                <div className="sticky left-0 bg-card px-3 py-1 font-bold text-xs z-10">
                  Spieler
                </div>
                {gameState.players.map((player, index) => (
                  <div key={player.id} className="px-2 text-center text-xs font-medium truncate">
                    {player.name || `Spieler ${index + 1}`}
                  </div>
                ))}
              </div>
            </div>

            {/* Upper Section */}
            <div className="border-b-2 border-border pb-2 z-20 relative bg-background">
              <div className="grid" style={{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${gameState.players.length}, minmax(80px, 1fr))` }}>
                <div className="bg-muted px-3 py-2 font-bold text-sm sticky left-0 z-10">
                  Oberer Teil
                </div>
              {gameState.players.map(p =>
              <div key={p.id} className="bg-muted"></div>
              )}

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
            <div className="pt-2 z-20 relative bg-background">
              <div className="grid" style={{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${gameState.players.length}, minmax(80px, 1fr))` }}>
                <div className="bg-muted px-3 py-2 font-bold text-sm sticky left-0 z-10">
                  Unterer Teil
                </div>
                {gameState.players.map(p =>
                <div key={p.id} className="bg-muted"></div>
                )}
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
        </div>
      </main>
    </div>
  );
};

export default Index;
