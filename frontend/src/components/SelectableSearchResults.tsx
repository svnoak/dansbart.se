import type { ReactNode } from 'react';
import { Button } from '@/ui';
import { CheckIcon, PlusIcon } from '@/icons';

interface SelectableSearchResultsProps<T> {
  results: T[];
  getId: (result: T) => string | undefined;
  renderResult: (result: T) => ReactNode;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onConfirm: (result: T) => void;
  confirming: boolean;
  disabledIds?: Set<string>;
  disabledLabel?: string;
  /** The word on the confirm button. */
  confirmLabel?: string;
}

/**
 * Search results in the bordered list container. A row is a button that
 * selects the result; the selected row shows its confirm button inline.
 */
export function SelectableSearchResults<T>({
  results,
  getId,
  renderResult,
  selectedId,
  onSelect,
  onConfirm,
  confirming,
  disabledIds,
  disabledLabel,
  confirmLabel = 'Lägg till',
}: SelectableSearchResultsProps<T>) {
  if (results.length === 0) return null;

  return (
    <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]">
      {results.map((result) => {
        const resultId = getId(result);
        const isDisabled = resultId ? (disabledIds?.has(resultId) ?? false) : false;
        const isSelected = !!resultId && selectedId === resultId && !isDisabled;
        return (
          <li
            key={resultId}
            className={`flex flex-wrap items-center gap-2 border-b border-[rgb(var(--color-border))] px-2 py-1.5 last:border-b-0 ${
              isSelected ? 'bg-[rgb(var(--color-selected))]/10' : ''
            }`}
          >
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={() => {
                if (isDisabled) return;
                onSelect(selectedId === resultId ? null : (resultId ?? null));
              }}
              disabled={isDisabled}
              className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-[var(--radius)] px-2 text-left text-[15px] text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] disabled:opacity-60 disabled:hover:bg-transparent"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  isSelected
                    ? 'border-[rgb(var(--color-selected))] bg-[rgb(var(--color-selected))] text-white'
                    : 'border-[rgb(var(--color-border-strong))] text-transparent'
                }`}
                aria-hidden
              >
                <CheckIcon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate">{renderResult(result)}</span>
              {isDisabled && disabledLabel && (
                <span className="shrink-0 text-[13px] text-[rgb(var(--color-text-muted))]">{disabledLabel}</span>
              )}
            </button>
            {isSelected && (
              <Button
                variant="secondary"
                className="shrink-0"
                onClick={() => onConfirm(result)}
                disabled={confirming}
              >
                <PlusIcon className="h-4 w-4" aria-hidden />
                {confirmLabel}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
