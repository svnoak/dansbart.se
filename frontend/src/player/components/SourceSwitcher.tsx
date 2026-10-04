import { YouTubeIcon, SpotifyIcon } from '@/icons';
import type { PlaybackSource } from '@/player/embedUrl';

interface SourceSwitcherProps {
  hasYt: boolean;
  hasSpot: boolean;
  activeSource: PlaybackSource;
  onSourceChange: (source: PlaybackSource) => void;
  variant?: 'desktop' | 'mobile';
}

/**
 * A segmented control for the playback source. The active segment is ink;
 * source identity comes from the icon and the word, never from a brand colour.
 */
export function SourceSwitcher({
  hasYt,
  hasSpot,
  activeSource,
  onSourceChange,
}: SourceSwitcherProps) {
  if (!hasYt && !hasSpot) return null;

  const segment = (active: boolean) =>
    `inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-full)] px-3 text-[13px] font-semibold transition-colors ${
      active
        ? 'bg-[rgb(var(--color-accent))] text-[rgb(var(--color-accent-foreground))]'
        : 'text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))]'
    }`;

  return (
    <div
      role="group"
      aria-label="Källa"
      className="inline-flex rounded-[var(--radius-full)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] p-0.5"
    >
      {hasYt && (
        <button
          type="button"
          onClick={() => onSourceChange('youtube')}
          aria-pressed={activeSource === 'youtube'}
          className={segment(activeSource === 'youtube')}
        >
          <YouTubeIcon className="h-4 w-4" aria-hidden />
          YouTube
        </button>
      )}
      {hasSpot && (
        <button
          type="button"
          onClick={() => onSourceChange('spotify')}
          aria-pressed={activeSource === 'spotify'}
          className={segment(activeSource === 'spotify')}
        >
          <SpotifyIcon className="h-4 w-4" aria-hidden />
          Spotify
        </button>
      )}
    </div>
  );
}
