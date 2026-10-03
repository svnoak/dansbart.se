import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card } from './Card';
import { PlayCircleButton } from './PlayCircleButton';

interface ListRowProps {
  /** Where the row leads. The whole row is clickable; other controls in it stay clickable too. */
  to?: string;
  /** The row's name. Rendered as the link text when `to` is set. */
  title: ReactNode;
  /** A second line under the title. */
  subtitle?: ReactNode;
  /** An icon shown in a small paper tile before the title. */
  icon?: ReactNode;
  /** Replaces the icon tile with any leading element, for example an avatar. */
  leading?: ReactNode;
  /** Badges or notes under the title and subtitle. */
  children?: ReactNode;
  /** Text or controls at the right edge. */
  trailing?: ReactNode;
  /** A round play button at the left edge. */
  play?: {
    label: string;
    onPlay: () => void;
    playing?: boolean;
    disabled?: boolean;
  };
  className?: string;
}

/**
 * One entry in a list: a dance, a playlist, a group, an artist, an album.
 * Every list on the site uses this row so they read as one ledger.
 */
export function ListRow({ to, title, subtitle, icon, leading, children, trailing, play, className = '' }: ListRowProps) {
  const lead =
    leading ??
    (icon ? (
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[rgb(var(--color-pill-bg))] text-[rgb(var(--color-text-muted))]"
        aria-hidden
      >
        {icon}
      </span>
    ) : null);

  return (
    <Card
      className={`relative flex items-center gap-3 px-3 py-2.5 transition-colors ${
        to ? 'hover:border-[rgb(var(--color-border-strong))] hover:bg-[rgb(var(--color-pill-bg))]/40 focus-within:border-[rgb(var(--color-accent))]' : ''
      } ${className}`}
    >
      {play && (
        <PlayCircleButton
          aria-label={play.label}
          playing={play.playing}
          disabled={play.disabled}
          onClick={play.onPlay}
          className="relative z-10"
        />
      )}
      {lead}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[rgb(var(--color-text))]">
          {to ? (
            <Link
              to={to}
              className="after:absolute after:inset-0 after:rounded-[var(--radius-lg)] after:content-[''] focus:outline-none"
            >
              {title}
            </Link>
          ) : (
            title
          )}
        </p>
        {subtitle && <p className="truncate text-sm text-[rgb(var(--color-text-muted))]">{subtitle}</p>}
        {children && <div className="mt-1 flex flex-wrap items-center gap-1">{children}</div>}
      </div>
      {trailing && (
        <div className="relative z-10 flex shrink-0 items-center gap-3 text-sm text-[rgb(var(--color-text-muted))]">
          {trailing}
        </div>
      )}
    </Card>
  );
}
