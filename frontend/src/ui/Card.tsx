import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '', ...rest }: CardProps) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] bg-[rgb(var(--color-bg-elevated))] border border-[rgb(var(--color-border))] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
