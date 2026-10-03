import { Card } from '@/ui';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  delta?: number;
}

export function StatCard({ label, value, sub, delta }: StatCardProps) {
  return (
    <Card className="p-4">
      <p className="text-sm font-medium text-[rgb(var(--color-text-muted))]">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-[rgb(var(--color-text))]">
        {typeof value === 'number' ? value.toLocaleString('sv-SE') : value}
      </p>
      <div className="mt-0.5 flex items-center gap-2">
        {sub && <p className="text-sm text-[rgb(var(--color-text-muted))]">{sub}</p>}
        {delta !== undefined && delta !== 0 && (
          <p className={`text-sm font-medium ${delta > 0 ? 'text-[rgb(var(--color-success))]' : 'text-[rgb(var(--color-text-muted))]'}`}>
            {delta > 0 ? `↑${delta.toLocaleString('sv-SE')}` : `↓${Math.abs(delta).toLocaleString('sv-SE')}`}
          </p>
        )}
      </div>
    </Card>
  );
}
