import { IconButton } from '@/ui';
import {
  PlayIcon,
  PauseIcon,
  ShuffleIcon,
  ShuffleOffIcon,
  RepeatIcon,
  StopAfterIcon,
  SkipPreviousIcon,
  SkipNextIcon,
  JumpBackIcon,
  JumpForwardIcon,
  QueueListIcon,
} from '@/icons';

interface PlayerControlsProps {
  isShuffled: boolean;
  onToggleShuffle: () => void;
  repeatMode: 'none' | 'one' | 'all' | 'stop';
  onCycleRepeat: () => void;
  isPlaying: boolean;
  onTogglePlayPause: () => void;
  controlsDisabled: boolean;
  onPrev: () => void;
  onNext: () => void;
  onJumpBack: () => void;
  onJumpForward: () => void;
  jumpAmount: number;
  jumpLabel: string;
  hasQueue: boolean;
  isQueueOpen: boolean;
  onShowQueue: () => void;
  /** 'bar' = desktop bottom bar; 'overlay' = mobile full-screen overlay */
  variant?: 'bar' | 'overlay';
  /** For variant='bar': show shuffle/jump/repeat/queue buttons and enlarge play button */
  fullMode?: boolean;
}

export function PlayerControls({
  isShuffled,
  onToggleShuffle,
  repeatMode,
  onCycleRepeat,
  isPlaying,
  onTogglePlayPause,
  controlsDisabled,
  onPrev,
  onNext,
  onJumpBack,
  onJumpForward,
  jumpAmount,
  jumpLabel,
  hasQueue,
  isQueueOpen,
  onShowQueue,
  variant = 'bar',
  fullMode = false,
}: PlayerControlsProps) {
  const isOverlay = variant === 'overlay';

  if (isOverlay) {
    return (
      <div className="flex justify-center items-center gap-8 mb-8">
        <IconButton
          aria-label={isShuffled ? 'Shuffle påslaget' : 'Shuffle avslaget'}
          aria-pressed={isShuffled}
          onClick={() => onToggleShuffle()}
          className={`w-10 h-10 flex items-center justify-center transition-colors ${
            isShuffled
              ? 'text-[rgb(var(--color-accent))]'
              : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]'
          }`}
        >
          {isShuffled ? (
            <ShuffleIcon className="w-6 h-6" />
          ) : (
            <ShuffleOffIcon className="w-6 h-6" />
          )}
        </IconButton>

        <button
          type="button"
          onClick={onPrev}
          disabled={controlsDisabled}
          aria-label="Föregående spår"
          className={`transition-colors ${
            controlsDisabled
              ? 'text-[rgb(var(--color-border))] cursor-not-allowed'
              : 'text-[rgb(var(--color-text))] hover:text-[rgb(var(--color-accent))]'
          }`}
        >
          <SkipPreviousIcon className="w-8 h-8" />
        </button>

        <button
          type="button"
          onClick={onTogglePlayPause}
          disabled={controlsDisabled}
          aria-label={
            controlsDisabled
              ? 'Använd Spotify-spelaren för att kontrollera uppspelning'
              : isPlaying
                ? 'Pausa'
                : 'Spela'
          }
          className={`rounded-full shrink-0 flex items-center justify-center shadow-lg transition-all active:scale-95 w-16 h-16 text-white ${
            controlsDisabled
              ? 'bg-[rgb(var(--color-border))] cursor-not-allowed opacity-50'
              : 'bg-[rgb(var(--color-accent))] hover:opacity-90'
          }`}
        >
          {isPlaying ? (
            <PauseIcon className="w-8 h-8" aria-hidden />
          ) : (
            <PlayIcon className="w-8 h-8 ml-0.5" aria-hidden />
          )}
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={controlsDisabled}
          aria-label="Nästa spår"
          className={`transition-colors ${
            controlsDisabled
              ? 'text-[rgb(var(--color-border))] cursor-not-allowed'
              : 'text-[rgb(var(--color-text))] hover:text-[rgb(var(--color-accent))]'
          }`}
        >
          <SkipNextIcon className="w-8 h-8" />
        </button>

        <button
          type="button"
          aria-label={
            repeatMode === 'one'
              ? 'Repetera en låt'
              : repeatMode === 'all'
                ? 'Repetera alla'
                : repeatMode === 'stop'
                  ? 'Stoppa efter spåret'
                  : 'Repetera av'
          }
          aria-pressed={repeatMode !== 'none'}
          onClick={() => onCycleRepeat()}
          className={`relative w-10 h-10 flex items-center justify-center transition-colors ${
            repeatMode !== 'none'
              ? 'text-[rgb(var(--color-accent))]'
              : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]'
          }`}
        >
          {repeatMode === 'stop' ? (
            <StopAfterIcon className="w-6 h-6" />
          ) : (
            <RepeatIcon className="w-6 h-6" />
          )}
          {repeatMode === 'one' && (
            <span
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-extrabold bg-white px-0.5 leading-none shadow-sm rounded-sm text-[rgb(var(--color-accent))]"
              aria-hidden
            >
              1
            </span>
          )}
        </button>
      </div>
    );
  }

  // variant === 'bar'
  return (
    <div
      className="flex flex-col items-center justify-end md:justify-center w-1/2 md:w-1/3 gap-1"
      onClick={(e) => e.stopPropagation()}
      role="group"
      aria-label="Spelarkontroller"
    >
      {controlsDisabled && (
        <p className="hidden md:block text-[9px] text-[rgb(var(--color-text-muted))] text-center mb-1">
          Använd Spotify-spelaren
        </p>
      )}
      <div className="flex items-center gap-2 md:gap-4">
        <button
          type="button"
          aria-label={isShuffled ? 'Shuffle påslaget, klicka för att stänga av' : 'Shuffle avslaget, klicka för att slå på'}
          aria-pressed={isShuffled}
          onClick={() => onToggleShuffle()}
          className={`relative w-8 h-8 items-center justify-center transition-colors hidden md:flex ${isShuffled ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]'}`}
        >
          {isShuffled ? (
            <ShuffleIcon className="w-5 h-5" />
          ) : (
            <ShuffleOffIcon className="w-5 h-5" />
          )}
        </button>

        <button
          type="button"
          onClick={onJumpBack}
          disabled={controlsDisabled}
          aria-label={`Spola tillbaka ${jumpLabel}`}
          title={`Rewind ${jumpLabel}`}
          className={`group relative w-10 h-10 flex items-center justify-center transition-colors ${fullMode ? 'flex' : 'hidden md:flex'} ${
            controlsDisabled
              ? 'text-[rgb(var(--color-border))] cursor-not-allowed'
              : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]'
          }`}
        >
          <JumpBackIcon className="w-6 h-6" />
          <span
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-px text-[8px] font-bold select-none pointer-events-none ${
              controlsDisabled
                ? 'text-[rgb(var(--color-border))]'
                : 'text-[rgb(var(--color-text-muted))] group-hover:text-[rgb(var(--color-accent))]'
            }`}
            aria-hidden
          >
            {jumpAmount}
          </span>
        </button>

        <button
          type="button"
          onClick={onPrev}
          disabled={controlsDisabled}
          aria-label="Föregående spår"
          title="Previous Track"
          className={`transition-colors ${
            controlsDisabled
              ? 'text-[rgb(var(--color-border))] cursor-not-allowed'
              : 'text-[rgb(var(--color-text))] hover:text-[rgb(var(--color-accent))]'
          }`}
        >
          <SkipPreviousIcon className="w-6 h-6" />
        </button>

        <button
          type="button"
          onClick={onTogglePlayPause}
          disabled={controlsDisabled}
          aria-label={
            controlsDisabled
              ? 'Använd Spotify-spelaren för att kontrollera uppspelning'
              : isPlaying
                ? 'Pausa'
                : 'Spela'
          }
          title={
            controlsDisabled
              ? 'Använd Spotify-spelaren för att kontrollera uppspelning'
              : isPlaying
                ? 'Pause'
                : 'Play'
          }
          className={`rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 shrink-0 aspect-square text-white ${fullMode ? 'w-16 h-16' : 'w-12 h-12'} ${
            controlsDisabled
              ? 'bg-[rgb(var(--color-border))] cursor-not-allowed opacity-50'
              : 'bg-[rgb(var(--color-accent))] hover:opacity-90'
          }`}
        >
          {isPlaying ? (
            <PauseIcon className={fullMode ? 'w-8 h-8' : 'w-6 h-6'} aria-hidden />
          ) : (
            <PlayIcon className={`${fullMode ? 'w-8 h-8' : 'w-6 h-6'} ml-0.5`} aria-hidden />
          )}
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={controlsDisabled}
          aria-label="Nästa spår"
          title="Next Track"
          className={`transition-colors ${
            controlsDisabled
              ? 'text-[rgb(var(--color-border))] cursor-not-allowed'
              : 'text-[rgb(var(--color-text))] hover:text-[rgb(var(--color-accent))]'
          }`}
        >
          <SkipNextIcon className="w-6 h-6" />
        </button>

        <button
          type="button"
          onClick={onJumpForward}
          disabled={controlsDisabled}
          aria-label={`Spola framåt ${jumpLabel}`}
          title={`Forward ${jumpLabel}`}
          className={`group relative w-10 h-10 flex items-center justify-center transition-colors ${fullMode ? 'flex' : 'hidden md:flex'} ${
            controlsDisabled
              ? 'text-[rgb(var(--color-border))] cursor-not-allowed'
              : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]'
          }`}
        >
          <JumpForwardIcon className="w-6 h-6" />
          <span
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-px text-[8px] font-bold select-none pointer-events-none ${
              controlsDisabled
                ? 'text-[rgb(var(--color-border))]'
                : 'text-[rgb(var(--color-text-muted))] group-hover:text-[rgb(var(--color-accent))]'
            }`}
            aria-hidden
          >
            {jumpAmount}
          </span>
        </button>

        <button
          type="button"
          aria-label={
            repeatMode === 'one'
              ? 'Repetera en låt, klicka för att stoppa efter spår'
              : repeatMode === 'all'
                ? 'Repetera alla, klicka för att repetera en'
                : repeatMode === 'stop'
                  ? 'Stoppa efter spåret, klicka för att stänga av'
                  : 'Repetera av, klicka för att repetera alla'
          }
          aria-pressed={repeatMode !== 'none'}
          onClick={() => onCycleRepeat()}
          title="Repeat"
          className={`relative w-8 h-8 flex items-center justify-center transition-colors ${fullMode ? 'flex' : 'hidden md:flex'} ${repeatMode !== 'none' ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]'}`}
        >
          {repeatMode === 'stop' ? (
            <StopAfterIcon className="w-5 h-5" />
          ) : (
            <RepeatIcon className="w-5 h-5" />
          )}
          {repeatMode === 'one' && (
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-extrabold bg-white px-0.5 leading-none shadow-sm rounded-sm text-[rgb(var(--color-accent))]" aria-hidden>
              1
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onShowQueue(); }}
          aria-label={isQueueOpen ? 'Stäng kö' : 'Visa kö'}
          aria-pressed={isQueueOpen}
          title={isQueueOpen ? 'Stäng kö' : 'Visa kö'}
          className={`relative w-8 h-8 flex items-center justify-center transition-colors ${fullMode ? 'flex' : 'hidden md:flex'} ${isQueueOpen || hasQueue ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]'}`}
        >
          <QueueListIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
