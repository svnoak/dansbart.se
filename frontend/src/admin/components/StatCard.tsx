import { Card } from '@/ui';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  delta?: number;
}

/** One number with its label, and optionally a helper line and a change. */
export function StatCard({ label, value, sub, delta }: StatCardProps) {
  return (
    <Card className="p-4">
      <p className="text-[13px] font-medium text-[rgb(var(--color-text-muted))]">{label}</p>
      <p className="mt-1 text-[28px] font-bold leading-tight tabular-nums text-[rgb(var(--color-text))]">
        {typeof value === 'number' ? value.toLocaleString('sv-SE') : value}
      </p>
      {(sub || (delta !== undefined && delta !== 0)) && (
        <div className="mt-1 flex items-center gap-2">
          {sub && <p className="text-[13px] text-[rgb(var(--color-text-muted))]">{sub}</p>}
          {delta !== undefined && delta !== 0 && (
            <p
              className={`text-[13px] font-semibold tabular-nums ${
                delta > 0 ? 'text-[rgb(var(--color-success))]' : 'text-[rgb(var(--color-text-muted))]'
              }`}
            >
              {delta > 0 ? `↑${delta.toLocaleString('sv-SE')}` : `↓${Math.abs(delta).toLocaleString('sv-SE')}`}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
