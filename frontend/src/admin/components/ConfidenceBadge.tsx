/** A confidence in percent, coloured by how sure the analysis is. */
export function ConfidenceBadge({ value }: { value?: number }) {
  if (value == null) return <span className="text-[13px] text-[rgb(var(--color-text-muted))]">-</span>;
  const pct = Math.round(value * 100);
  const color =
    pct >= 80
      ? 'text-[rgb(var(--color-success))]'
      : pct >= 50
        ? 'text-[rgb(var(--color-now-playing-text))]'
        : 'text-[rgb(var(--color-error))]';
  return <span className={`text-[13px] font-semibold tabular-nums ${color}`}>{pct}%</span>;
}
