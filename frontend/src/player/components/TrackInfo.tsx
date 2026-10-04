import { formatDurationMs } from '@/utils/formatDuration';
import { tempoCategoryLabel } from '@/utils/tempoLabel';
import { getStyleColor } from '@/styles/danceStyleColors';
import { useTheme } from '@/theme/useTheme';
import { StarMarkIcon } from '@/icons';
import { StylePill } from '@/components/TrackRow/StylePill';
import { stylePillState } from '@/components/TrackRow/stylePillState';
import { SheetMusicLink } from '@/components/TrackRow/SheetMusicLink';
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

/**
 * Left third of the player bar: the eight-point star in the track's style
 * colour (there is no artwork), title and artist, then the style pill and
 * tempo. On a phone the time sits under the title.
 */
export function TrackInfo({
  currentTrack,
  playbackPositionMs,
  durationMs,
  activeSource,
  bars,
  structureMode,
  onToggleStructureMode,
}: TrackInfoProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const color = getStyleColor(currentTrack?.danceStyle);
  const tile = {
    backgroundColor: isDark ? color.bgDark : color.bg,
    color: isDark ? color.textDark : color.text,
  };
  const state = stylePillState(currentTrack?.danceStyle, currentTrack?.confidence);
  const tempo = tempoCategoryLabel(currentTrack?.tempoCategory);
  const time = `${formatDurationMs(Math.round(playbackPositionMs))} / ${durationMs > 0 ? formatDurationMs(durationMs) : '0:00'}`;
  const barsOn = structureMode === 'bars';

  return (
    <div className="flex min-w-0 w-1/2 md:w-1/3 items-center gap-3">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius)]"
        style={tile}
        aria-hidden
      >
        <StarMarkIcon className="h-6 w-6" aria-hidden />
      </div>
      <div className="min-w-0 flex flex-col gap-1">
        <div className="truncate text-[15px] font-bold text-[rgb(var(--color-text))]">
          {currentTrack?.title ?? 'Välj en låt att spela'}
          {currentTrack?.artistName && (
            <span className="font-normal text-[rgb(var(--color-text-muted))]"> · {currentTrack.artistName}</span>
          )}
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <span className="text-[13px] tabular-nums text-[rgb(var(--color-text-muted))]">{time}</span>
        </div>
        {currentTrack && (
          <div className="hidden md:flex items-center gap-2 min-w-0">
            <StylePill style={currentTrack.danceStyle} state={state} />
            {tempo && <span className="text-[13px] text-[rgb(var(--color-text-muted))]">{tempo}</span>}
            <SheetMusicLink track={currentTrack} variant="chip" />
            {activeSource === 'youtube' && (
              <span className="text-[13px] tabular-nums text-[rgb(var(--color-text-muted))]">{time}</span>
            )}
            {bars.length > 0 && (
              <label
                className="ml-1 inline-flex min-h-7 cursor-pointer items-center gap-2 text-[13px] font-semibold text-[rgb(var(--color-text))]"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={barsOn}
                  onChange={onToggleStructureMode}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={`relative inline-block h-5 w-9 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[rgb(var(--color-focus))] ${
                    barsOn ? 'bg-[rgb(var(--color-selected))]' : 'bg-[rgb(var(--color-border-strong))]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${barsOn ? 'translate-x-4' : 'translate-x-0.5'}`}
                  />
                </span>
                Takter
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
