import { formatDurationMs } from '@/utils/formatDuration';
import type { TrackListDto } from '@/api/models/trackListDto';
import type { PlaybackSource } from '@/player/embedUrl';

interface TrackInfoProps {
  currentTrack: TrackListDto | null;
  playbackPositionMs: number;
  durationMs: number;
  activeSource: PlaybackSource;
  bars: number[];
  structureMode: 'none' | 'bars';
  onToggleStructureMode: () => void;
  structureButtonLabel: string;
}

export function TrackInfo({
  currentTrack,
  playbackPositionMs,
  durationMs,
  activeSource,
  bars,
  structureMode,
  onToggleStructureMode,
  structureButtonLabel,
}: TrackInfoProps) {
  return (
    <div className="flex min-w-0 w-2/3 md:w-1/3 items-center gap-3">
      <div className="w-12 h-12 shrink-0 rounded bg-[rgb(var(--color-border))]/50 flex items-center justify-center text-xl">
        🎵
      </div>
      <div className="min-w-0">
        <div className="font-bold truncate text-sm md:text-base text-[rgb(var(--color-text))]">
          {currentTrack?.title ?? 'Välj en låt att spela'}
        </div>
        <div className="text-[10px] text-[rgb(var(--color-text-muted))] font-mono md:hidden">
          {formatDurationMs(Math.round(playbackPositionMs))} / {durationMs > 0 ? formatDurationMs(durationMs) : '0:00'}
        </div>
        {activeSource === 'youtube' && (
          <div className="hidden md:block text-[10px] text-[rgb(var(--color-text-muted))] font-mono">
            {formatDurationMs(Math.round(playbackPositionMs))} / {durationMs > 0 ? formatDurationMs(durationMs) : '0:00'}
          </div>
        )}
        {bars.length > 0 && (
          <div className="hidden md:flex items-center gap-2 mt-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStructureMode();
              }}
              className={`text-[9px] font-bold uppercase border px-1.5 rounded transition-colors ${
                structureMode !== 'none'
                  ? 'bg-[rgb(var(--color-accent))]/10 text-[rgb(var(--color-accent))] border-[rgb(var(--color-accent))]/30'
                  : 'bg-transparent text-[rgb(var(--color-text-muted))] border-[rgb(var(--color-border))]'
              }`}
            >
              {structureButtonLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
