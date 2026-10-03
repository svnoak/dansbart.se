import type { ReactNode } from 'react';
import { Card } from '@/ui';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string;
  direction: SortDirection;
}

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  sortKey?: string;
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
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }, (_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 animate-pulse rounded-[var(--radius-sm)] bg-[rgb(var(--color-pill-bg))]" />
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
  sort,
  onSortChange,
}: DataTableProps<T>) {
  const selected = selectedKeys ?? new Set<string>();
  const allKeys = data.map(keyFn);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k));
  const someSelected = allKeys.some((k) => selected.has(k));

  const handleSort = (col: Column<T>) => {
    if (!col.sortKey || !onSortChange) return;
    if (sort?.key === col.sortKey) {
      if (sort.direction === 'asc') {
        onSortChange({ key: col.sortKey, direction: 'desc' });
      } else {
        onSortChange(null);
      }
    } else {
      onSortChange({ key: col.sortKey, direction: 'asc' });
    }
  };

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
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-sunken))]">
            {selectable && (
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={toggleAll}
                  aria-label="Markera alla rader"
                  className="h-5 w-5 rounded-[var(--radius-sm)] border-[rgb(var(--color-border-strong))] accent-[rgb(var(--color-accent))]"
                />
              </th>
            )}
            {columns.map((col) => {
              const sortable = !!col.sortKey && !!onSortChange;
              const isActive = sort?.key === col.sortKey;
              return (
                <th
                  key={col.key}
                  className={`px-3 py-2.5 text-left text-sm font-semibold text-[rgb(var(--color-text))] ${sortable ? 'cursor-pointer select-none hover:text-[rgb(var(--color-accent))]' : ''} ${col.className ?? ''}`}
                  onClick={sortable ? () => handleSort(col) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {sortable && isActive && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`h-3.5 w-3.5 transition-transform ${sort?.direction === 'desc' ? 'rotate-180' : ''}`}>
                        <path fillRule="evenodd" d="M8 3.5a.75.75 0 01.75.75v5.94l2.22-2.22a.75.75 0 111.06 1.06l-3.5 3.5a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 111.06-1.06l2.22 2.22V4.25A.75.75 0 018 3.5z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                </th>
              );
            })}
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
                  className={`border-b border-[rgb(var(--color-border))] last:border-b-0 transition-colors ${
                    isSelected
                      ? 'bg-[rgb(var(--color-selected-muted))]'
                      : 'hover:bg-[rgb(var(--color-pill-bg))]/40'
                  }`}
                >
                  {selectable && (
                    <td className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(key)}
                        aria-label="Markera rad"
                        className="h-5 w-5 rounded-[var(--radius-sm)] border-[rgb(var(--color-border-strong))] accent-[rgb(var(--color-accent))]"
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
    </Card>
  );
}
