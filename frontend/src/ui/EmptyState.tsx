import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * The one empty state for every list: an icon in a muted circle, one sentence
 * that says what belongs here, and at most one action.
 */
export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-6 py-8 text-center ${className}`}
    >
      {icon && (
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text))]"
          aria-hidden
        >
          {icon}
        </span>
      )}
      <p className="text-base font-bold text-[rgb(var(--color-text))]">{title}</p>
      {description && (
        <p className="max-w-xs text-sm leading-relaxed text-[rgb(var(--color-text-muted))]">{description}</p>
      )}
      {action}
    </div>
  );
}
