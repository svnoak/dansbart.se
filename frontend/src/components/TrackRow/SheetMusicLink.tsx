import type { TrackListDto } from '@/api/models/trackListDto';

interface SheetMusicLinkProps {
  track: Pick<TrackListDto, 'sheetMusicUrl'>;
  /** 'inline' sits on the artist line of a row; 'chip' is the outlined chip in the player. */
  variant?: 'inline' | 'chip';
  className?: string;
}

const SHEET_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0" aria-hidden>
    <path d="M3 6h18M3 10h18M3 14h18M3 18h18" />
    <circle cx="15" cy="15" r="2.2" fill="currentColor" />
    <path d="M17.2 15V6" />
  </svg>
);

const EXTERNAL_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5 shrink-0" aria-hidden>
    <path d="M14 4h6v6" />
    <path d="M20 4l-9 9" />
    <path d="M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5" />
  </svg>
);

/**
 * "Noter" link to the sheet music on folkwiki.se. Renders nothing when the
 * track has no confirmed match, so rows without notes look exactly as before.
 */
export function SheetMusicLink({ track, variant = 'inline', className = '' }: SheetMusicLinkProps) {
  if (!track.sheetMusicUrl) return null;
  const base =
    variant === 'chip'
      ? 'inline-flex h-7 items-center gap-1.5 rounded-full border border-[rgb(var(--color-border))] px-2.5 text-[13px] font-semibold'
      : 'inline-flex items-center gap-1 text-[13px] font-semibold';
  return (
    <a
      href={track.sheetMusicUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Noter på Folkwiki, öppnas i ny flik"
      onClick={(e) => e.stopPropagation()}
      className={`${base} text-[rgb(var(--color-link))] hover:underline ${className}`}
    >
      {SHEET_ICON}
      Noter
      {EXTERNAL_ICON}
    </a>
  );
}
