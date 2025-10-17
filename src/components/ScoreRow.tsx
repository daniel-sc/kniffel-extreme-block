import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { GameCell, Player } from '@/types/game';
import { X } from 'lucide-react';

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

export const ScoreRow = ({
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
          return (
            <div key={player.id} className="flex items-center justify-center gap-1 px-2 py-1.5 bg-card">
              <Checkbox
                checked={isAchieved}
                disabled={cell.struck}
                onCheckedChange={(checked) => 
                  onUpdate(player.id, section, fieldKey, { value: checked ? 1 : null })
                }
                className="h-5 w-5"
              />
              <span className="text-xs font-bold w-6 text-center">
                {cell.struck ? '0' : (isAchieved ? fixedPoints : '0')}
              </span>
              <button
                onClick={() => onUpdate(player.id, section, fieldKey, { struck: !cell.struck })}
                className={`w-6 h-6 flex items-center justify-center rounded ${cell.struck ? 'bg-destructive/20 text-destructive' : 'bg-muted hover:bg-muted/80'}`}
                title="Strike"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        }

        return (
          <div key={player.id} className="flex items-center justify-center gap-1 px-2 py-1.5 bg-card">
            <Input
              type="number"
              min="0"
              max="99"
              value={cell.struck ? '0' : (cell.value ?? '')}
              onChange={(e) => {
                const val = e.target.value === '' ? null : parseInt(e.target.value);
                onUpdate(player.id, section, fieldKey, { value: val });
              }}
              disabled={cell.struck}
              className="h-6 w-10 text-center text-xs font-bold px-1"
            />
            <button
              onClick={() => onUpdate(player.id, section, fieldKey, { struck: !cell.struck })}
              className={`w-6 h-6 flex items-center justify-center rounded ${cell.struck ? 'bg-destructive/20 text-destructive' : 'bg-muted hover:bg-muted/80'}`}
              title="Strike"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
