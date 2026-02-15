export function ConfidenceBadge({ value }: { value?: number }) {
  if (value == null) return <span className="text-[rgb(var(--color-text-muted))]">-</span>;
  const pct = Math.round(value * 100);
  const color =
    pct >= 80
      ? 'text-green-700 dark:text-green-400'
      : pct >= 50
        ? 'text-yellow-700 dark:text-yellow-400'
        : 'text-red-700 dark:text-red-400';
  return <span className={`text-xs font-medium ${color}`}>{pct}%</span>;
}
