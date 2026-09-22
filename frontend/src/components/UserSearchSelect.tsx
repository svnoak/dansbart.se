import { useEffect, useId, useRef, useState } from 'react';
import { searchUsers } from '@/api/generated/users/users';
import { useOutsideClick } from '@/hooks/useOutsideClick';
import type { UserSummaryDto } from '@/api/models/userSummaryDto';

interface UserSearchSelectProps {
  selected: UserSummaryDto | null;
  onSelect: (user: UserSummaryDto | null) => void;
  label: string;
}

export function UserSearchSelect({ selected, onSelect, label }: UserSearchSelectProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummaryDto[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  useOutsideClick(containerRef, () => setResults([]));

  useEffect(() => {
    if (selected || query.trim().length < 2) return;
    const timer = setTimeout(() => {
      searchUsers({ q: query.trim(), limit: 8 })
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, selected]);

  const displayValue = selected ? (selected.displayName ?? selected.username ?? '') : query;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    if (selected) onSelect(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') setResults([]);
  }

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-[rgb(var(--color-text))]">
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Sök efter användare"
        autoComplete="off"
        className="min-h-[44px] w-full rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus-visible:border-[rgb(var(--color-accent))] focus-visible:ring-1 focus-visible:ring-[rgb(var(--color-accent))]"
      />
      {!selected && query.trim().length >= 2 && results.length > 0 && (
        <ul className="absolute left-0 top-full z-20 mt-1 w-full rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] py-1 shadow-lg">
          {results.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(u);
                  setResults([]);
                }}
                className="flex min-h-[44px] w-full flex-col justify-center px-3 py-2 text-left text-sm hover:bg-[rgb(var(--color-border))]/40"
              >
                <span className="font-medium text-[rgb(var(--color-text))]">
                  {u.displayName ?? u.username}
                </span>
                {u.username && u.displayName && (
                  <span className="text-sm text-[rgb(var(--color-text-muted))]">@{u.username}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
