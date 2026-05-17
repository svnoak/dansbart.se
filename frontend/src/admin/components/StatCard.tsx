interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  delta?: number;
}

export function StatCard({ label, value, sub, delta }: StatCardProps) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4">
      <p className="text-xs font-medium text-[rgb(var(--color-text-muted))]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[rgb(var(--color-text))]">
        {typeof value === 'number' ? value.toLocaleString('sv-SE') : value}
      </p>
      <div className="mt-0.5 flex items-center gap-2">
        {sub && <p className="text-xs text-[rgb(var(--color-text-muted))]">{sub}</p>}
        {delta !== undefined && delta !== 0 && (
          <p className={`text-xs font-medium ${delta > 0 ? 'text-green-500' : 'text-[rgb(var(--color-text-muted))]'}`}>
            {delta > 0 ? `↑${delta.toLocaleString('sv-SE')}` : `↓${Math.abs(delta).toLocaleString('sv-SE')}`}
          </p>
        )}
      </div>
    </div>
  );
}
