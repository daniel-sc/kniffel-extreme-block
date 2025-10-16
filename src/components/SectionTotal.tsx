interface SectionTotalProps {
  label: string;
  value: number;
  highlighted?: boolean;
}

export const SectionTotal = ({ label, value, highlighted = false }: SectionTotalProps) => {
  return (
    <div
      className={`flex items-center justify-between py-4 px-4 rounded-lg font-bold ${
        highlighted
          ? 'bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-[var(--shadow-elevated)]'
          : 'bg-secondary text-secondary-foreground'
      }`}
    >
      <span className="text-sm uppercase tracking-wide">{label}</span>
      <span className="text-2xl tabular-nums">{value}</span>
    </div>
  );
};
