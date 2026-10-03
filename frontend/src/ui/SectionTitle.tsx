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

/** A section heading in the display face, trailed by a ledger rule, with an optional "Se alla" link. */
export function SectionTitle({
  children,
  icon,
  id,
  className = '',
  linkTo,
  linkLabel = 'Se alla',
}: SectionTitleProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <h2
        id={id}
        className="flex shrink-0 items-center gap-2 text-xl font-semibold text-[rgb(var(--color-text))]"
      >
        {icon}
        {children}
      </h2>
      <span className="ledger-rule" aria-hidden />
      {linkTo && (
        <Link
          to={linkTo}
          className="shrink-0 text-sm font-semibold text-[rgb(var(--color-accent))] underline decoration-[rgb(var(--color-accent))]/40 underline-offset-4 hover:decoration-[rgb(var(--color-accent))]"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
