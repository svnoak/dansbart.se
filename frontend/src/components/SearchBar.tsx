import type { FormEvent, KeyboardEvent } from 'react';
import { Button } from '@/ui';
import { CloseIcon } from '@/icons';
import type { SearchType } from '@/hooks/useSearchParamsState';
import { SegmentedControl, type SegmentOption } from '@/components/FilterBar';

interface SearchBarProps {
  query: string;
  searchType: SearchType;
  onQueryChange: (q: string) => void;
  onSearchTypeChange: (t: SearchType) => void;
  onSearch: () => void;
}

const SEARCH_TYPES: SegmentOption<SearchType>[] = [
  { value: 'tracks', label: 'Låtar', ariaLabel: 'Sök bland låtar' },
  { value: 'artists', label: 'Artister', ariaLabel: 'Sök bland artister' },
  { value: 'albums', label: 'Album', ariaLabel: 'Sök bland album' },
];

const SEARCH_LABEL = 'Sök låt, artist eller album';

/**
 * The search row: a fully rounded field, a segmented control for what is
 * searched, and the one primary button. The query is a draft until the person
 * presses Sök or Enter.
 */
export function SearchBar({
  query,
  searchType,
  onQueryChange,
  onSearchTypeChange,
  onSearch,
}: SearchBarProps) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSearch();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearch();
    }
  };

  return (
    <form
      role="search"
      onSubmit={submit}
      className="flex flex-col gap-3 md:flex-row md:items-center"
    >
      <div className="relative flex-1">
        <span
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]"
          aria-hidden
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={SEARCH_LABEL}
          aria-label={SEARCH_LABEL}
          enterKeyHint="search"
          className="h-12 w-full rounded-full border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] pl-11 pr-12 text-base text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))] [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-accent-muted))] hover:text-[rgb(var(--color-text))]"
            aria-label="Rensa sökfältet"
          >
            <CloseIcon className="h-5 w-5" aria-hidden />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Vad som söks"
          value={searchType}
          options={SEARCH_TYPES}
          onChange={onSearchTypeChange}
          size="md"
        />
        <Button type="submit" variant="primary" className="h-12 rounded-full px-6 text-base">
          Sök
        </Button>
      </div>
    </form>
  );
}
