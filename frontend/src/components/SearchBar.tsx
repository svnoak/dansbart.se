import type { SearchType } from '@/hooks/useSearchParamsState';
import { SearchField, fieldClassName } from '@/ui';

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
      <SearchField
        label="Sökfält"
        value={query}
        onChange={onQueryChange}
        onSubmit={onSearch}
        placeholder="Sök låtnamn, artist…"
        className="flex-1"
      />
      <select
        value={searchType}
        onChange={(e) => onSearchTypeChange(e.target.value as SearchType)}
        className={`${fieldClassName} sm:w-auto`}
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
