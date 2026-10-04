import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  /** Kept for callers; every active pill is ink. Source identity comes from the icon and the word. */
  variant?: 'default' | 'green' | 'red';
  children: ReactNode;
}

export function Pill({
  active = false,
  className = '',
  children,
  ...props
}: PillProps) {
  const activeClass = active
    ? 'bg-[rgb(var(--color-accent))] text-[rgb(var(--color-accent-foreground))]'
    : 'border border-[rgb(var(--color-border))] bg-transparent text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))]';
  return (
    <button
      type="button"
      className={`rounded-[var(--radius-full)] px-3.5 py-1.5 min-h-9 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))] ${activeClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
