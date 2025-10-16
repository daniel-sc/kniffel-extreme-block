import { Checkbox } from '@/components/ui/checkbox';
import { GameCell, FIXED_SCORES } from '@/types/game';

interface FixedScoreToggleProps {
  label: string;
  points: number;
  cell: GameCell;
  onToggle: (achieved: boolean) => void;
  onStruckChange: (struck: boolean) => void;
}

export const FixedScoreToggle = ({
  label,
  points,
  cell,
  onToggle,
  onStruckChange,
}: FixedScoreToggleProps) => {
  const isAchieved = cell.value === 1 && !cell.struck;

  return (
    <div className="flex items-center gap-3 py-3 px-4 bg-card rounded-lg shadow-[var(--shadow-card)] border border-border transition-all hover:shadow-[var(--shadow-elevated)]">
      <div className="flex-1">
        <div className="font-medium text-sm text-foreground">{label}</div>
        <div className="text-xs text-primary font-semibold">{points} Punkte</div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`achieved-${label}`}
            checked={isAchieved}
            disabled={cell.struck}
            onCheckedChange={(checked) => onToggle(checked as boolean)}
          />
          <label
            htmlFor={`achieved-${label}`}
            className="text-sm font-bold text-foreground cursor-pointer select-none min-w-[3rem] text-right"
          >
            {cell.struck ? '0' : (isAchieved ? points : '0')}
          </label>
        </div>
        
        <div className="flex items-center gap-2">
          <Checkbox
            id={`strike-${label}`}
            checked={cell.struck}
            onCheckedChange={(checked) => onStruckChange(checked as boolean)}
          />
          <label
            htmlFor={`strike-${label}`}
            className="text-xs text-muted-foreground cursor-pointer select-none"
          >
            Strike
          </label>
        </div>
      </div>
    </div>
  );
};
