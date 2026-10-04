import type { SelectHTMLAttributes } from 'react';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** A 44 px native select with the strong border and the blue focus ring. */
export function Select({ className = '', children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={`min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] disabled:opacity-50 ${className}`}
    >
      {children}
    </select>
  );
}
