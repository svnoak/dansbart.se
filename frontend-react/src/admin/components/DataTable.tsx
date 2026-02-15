import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyFn: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }, (_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 rounded bg-[rgb(var(--color-border))]/60 animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export function DataTable<T>({
  columns,
  data,
  keyFn,
  loading = false,
  emptyMessage = 'Inga resultat hittades.',
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2.5 text-left font-medium text-[rgb(var(--color-text-muted))] ${col.className ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-[rgb(var(--color-bg-elevated))]">
          {loading ? (
            Array.from({ length: 8 }, (_, i) => (
              <SkeletonRow key={i} cols={columns.length} />
            ))
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-12 text-center text-[rgb(var(--color-text-muted))]"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={keyFn(row)}
                className="border-b border-[rgb(var(--color-border))]/50 last:border-b-0 hover:bg-[rgb(var(--color-bg))]/50 transition-colors"
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-3 py-2.5 ${col.className ?? ''}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
