import { Player } from '@/types/game';

interface TotalRowProps {
  label: string;
  players: Player[];
  getValue: (player: Player) => number;
  highlighted?: boolean;
}

export const TotalRow = ({ label, players, getValue, highlighted = false }: TotalRowProps) => {
  return (
    <div 
      className={`grid gap-2 ${highlighted ? 'bg-primary/5 border-y border-primary/20' : ''}`}
      style={{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${players.length}, minmax(80px, 1fr))` }}
    >
      <div className="sticky left-0 bg-card border-r border-border px-3 py-1.5 font-bold text-xs z-10">
        {label}
      </div>
      {players.map((player) => (
        <div 
          key={player.id} 
          className={`px-2 py-1.5 text-center font-bold text-sm ${highlighted ? 'text-primary' : ''}`}
        >
          {getValue(player)}
        </div>
      ))}
    </div>
  );
};
