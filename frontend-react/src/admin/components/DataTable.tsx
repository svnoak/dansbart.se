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
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
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
  selectable = false,
  selectedKeys,
  onSelectionChange,
}: DataTableProps<T>) {
  const selected = selectedKeys ?? new Set<string>();
  const allKeys = data.map(keyFn);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k));
  const someSelected = allKeys.some((k) => selected.has(k));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      const next = new Set(selected);
      allKeys.forEach((k) => next.delete(k));
      onSelectionChange(next);
    } else {
      const next = new Set(selected);
      allKeys.forEach((k) => next.add(k));
      onSelectionChange(next);
    }
  };

  const toggleRow = (key: string) => {
    if (!onSelectionChange) return;
    const next = new Set(selected);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onSelectionChange(next);
  };

  const totalCols = selectable ? columns.length + 1 : columns.length;

  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))]">
            {selectable && (
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={toggleAll}
                  className="rounded border-[rgb(var(--color-border))]"
                />
              </th>
            )}
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
              <SkeletonRow key={i} cols={totalCols} />
            ))
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={totalCols}
                className="px-3 py-12 text-center text-[rgb(var(--color-text-muted))]"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => {
              const key = keyFn(row);
              const isSelected = selected.has(key);
              return (
                <tr
                  key={key}
                  className={`border-b border-[rgb(var(--color-border))]/50 last:border-b-0 transition-colors ${
                    isSelected
                      ? 'bg-[rgb(var(--color-primary))]/5'
                      : 'hover:bg-[rgb(var(--color-bg))]/50'
                  }`}
                >
                  {selectable && (
                    <td className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(key)}
                        className="rounded border-[rgb(var(--color-border))]"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={`px-3 py-2.5 ${col.className ?? ''}`}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
