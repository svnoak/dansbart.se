interface RowSkeletonProps {
  /** How many placeholder rows to draw. */
  rows?: number;
  /** What is loading, read by screen readers. */
  label?: string;
  className?: string;
}

const WIDTHS = ['55%', '40%', '62%', '48%', '58%'];

/**
 * The one loading state for every list. Three bars per row, the shape of a
 * track row, so the page does not jump when the rows arrive.
 */
export function RowSkeleton({ rows = 3, label = 'Laddar', className = '' }: RowSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={`overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] ${className}`}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 px-4 py-3 ${i < rows - 1 ? 'border-b border-[rgb(var(--color-border))]' : ''}`}
        >
          <span className="h-11 w-11 shrink-0 rounded-full bg-[rgb(var(--color-accent-muted))]" />
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="h-3 rounded-full bg-[rgb(var(--color-accent-muted))]" style={{ width: WIDTHS[i % WIDTHS.length] }} />
            <span className="h-2.5 w-1/3 rounded-full bg-[rgb(var(--color-accent-muted))]" />
          </span>
          <span className="h-6 w-18 shrink-0 rounded-full bg-[rgb(var(--color-accent-muted))]" />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
