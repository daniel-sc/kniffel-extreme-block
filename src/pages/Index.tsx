import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { useElementSize } from '@/hooks/useElementSize';
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
import { cn } from '@/lib/utils';
import { Dices, RotateCcw, Plus, X, RefreshCcw } from 'lucide-react';


const Index = () => {
  const { gameState, setGameState, updateCell, updatePlayerName, addPlayer, removePlayer, resetGame, revancheGame } = useGameState();

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const lastAddedPlayerId = useRef<string | null>(null);
  const { ref: headerRef, size: headerSize } = useElementSize<HTMLDivElement>();
  const headerOffset = headerSize.height || 88;
  const pageStyles = { paddingTop: headerOffset,   'overflow-y': 'auto', 'overflow-x': 'visible' };

  const [isRevancheVisible, setIsRevancheVisible] = useState(false);
  const revancheContainerClasses = cn(
    'absolute right-0 top-full mt-2 z-20 transition-all duration-200',
    'opacity-0 translate-y-1 scale-95 pointer-events-none',
    isRevancheVisible && 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
  );


  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideRevancheTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clearLongPressTimeout = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const clearHideTimeout = () => {
    if (hideRevancheTimeoutRef.current) {
      clearTimeout(hideRevancheTimeoutRef.current);
      hideRevancheTimeoutRef.current = null;
    }
  };

  const showRevanche = () => {
    clearHideTimeout();
    setIsRevancheVisible(true);
  };

  const hideRevanche = (delay: number = 200) => {
    clearHideTimeout();
    if (delay <= 0) {
      setIsRevancheVisible(false);
      return;
    }

    hideRevancheTimeoutRef.current = setTimeout(() => {
      setIsRevancheVisible(false);
      hideRevancheTimeoutRef.current = null;
    }, delay);
  };

  const revealRevancheButton = () => {
    showRevanche();
    hideRevanche(4000);
  };

  const handleResetPointerEnter = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse') {
      showRevanche();
    }
  };

  const handleResetPointerLeave = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse') {
      hideRevanche();
    }
    clearLongPressTimeout();
  };

  const handleResetFocus = () => {
    showRevanche();
  };

  const handleResetBlur = () => {
    hideRevanche();
  };

  const handleResetPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse') {
      return;
    }

    longPressTriggeredRef.current = false;
    clearLongPressTimeout();
    longPressTimeoutRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      revealRevancheButton();
    }, 600);
  };

  const handleResetPointerEnd = () => {
    clearLongPressTimeout();
  };

  const handleRevanchePointerEnter = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse') {
      showRevanche();
    }
  };

  const handleRevanchePointerLeave = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse') {
      hideRevanche();
    }
  };

  const handleRevancheFocus = () => {
    showRevanche();
  };

  const handleRevancheBlur = () => {
    hideRevanche();
  };

  const handleResetClick = () => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    hideRevanche(0);
    resetGame();
  };

  const handleRevancheClick = () => {
    revancheGame();
    hideRevanche(0);
    longPressTriggeredRef.current = false;
  };

  useEffect(() => {
    return () => {
      clearLongPressTimeout();
      clearHideTimeout();
    };
  }, []);


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
    <div className="h-svh bg-background relative" style={pageStyles}>
      {/* Header */}
      <header ref={headerRef} className="fixed top-0 left-0 right-0 z-10 bg-background border-b-4 shadow-md">
        <div className="container max-w-full mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Dices className="w-8 h-8 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Kniffel Extreme</h1>
            </div>
            <div className="flex gap-2 items-center relative">
              <ShareDialog
                peerId={peerId}
                connectedPeers={connectedPeers}
                isConnecting={isConnecting}
                onConnect={connectToPeer}
              />
              <ShareNutsAboutStatsButton />
              <div className="relative">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleResetClick}
                  onPointerDown={handleResetPointerDown}
                  onPointerUp={handleResetPointerEnd}
                  onPointerLeave={handleResetPointerLeave}
                  onPointerCancel={handleResetPointerEnd}
                  onPointerEnter={handleResetPointerEnter}
                  onFocus={handleResetFocus}
                  onBlur={handleResetBlur}
                  aria-label="Spiel zurücksetzen"
                >
                  <RotateCcw className="w-5 h-5" />
                </Button>
                <div className={revancheContainerClasses}>
                    <Button
                      variant="outline"
                      onClick={handleRevancheClick}
                      className="min-w-[130px] justify-center shadow-lg select-none"
                      onPointerEnter={handleRevanchePointerEnter}
                      onPointerLeave={handleRevanchePointerLeave}
                      onFocus={handleRevancheFocus}
                      onBlur={handleRevancheBlur}
                      tabIndex={isRevancheVisible ? 0 : -1}
                      aria-hidden={!isRevancheVisible}
                    >
                      <RefreshCcw className="w-4 h-4" />
                      Revanche
                    </Button>
                </div>
              </div>
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
        {/* optimally, only this table would scroll horizontally, but this is not possible as sticky does not respect specific axis! */}
        <div className="bg-card rounded-lg border border-border z-20 relative">
            <div className="min-w-min bg-background">
              {/* Player Names Header - Read Only */}

              <div className="sticky z-30 bg-card border-b-2 border-border shadow-sm" style={{top: `-${headerOffset}px`}}>
                <div className="grid gap-2 py-2" style={{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${gameState.players.length}, minmax(80px, 1fr))` }}>

                <div className="sticky left-0 bg-card px-3 py-1 font-bold text-xs z-10">
                  Spieler
                </div>
                {gameState.players.map((player, index) => (
                  <div key={player.id} className="px-2 text-center text-xs font-medium z-10 truncate">
                    {player.name || `Spieler ${index + 1}`}
                  </div>
                ))}
              </div>
            </div>

            {/* Upper Section */}
            <div className="border-b-2 border-border pb-2 z-20 bg-background">
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
              <TotalRow label="Gesamt oberer Teil" players={gameState.players} getValue={calculateUpperTotal} />
            </div>

            {/* Lower Section */}
            <div className="pt-2 z-20 bg-background">
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
              <TotalRow label="Endsumme" players={gameState.players} getValue={calculateGrandTotal} highlighted stickyBottom />
            </div>
          </div>
      </div>
      </main>
    </div>
  );
};

export default Index;
