interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
}

export function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4">
      <p className="text-xs font-medium text-[rgb(var(--color-text-muted))]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[rgb(var(--color-text))]">
        {typeof value === 'number' ? value.toLocaleString('sv-SE') : value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs text-[rgb(var(--color-text-muted))]">{sub}</p>
      )}
    </div>
  );
}
