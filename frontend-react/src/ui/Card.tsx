import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] bg-[rgb(var(--color-bg-elevated))] shadow-[var(--color-card-shadow)] border border-[rgb(var(--color-border))]/50 ${className}`}
    >
      {children}
    </div>
  );
}
