import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useGameState } from '@/hooks/useGameState';
import { calculateUpperSum, calculateUpperBonus, calculateGrandTotal } from '@/utils/scoreCalculations';

/**
 * Apple-style share icon SVG (box + arrow)
 */
const AppleShareIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" {...props}>
    <rect x="4" y="8" width="16" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
    <path d="M12 3v10M12 3l-3.5 3.5M12 3l3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ShareNutsAboutStatsButton: React.FC = () => {
  const { gameState } = useGameState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canShareFiles, setCanShareFiles] = useState<boolean | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  // On mount, check for Web Share API file support
  React.useEffect(() => {
      // NOTE: this only works on secure contexts (https or localhost)!
    try {
      const dummyFile = new File(['{}'], 'dummy.nutsaboutstats', {
          type: 'application/vnd.com.nutsaboutstats+json'
      });
      const supported = typeof navigator !== 'undefined' && 'canShare' in navigator && navigator.canShare({ files: [dummyFile] });
      setCanShareFiles(!!supported);
    } catch {
      setCanShareFiles(false);
    }
  }, []);

  // Helper: get ordered player names
  const getPlayerNames = () => gameState.players.map((p, i) => p.name || `Spieler ${i+1}`);

  // Helper: get bonus status
  const getBonus = () => {
    const bonus: Record<string, boolean> = {};
    gameState.players.forEach((p, i) => {
      bonus[p.name || `Spieler ${i+1}`] = calculateUpperBonus(calculateUpperSum(p)) > 0;
    });
    return bonus;
  };

  // Helper: get points
  const getPoints = () => {
    const points: Record<string, number> = {};
    gameState.players.forEach((p, i) => {
      points[p.name || `Spieler ${i+1}`] = calculateGrandTotal(p);
    });
    return points;
  };

  // Helper: get starting player (first in array)
  const getStartingPlayer = () => getPlayerNames()[0] || '';

  // Helper: get winner (highest points)
  const getWinner = () => {
    const points = getPoints();
    let winner = getPlayerNames()[0] || '';
    let max = points[winner] ?? 0;
    for (const name of getPlayerNames()) {
      if ((points[name] ?? 0) > max) {
        winner = name;
        max = points[name] ?? 0;
      }
    }
    return winner;
  };

  // Main share handler
  const handleShare = async () => {
    setError(null);
    setLoading(true);
    try {
      // Prepare payload
      const payload = {
        players: getPlayerNames(),
        Bonus: getBonus(),
        Points: getPoints(),
        'Starting Player': getStartingPlayer(),
        Winner: getWinner(),
      };
      const json = JSON.stringify(payload, null, 2);
      const file = new File([
        json
      ], 'export.nutsaboutstats', {
        type: 'application/vnd.com.nutsaboutstats+json',
      });
      // Check share support
      if (navigator.canShare?.({ files: [file] })) {
          console.log('Sharing file via Web Share API:', file);
        await navigator.share({
          files: [file],
          title: 'Nuts About Stats Transfer',
        });
      } else {
        setError('Share not supported on this browser');
      }
    } catch (e) {
      setError('Error preparing share: ' + (e instanceof Error ? e.message : String(e)));
      console.log('Share error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Tooltip text
  const tooltipText = 'Teilen ist nur auf mobilen Browsern (Android Chrome, iOS Safari) verfügbar.';

  // Button event handlers for tooltip
  const handleMouseEnter = () => { if (canShareFiles === false) setShowTooltip(true); };
  const handleMouseLeave = () => { setShowTooltip(false); };
  const handleTouchStart = () => { if (canShareFiles === false) setShowTooltip(true); };
  const handleTouchEnd = () => { setShowTooltip(false); };

  return (
    <div className="relative inline-block">
      <Button
        variant="secondary"
        size="icon"
        onClick={handleShare}
        disabled={loading || canShareFiles === false}
        title="Mit Nuts About Stats teilen"
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        tabIndex={0}
        aria-disabled={loading || canShareFiles === false}
      >
        <AppleShareIcon className="w-5 h-5" />
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="w-4 h-4 animate-spin" />
          </span>
        )}
        {/* Error message below button */}
        {error && (
          <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 text-xs text-destructive bg-background px-2 py-1 rounded shadow">
            {error}
          </span>
        )}
      </Button>
      {/* Tooltip for unsupported browsers */}
      {showTooltip && (
        <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 text-xs text-muted-foreground bg-background px-3 py-2 rounded shadow border border-border whitespace-nowrap">
          {tooltipText}
        </span>
      )}
    </div>
  );
};
