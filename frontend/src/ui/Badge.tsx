import type { CSSProperties, ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'muted';
  size?: 'sm' | 'md';
  className?: string;
  style?: CSSProperties;
}

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
  style,
}: BadgeProps) {
  const base = 'inline-flex items-center rounded-[var(--radius)] px-2 py-0.5 font-medium';
  const sizes = {
    sm: 'text-xs',
    md: 'text-base',
  };
  const variants = {
    default: 'bg-[rgb(var(--color-pill-bg))] text-[rgb(var(--color-text))]',
    muted: 'bg-[rgb(var(--color-border))]/50 text-[rgb(var(--color-text-muted))]',
  };
  return <span className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} style={style}>{children}</span>;
}
