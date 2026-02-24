import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface SectionTitleProps {
  children: ReactNode;
  icon?: ReactNode;
  id?: string;
  className?: string;
  linkTo?: string;
  linkLabel?: string;
}

export function SectionTitle({
  children,
  icon,
  id,
  className = '',
  linkTo,
  linkLabel = 'Se alla',
}: SectionTitleProps) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <h2
        id={id}
        className="flex items-center gap-2 text-lg font-semibold text-[rgb(var(--color-text))]"
      >
        {icon}
        {children}
      </h2>
      {linkTo && (
        <Link
          to={linkTo}
          className="text-sm font-medium text-[rgb(var(--color-primary))] hover:underline"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
