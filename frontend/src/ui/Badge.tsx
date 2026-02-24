import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'muted';
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  className = '',
}: BadgeProps) {
  const base = 'inline-flex items-center rounded-[var(--radius)] px-2 py-0.5 text-xs font-medium';
  const variants = {
    default: 'bg-[rgb(var(--color-pill-bg))] text-[rgb(var(--color-text))]',
    muted: 'bg-[rgb(var(--color-border))]/50 text-[rgb(var(--color-text-muted))]',
  };
  return <span className={`${base} ${variants[variant]} ${className}`}>{children}</span>;
}
