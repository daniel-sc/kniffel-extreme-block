import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { GameCell, Player } from '@/types/game';

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
      <div className="sticky left-0 bg-card border-r border-border px-3 py-2 flex flex-col justify-center">
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
            <div key={player.id} className="flex flex-col gap-1 px-2 py-2 bg-card">
              <div className="flex items-center justify-center gap-1">
                <Checkbox
                  checked={isAchieved}
                  disabled={cell.struck}
                  onCheckedChange={(checked) => 
                    onUpdate(player.id, section, fieldKey, { value: checked ? 1 : null })
                  }
                />
                <span className="text-xs font-bold min-w-[2rem] text-center">
                  {cell.struck ? '0' : (isAchieved ? fixedPoints : '0')}
                </span>
              </div>
              <div className="flex items-center justify-center gap-1">
                <Checkbox
                  checked={cell.struck}
                  onCheckedChange={(checked) => 
                    onUpdate(player.id, section, fieldKey, { struck: checked as boolean })
                  }
                />
                <span className="text-[10px] text-muted-foreground">Strike</span>
              </div>
            </div>
          );
        }

        return (
          <div key={player.id} className="flex flex-col gap-1 px-2 py-2 bg-card">
            <Input
              type="number"
              min="0"
              max="999"
              value={cell.struck ? '0' : (cell.value ?? '')}
              onChange={(e) => {
                const val = e.target.value === '' ? null : parseInt(e.target.value);
                onUpdate(player.id, section, fieldKey, { value: val });
              }}
              disabled={cell.struck}
              className="h-7 text-center text-sm font-bold px-1"
            />
            <div className="flex items-center justify-center gap-1">
              <Checkbox
                checked={cell.struck}
                onCheckedChange={(checked) => 
                  onUpdate(player.id, section, fieldKey, { struck: checked as boolean })
                }
              />
              <span className="text-[10px] text-muted-foreground">Strike</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
