import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  /** When active, use green (Spotify) or red (YouTube) instead of accent */
  variant?: 'default' | 'green' | 'red';
  children: ReactNode;
}

export function Pill({
  active = false,
  variant = 'default',
  className = '',
  children,
  ...props
}: PillProps) {
  const activeClass =
    variant === 'green' && active
      ? 'border-green-700/40 bg-green-200 text-green-900 dark:border-green-400/40 dark:bg-green-900/50 dark:text-green-200'
      : variant === 'red' && active
        ? 'border-red-700/40 bg-red-200 text-red-900 dark:border-red-400/40 dark:bg-red-900/50 dark:text-red-200'
        : active
          ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-accent))]'
          : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] text-[rgb(var(--color-text))] hover:border-[rgb(var(--color-border-strong))] hover:bg-[rgb(var(--color-pill-bg))]';
  return (
    <button
      type="button"
      className={`rounded-[var(--radius-full)] border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--color-bg))] focus-visible:ring-[rgb(var(--color-accent))] ${activeClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
