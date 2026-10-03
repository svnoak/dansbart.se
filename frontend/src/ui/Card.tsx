import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

/** A sheet of paper on the linen ground: solid warm edge, a whisper of lift. */
export function Card({ children, className = '', ...rest }: CardProps) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] bg-[rgb(var(--color-bg-elevated))] shadow-[var(--color-card-shadow)] border border-[rgb(var(--color-border))] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
