import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  /** A small icon before the title, for example the heart on Favoriter. */
  icon?: ReactNode;
  /** A short count or note after the title, for example "8 danser". */
  meta?: ReactNode;
  /** One or two sentences under the title. */
  description?: ReactNode;
  /** A control on the right, for example "Ny spellista". */
  action?: ReactNode;
  className?: string;
}

/** The top of every page: the title in the display face, with room for a count, a line of text and one action. */
export function PageHeader({ title, icon, meta, description, action, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${className}`}>
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-3xl font-semibold text-[rgb(var(--color-text))] sm:text-4xl">
          {icon && <span className="self-center text-[rgb(var(--color-accent))]">{icon}</span>}
          <span>{title}</span>
          {meta && (
            <span className="font-sans text-base font-normal text-[rgb(var(--color-text-muted))]">{meta}</span>
          )}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-lg text-[rgb(var(--color-text-muted))]">{description}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2 sm:pt-1">{action}</div>}
    </div>
  );
}
