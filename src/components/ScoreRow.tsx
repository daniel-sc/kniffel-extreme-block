import { memo } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { GameCell, Player } from '@/types/game';
import { X } from 'lucide-react';

const strikeButtonClasses = 'box-content h-6 w-6 -m-1 p-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const strikeBadgeClasses = 'flex h-6 w-6 items-center justify-center rounded';
const scoreInputPattern = /\D+/g;

const formatScoreInputValue = (cell: GameCell) => {
  if (cell.struck) return '0';
  return cell.value === null ? '' : String(cell.value);
};

const parseScoreInputValue = (rawValue: string) => {
  const digitsOnly = rawValue.replace(scoreInputPattern, '').slice(0, 2);

  if (digitsOnly === '') {
    return null;
  }

  return Number(digitsOnly);
};

interface ScoreRowProps {
  label: string;
  description?: string;
  players: Player[];
  fieldKey: string;
  section: 'upper' | 'lower';
  onUpdate: (playerId: string, section: 'upper' | 'lower', field: string, updates: Partial<GameCell>) => void;
  isFixed?: boolean;
  fixedPoints?: number;
}

export const ScoreRow = memo(({
  label,
  description,
  players,
  fieldKey,
  section,
  onUpdate,
  isFixed = false,
  fixedPoints = 0,
}: ScoreRowProps) => {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${players.length}, minmax(80px, 1fr))` }}>
      <div className="sticky left-0 bg-card border-r border-border px-3 py-1.5 flex flex-col justify-center z-10">
        <div className="font-medium text-xs">{label}</div>
        {description && (
          <div className="text-[10px] text-muted-foreground">{description}</div>
        )}
        {isFixed && (
          <div className="text-[10px] text-primary font-semibold">{fixedPoints} Pkt</div>
        )}
      </div>

      {players.map((player) => {
        const cell = section === 'upper'
          ? player.upper[fieldKey as keyof typeof player.upper] as GameCell
          : player.lower[fieldKey as keyof typeof player.lower] as GameCell;

        if (isFixed) {
          const isAchieved = cell.value === 1 && !cell.struck;
          const achievedId = `${section}-${fieldKey}-${player.id}-achieved`;

          return (
            <div key={player.id} className="flex items-center justify-center gap-1 px-2 py-1.5 bg-card">
              <label
                htmlFor={achievedId}
                className={`inline-flex select-none items-center gap-1 rounded-md px-1 py-1.5 -mx-1 -my-1.5 ${cell.struck ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted/60'}`}
              >
                <Checkbox
                  id={achievedId}
                  checked={isAchieved}
                  disabled={cell.struck}
                  onCheckedChange={(checked) =>
                    onUpdate(player.id, section, fieldKey, { value: checked ? 1 : null })
                  }
                  className="h-5 w-5"
                  aria-label={`${label} erreichen`}
                />
                <span className="w-6 text-center text-xs font-bold">
                  {cell.struck ? '0' : (isAchieved ? fixedPoints : '0')}
                </span>
              </label>
              <button
                type="button"
                onClick={() => onUpdate(player.id, section, fieldKey, { struck: !cell.struck })}
                className={strikeButtonClasses}
                title="Strike"
                aria-label={`${label} streichen`}
              >
                <span className={`${strikeBadgeClasses} ${cell.struck ? 'bg-destructive/20 text-destructive' : 'bg-muted hover:bg-muted/80'}`}>
                  <X className="w-3 h-3" />
                </span>
              </button>
            </div>
          );
        }

        return (
          <div key={player.id} className="flex items-center justify-center gap-1 px-2 py-1.5 bg-card">
            <Input
              // Use text + inputMode instead of type=number to avoid iOS/WebKit
              // rendering desyncs where externally synced values can fail to appear
              // in the visible field while React state has already updated.
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              value={formatScoreInputValue(cell)}
              onChange={(e) => {
                const val = parseScoreInputValue(e.target.value);
                onUpdate(player.id, section, fieldKey, { value: val });
              }}
              disabled={cell.struck}
              className="h-6 w-10 text-center text-xs font-bold px-1"
            />
            <button
              type="button"
              onClick={() => onUpdate(player.id, section, fieldKey, { struck: !cell.struck })}
              className={strikeButtonClasses}
              title="Strike"
              aria-label={`${label} streichen`}
            >
              <span className={`${strikeBadgeClasses} ${cell.struck ? 'bg-destructive/20 text-destructive' : 'bg-muted hover:bg-muted/80'}`}>
                <X className="w-3 h-3" />
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
});
