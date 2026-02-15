import type { SelectHTMLAttributes } from 'react';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className = '', children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={`w-full rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-3 py-2 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:border-[rgb(var(--color-accent))] focus-visible:ring-1 focus-visible:ring-[rgb(var(--color-accent))] ${className}`}
    >
      {children}
    </select>
  );
}
