import { Button } from '@/ui';

interface PaginationProps {
  offset: number;
  limit: number;
  total: number;
  onChange: (offset: number) => void;
}

export function Pagination({ offset, limit, total, onChange }: PaginationProps) {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        Visar {Math.min(offset + 1, total)}-{Math.min(offset + limit, total)} av{' '}
        {total.toLocaleString('sv-SE')}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasPrev}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          Föregående
        </Button>
        <span className="text-sm text-[rgb(var(--color-text-muted))]">
          {page} / {totalPages}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasNext}
          onClick={() => onChange(offset + limit)}
        >
          Nästa
        </Button>
      </div>
    </div>
  );
}
