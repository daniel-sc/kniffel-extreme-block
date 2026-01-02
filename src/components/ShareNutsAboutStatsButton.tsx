import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useGameState } from '@/hooks/useGameState';
import { useShareSettings } from '@/hooks/useShareSettings';
import { useTouchLongPress } from '@/hooks/useTouchLongPress';
import { calculateUpperSum, calculateUpperBonus, calculateGrandTotal } from '@/utils/scoreCalculations';
import { cn } from '@/lib/utils';

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
  const { shareSettings, updateShareSettings } = useShareSettings();
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [tempGameName, setTempGameName] = useState(shareSettings.gameName);
  const [isSettingsActionVisible, setIsSettingsActionVisible] = useState(false);
  const hideSettingsTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!isSettingsDialogOpen) {
      setTempGameName(shareSettings.gameName);
    }
  }, [isSettingsDialogOpen, shareSettings.gameName]);

  const openShareSettingsDialog = React.useCallback(() => {
    setTempGameName(shareSettings.gameName);
    setIsSettingsDialogOpen(true);
  }, [shareSettings.gameName]);

  const clearHideSettingsTimeout = React.useCallback(() => {
    if (hideSettingsTimeoutRef.current) {
      window.clearTimeout(hideSettingsTimeoutRef.current);
      hideSettingsTimeoutRef.current = null;
    }
  }, []);

  const showSettingsAction = React.useCallback(() => {
    clearHideSettingsTimeout();
    setIsSettingsActionVisible(true);
  }, [clearHideSettingsTimeout]);

  const hideSettingsAction = React.useCallback(
    (delay: number = 200) => {
      clearHideSettingsTimeout();
      if (delay <= 0) {
        setIsSettingsActionVisible(false);
        return;
      }

      hideSettingsTimeoutRef.current = window.setTimeout(() => {
        setIsSettingsActionVisible(false);
        hideSettingsTimeoutRef.current = null;
      }, delay);
    },
    [clearHideSettingsTimeout]
  );

  const revealShareSettingsButton = React.useCallback(() => {
    showSettingsAction();
    hideSettingsAction(4000);
  }, [showSettingsAction, hideSettingsAction]);

  React.useEffect(() => {
    if (isSettingsDialogOpen) {
      hideSettingsAction(0);
    }
  }, [isSettingsDialogOpen, hideSettingsAction]);

  React.useEffect(() => {
    return () => {
      clearHideSettingsTimeout();
    };
  }, [clearHideSettingsTimeout]);


  const {
    handlePointerDown: handleShareLongPressPointerDown,
    handlePointerUp: handleShareLongPressPointerUp,
    handlePointerLeave: handleShareLongPressPointerLeave,
    handlePointerCancel: handleShareLongPressPointerCancel,
    handlePointerEnter: handleShareLongPressPointerEnter,
    shouldHandleClick: shouldHandleShareButtonClick,
  } = useTouchLongPress(revealShareSettingsButton);

  const handleShareSettingsOpenChange = (open: boolean) => {
    setIsSettingsDialogOpen(open);
  };

  const handleShareSettingsSave = () => {
    const trimmed = tempGameName.trim();
    if (!trimmed) {
      return;
    }

    updateShareSettings({ gameName: trimmed });
    setTempGameName(trimmed);
    setIsSettingsDialogOpen(false);
  };

  const handleShareButtonClick = () => {
    if (!shouldHandleShareButtonClick()) {
      return;
    }

    hideSettingsAction(0);
    handleShare();
  };

  const handleShareSettingsButtonClick = () => {
    openShareSettingsDialog();
    hideSettingsAction(0);
  };

  const isSaveDisabled = tempGameName.trim().length === 0;
  const settingsButtonClasses = cn(
    'absolute right-0 top-full mt-2 z-50 transition-all duration-200',
    'opacity-0 translate-y-1 scale-95 pointer-events-none',
    isSettingsActionVisible && 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
  );

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
        game: shareSettings.gameName,
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
        onClick={handleShareButtonClick}
        onPointerDown={handleShareLongPressPointerDown}
        onPointerUp={handleShareLongPressPointerUp}
        onPointerLeave={handleShareLongPressPointerLeave}
        onPointerCancel={handleShareLongPressPointerCancel}
        onPointerEnter={handleShareLongPressPointerEnter}
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
      <div className={settingsButtonClasses}>
        <Button
          variant="outline"
          onClick={handleShareSettingsButtonClick}
          className="min-w-[150px] justify-center shadow-lg select-none"
          onPointerEnter={() => showSettingsAction()}
          onPointerLeave={() => hideSettingsAction()}
          onFocus={showSettingsAction}
          onBlur={() => hideSettingsAction()}
          tabIndex={isSettingsActionVisible ? 0 : -1}
          aria-hidden={!isSettingsActionVisible}
        >
          Share-Einstellungen
        </Button>
      </div>
      {/* Tooltip for unsupported browsers */}
      {showTooltip && (
        <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 text-xs text-muted-foreground bg-background px-3 py-2 rounded shadow border border-border whitespace-nowrap">
          {tooltipText}
        </span>
      )}
      <Dialog open={isSettingsDialogOpen} onOpenChange={handleShareSettingsOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share-Einstellungen</DialogTitle>
            <DialogDescription>
              Passe den Spielnamen an, der im Export verwendet wird.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="share-settings-game-name">Spielname</Label>
            <Input
              id="share-settings-game-name"
              value={tempGameName}
              onChange={(event) => setTempGameName(event.target.value)}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleShareSettingsOpenChange(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleShareSettingsSave} disabled={isSaveDisabled}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
