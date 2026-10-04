const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-[rgb(var(--color-now-playing))]/15 text-[rgb(var(--color-now-playing-text))]',
  PROCESSING: 'bg-[rgb(var(--color-selected))]/10 text-[rgb(var(--color-selected))]',
  REANALYZING: 'bg-[rgb(var(--color-selected))]/10 text-[rgb(var(--color-selected))]',
  DONE: 'bg-[rgb(var(--color-success))]/12 text-[rgb(var(--color-success))]',
  FAILED: 'bg-[rgb(var(--color-error))]/10 text-[rgb(var(--color-error))]',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Väntar',
  PROCESSING: 'Bearbetas',
  REANALYZING: 'Analyseras om',
  DONE: 'Klar',
  FAILED: 'Misslyckades',
};

/**
 * A track's processing status as a word. The raw status stays in `title`
 * for anyone who knows the codes.
 */
export function StatusBadge({ status }: { status?: string }) {
  const s = status ?? 'PENDING';
  const style = STATUS_STYLES[s] ?? STATUS_STYLES.PENDING;
  const label = STATUS_LABELS[s] ?? s;
  return (
    <span
      title={s}
      className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[13px] font-semibold ${style}`}
    >
      {label}
    </span>
  );
}
