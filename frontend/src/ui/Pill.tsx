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
      ? 'bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-200'
      : variant === 'red' && active
        ? 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-200'
        : active
          ? 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-accent))] dark:bg-[rgb(var(--color-accent-muted))]/60'
          : 'bg-[rgb(var(--color-border))]/50 text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]';
  return (
    <button
      type="button"
      className={`rounded-[var(--radius-full)] px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-accent))] ${activeClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
