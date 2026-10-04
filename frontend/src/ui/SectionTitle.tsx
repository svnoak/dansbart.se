import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface SectionTitleProps {
  children: ReactNode;
  icon?: ReactNode;
  id?: string;
  className?: string;
  linkTo?: string;
  linkLabel?: string;
  /** A short muted note that sits to the right of the heading, for example a count or a hint. */
  aside?: ReactNode;
}

export function SectionTitle({
  children,
  icon,
  id,
  className = '',
  linkTo,
  linkLabel = 'Se alla',
  aside,
}: SectionTitleProps) {
  return (
    <div className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 ${className}`}>
      <h2
        id={id}
        className="flex items-center gap-2 text-xl font-bold leading-tight text-[rgb(var(--color-text))]"
      >
        {icon}
        {children}
      </h2>
      {linkTo ? (
        <Link
          to={linkTo}
          className="text-sm font-semibold text-[rgb(var(--color-link))] hover:underline"
        >
          {linkLabel}
        </Link>
      ) : aside ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))]">{aside}</p>
      ) : null}
    </div>
  );
}
