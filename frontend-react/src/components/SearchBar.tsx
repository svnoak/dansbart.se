import type { SearchType } from '@/hooks/useSearchParamsState';

interface SearchBarProps {
  query: string;
  searchType: SearchType;
  onQueryChange: (q: string) => void;
  onSearchTypeChange: (t: SearchType) => void;
  onSearch: () => void;
}

const SEARCH_TYPES: { value: SearchType; label: string }[] = [
  { value: 'tracks', label: 'Låtar' },
  { value: 'artists', label: 'Artister' },
  { value: 'albums', label: 'Album' },
];

export function SearchBar({
  query,
  searchType,
  onQueryChange,
  onSearchTypeChange,
  onSearch,
}: SearchBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          placeholder="Sök låtnamn, artist…"
          className="w-full rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] py-2.5 pl-10 pr-4 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus-visible:border-[rgb(var(--color-accent))] focus-visible:ring-1 focus-visible:ring-[rgb(var(--color-accent))]"
          aria-label="Sökfält"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
            aria-label="Rensa sökning"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        )}
      </div>
      <select
        value={searchType}
        onChange={(e) => onSearchTypeChange(e.target.value as SearchType)}
        className="rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2.5 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:border-[rgb(var(--color-accent))] focus-visible:ring-1 focus-visible:ring-[rgb(var(--color-accent))]"
        aria-label="Söktyp"
      >
        {SEARCH_TYPES.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
