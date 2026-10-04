import type { ReactNode } from 'react';
import { EmptyState, RowSkeleton } from '@/ui';

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

const CHECKBOX_CLASS =
  'h-5 w-5 shrink-0 cursor-pointer accent-[rgb(var(--color-accent))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]';

function SortArrow({ direction }: { direction: SortDirection }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={`h-3.5 w-3.5 transition-transform ${direction === 'desc' ? 'rotate-180' : ''}`}
      aria-hidden
    >
      <path fillRule="evenodd" d="M8 3.5a.75.75 0 01.75.75v5.94l2.22-2.22a.75.75 0 111.06 1.06l-3.5 3.5a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 111.06-1.06l2.22 2.22V4.25A.75.75 0 018 3.5z" clipRule="evenodd" />
    </svg>
  );
}

/**
 * The one bulk table for the backstage pages: a hairline card, a muted header
 * row with sort buttons, 44 px body rows and optional row selection.
 */
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

  if (loading) {
    return <RowSkeleton rows={8} label="Laddar tabellen" />;
  }

  if (data.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]">
      <table className="w-full text-[15px] text-[rgb(var(--color-text))]">
        <thead>
          <tr className="border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))]">
            {selectable && (
              <th scope="col" className="w-12 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label={allSelected ? 'Avmarkera alla rader' : 'Markera alla rader'}
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={toggleAll}
                  className={`${CHECKBOX_CLASS} block`}
                />
              </th>
            )}
            {columns.map((col) => {
              const sortable = !!col.sortKey && !!onSortChange;
              const isActive = sortable && sort?.key === col.sortKey;
              const ariaSort = sortable
                ? isActive
                  ? sort?.direction === 'desc'
                    ? 'descending'
                    : 'ascending'
                  : 'none'
                : undefined;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={`px-3 py-2 text-left text-[13px] font-semibold text-[rgb(var(--color-text-muted))] ${col.className ?? ''}`}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col)}
                      className={`-mx-2 inline-flex min-h-8 items-center gap-1 rounded-[var(--radius)] px-2 transition-colors hover:bg-[rgb(var(--color-accent-muted))] hover:text-[rgb(var(--color-text))] ${
                        isActive ? 'text-[rgb(var(--color-text))]' : ''
                      }`}
                    >
                      {col.header}
                      {isActive && sort && <SortArrow direction={sort.direction} />}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const key = keyFn(row);
            const isSelected = selected.has(key);
            return (
              <tr
                key={key}
                className={`border-b border-[rgb(var(--color-border))] last:border-b-0 transition-colors ${
                  isSelected
                    ? 'bg-[rgb(var(--color-selected))]/10'
                    : 'hover:bg-[rgb(var(--color-accent-muted))]'
                }`}
              >
                {selectable && (
                  <td className="w-12 px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={isSelected ? 'Avmarkera raden' : 'Markera raden'}
                      checked={isSelected}
                      onChange={() => toggleRow(key)}
                      className={`${CHECKBOX_CLASS} block`}
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.key} className={`h-11 px-3 py-2 align-middle ${col.className ?? ''}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
