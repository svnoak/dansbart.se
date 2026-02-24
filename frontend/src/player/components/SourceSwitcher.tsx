import { YouTubeIcon, SpotifyIcon } from '@/icons';
import type { PlaybackSource } from '@/player/embedUrl';

interface SourceSwitcherProps {
  hasYt: boolean;
  hasSpot: boolean;
  activeSource: PlaybackSource;
  onSourceChange: (source: PlaybackSource) => void;
  variant?: 'desktop' | 'mobile';
}

export function SourceSwitcher({
  hasYt,
  hasSpot,
  activeSource,
  onSourceChange,
  variant = 'desktop',
}: SourceSwitcherProps) {
  if (!hasYt && !hasSpot) return null;

  if (variant === 'mobile') {
    return (
      <div className="flex gap-2 bg-[rgb(var(--color-border))]/30 rounded-lg p-1">
        {hasYt && (
          <button
            type="button"
            onClick={() => onSourceChange('youtube')}
            className={`p-2 rounded transition-all ${
              activeSource === 'youtube'
                ? 'bg-red-50 text-red-600'
                : 'bg-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]'
            }`}
            aria-label="YouTube som källa"
          >
            <YouTubeIcon className="w-5 h-5" />
          </button>
        )}
        {hasSpot && (
          <button
            type="button"
            onClick={() => onSourceChange('spotify')}
            className={`p-2 rounded transition-all ${
              activeSource === 'spotify'
                ? 'bg-green-50 text-green-600'
                : 'bg-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]'
            }`}
            aria-label="Spotify som källa"
          >
            <SpotifyIcon className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <span className="text-[10px] text-[rgb(var(--color-text-muted))] font-bold uppercase mr-2">Källa</span>
      {hasYt && (
        <button
          type="button"
          onClick={() => onSourceChange('youtube')}
          className={`p-1.5 rounded border transition-all ${
            activeSource === 'youtube'
              ? 'bg-red-50 border-red-200 text-red-600'
              : 'bg-transparent border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]'
          }`}
          aria-label="YouTube som källa"
        >
          <YouTubeIcon className="w-4 h-4" />
        </button>
      )}
      {hasSpot && (
        <button
          type="button"
          onClick={() => onSourceChange('spotify')}
          className={`p-1.5 rounded border transition-all ${
            activeSource === 'spotify'
              ? 'bg-green-50 border-green-200 text-green-600'
              : 'bg-transparent border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]'
          }`}
          aria-label="Spotify som källa"
        >
          <SpotifyIcon className="w-4 h-4" />
        </button>
      )}
    </>
  );
}
