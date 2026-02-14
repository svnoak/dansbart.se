import type { ReactNode } from 'react';

interface SectionTitleProps {
  children: ReactNode;
  icon?: ReactNode;
  id?: string;
  className?: string;
}

export function SectionTitle({ children, icon, id, className = '' }: SectionTitleProps) {
  return (
    <h2
      id={id}
      className={`flex items-center gap-2 text-lg font-semibold text-[rgb(var(--color-text))] ${className}`}
    >
      {icon}
      {children}
    </h2>
  );
}
