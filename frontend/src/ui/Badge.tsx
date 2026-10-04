import type { CSSProperties, ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  /** default: soft fill with ink text. muted: hairline outline with muted text. */
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
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 font-medium leading-5';
  const sizes = {
    sm: 'text-[13px]',
    md: 'text-sm',
  };
  const variants = {
    default: 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text))]',
    muted: 'border border-[rgb(var(--color-border))] bg-transparent text-[rgb(var(--color-text-muted))]',
  };
  return <span className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} style={style}>{children}</span>;
}
