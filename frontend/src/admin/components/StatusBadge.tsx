const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-[rgb(var(--color-now-playing-muted))] text-[rgb(var(--color-now-playing))]',
  PROCESSING: 'bg-[rgb(var(--color-pill-bg))] text-[rgb(var(--color-text))]',
  REANALYZING: 'bg-[rgb(var(--color-pill-bg))] text-[rgb(var(--color-text))]',
  DONE: 'bg-[rgb(var(--color-selected-muted))] text-[rgb(var(--color-success))]',
  FAILED: 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-error))]',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Väntar',
  PROCESSING: 'Bearbetas',
  REANALYZING: 'Analyseras igen',
  DONE: 'Klar',
  FAILED: 'Misslyckades',
};

export function StatusBadge({ status }: { status?: string }) {
  const s = status ?? 'PENDING';
  const style = STATUS_STYLES[s] ?? STATUS_STYLES.PENDING;
  return (
    <span className={`inline-flex items-center rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium ${style}`}>
      {STATUS_LABELS[s] ?? s}
    </span>
  );
}
