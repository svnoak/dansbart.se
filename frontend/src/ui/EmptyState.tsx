import type { ReactNode } from 'react';
import { Card } from './Card';

interface EmptyStateProps {
  icon?: ReactNode;
  /** One or two sentences that say what is missing and what a person can do. */
  children: ReactNode;
  /** A button or link under the text. */
  action?: ReactNode;
  className?: string;
}

/** A paper card for a list with nothing in it, or a page that needs a login first. */
export function EmptyState({ icon, children, action, className = '' }: EmptyStateProps) {
  return (
    <Card className={`flex flex-col items-center gap-3 p-8 text-center ${className}`}>
      {icon && (
        <span className="text-[rgb(var(--color-text-muted))]" aria-hidden>
          {icon}
        </span>
      )}
      <p className="max-w-sm text-base text-[rgb(var(--color-text-muted))]">{children}</p>
      {action && <div className="mt-1">{action}</div>}
    </Card>
  );
}
