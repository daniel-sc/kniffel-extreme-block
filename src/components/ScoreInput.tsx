import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { GameCell } from '@/types/game';

interface ScoreInputProps {
  label: string;
  cell: GameCell;
  onValueChange: (value: number | null) => void;
  onStruckChange: (struck: boolean) => void;
  description?: string;
}

export const ScoreInput = ({
  label,
  cell,
  onValueChange,
  onStruckChange,
  description,
}: ScoreInputProps) => {
  return (
    <div className="flex items-center gap-3 py-3 px-4 bg-card rounded-lg shadow-[var(--shadow-card)] border border-border transition-all hover:shadow-[var(--shadow-elevated)]">
      <div className="flex-1">
        <div className="font-medium text-sm text-foreground">{label}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        <Input
          type="number"
          min="0"
          max="999"
          value={cell.struck ? '0' : (cell.value ?? '')}
          onChange={(e) => {
            const val = e.target.value === '' ? null : parseInt(e.target.value);
            onValueChange(val);
          }}
          disabled={cell.struck}
          className="w-20 text-center font-bold text-lg"
        />
        
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
