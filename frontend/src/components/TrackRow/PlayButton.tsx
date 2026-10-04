import type { CSSProperties } from 'react';
import { PlayIcon, PauseIcon } from '@/icons';
import { useTheme } from '@/theme/useTheme';
import type { DanceStyleColor } from '@/styles/danceStyleColors';
import type { TrackListDto } from '@/api/models/trackListDto';

interface PlayButtonProps {
  track: TrackListDto;
  isCurrent: boolean;
  isPlaying: boolean;
  styleColor: DanceStyleColor;
  onPlay: () => void;
}

/**
 * The row's leading control. It carries the style colour so a list scans by
 * colour, a dashed outline when the style is only a guess, and an amber ring
 * when this is the track that is playing.
 */
export function PlayButton({
  track,
  isCurrent,
  isPlaying,
  styleColor,
  onPlay,
}: PlayButtonProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const playing = isCurrent && isPlaying;
  const hasStyle = typeof track.danceStyle === 'string' && track.danceStyle.length > 0;
  const isGuess = hasStyle && (track.confidence ?? 0) < 1;

  const fg = isDark ? styleColor.textDark : styleColor.text;
  const bg = isDark ? styleColor.bgDark : styleColor.bg;

  const style: CSSProperties = isGuess || !hasStyle
    ? { color: hasStyle ? fg : 'rgb(var(--color-text-muted))', border: `1.5px dashed ${hasStyle ? fg : 'rgb(var(--color-border-strong))'}`, backgroundColor: 'transparent' }
    : { backgroundColor: bg, color: fg };

  return (
    <button
      type="button"
      onClick={onPlay}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))] ${
        isCurrent ? 'ring-[3px] ring-[rgb(var(--color-now-playing))]' : ''
      }`}
      style={style}
      aria-label={playing ? 'Pausa' : 'Spela'}
    >
      {playing ? (
        <PauseIcon className="h-5 w-5" aria-hidden />
      ) : (
        <PlayIcon className="h-5 w-5 ml-0.5" aria-hidden />
      )}
    </button>
  );
}
