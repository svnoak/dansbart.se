import type { ReactNode } from 'react';
import { Button } from '@/ui';

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
}

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
}: SelectableSearchResultsProps<T>) {
  if (results.length === 0) return null;

  return (
    <div className="space-y-2">
      {results.map((result) => {
        const resultId = getId(result);
        const isDisabled = resultId ? (disabledIds?.has(resultId) ?? false) : false;
        return (
          <div key={resultId} className="space-y-2">
            <Button
              variant="ghost"
              onClick={() => {
                if (isDisabled) return;
                onSelect(selectedId === resultId ? null : (resultId ?? null));
              }}
              disabled={isDisabled}
              className="w-full text-left"
            >
              {renderResult(result)}
              {isDisabled && disabledLabel && (
                <span className="ml-2 text-sm text-[rgb(var(--color-text-muted))]">{disabledLabel}</span>
              )}
            </Button>
            {selectedId === resultId && resultId && !isDisabled && (
              <Button size="sm" onClick={() => onConfirm(result)} disabled={confirming}>
                Lägg till
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
