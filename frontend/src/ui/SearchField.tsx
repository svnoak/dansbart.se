import type { InputHTMLAttributes, KeyboardEvent } from 'react';
import { fieldClassName } from './fieldStyles';

interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size' | 'className' | 'type'> {
  /** The accessible name of the field, for example "Sök danser". */
  label: string;
  onChange: (value: string) => void;
  /** Called on Enter. */
  onSubmit?: () => void;
  /** `lg` is the 48px field on the home page. */
  size?: 'md' | 'lg';
  className?: string;
}

/** The one search box: magnifier on the left, a clear button when there is text. */
export function SearchField({
  label,
  onChange,
  onSubmit,
  size = 'md',
  className = '',
  value,
  ...props
}: SearchFieldProps) {
  const hasValue = typeof value === 'string' && value.length > 0;
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && onSubmit) onSubmit();
  }
  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
        </svg>
      </span>
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onSubmit ? handleKeyDown : undefined}
        className={`${fieldClassName} pl-11 ${hasValue ? 'pr-11' : 'pr-4'} ${size === 'lg' ? 'min-h-12 shadow-[var(--color-card-shadow)]' : ''}`}
        {...props}
      />
      {hasValue && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
          aria-label="Rensa sökning"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      )}
    </div>
  );
}
