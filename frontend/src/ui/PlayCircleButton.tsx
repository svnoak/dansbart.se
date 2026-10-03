import type { ButtonHTMLAttributes } from 'react';
import { PauseIcon, PlayIcon } from '@/icons';

interface PlayCircleButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** The accessible name, with a verb: "Spela Bingsjöpolska". */
  'aria-label': string;
  playing?: boolean;
  size?: 'sm' | 'md';
}

/** The round play button every list uses: paper disc, strong edge, Falu red when it is playing. */
export function PlayCircleButton({
  playing = false,
  size = 'md',
  className = '',
  'aria-label': ariaLabel,
  ...props
}: PlayCircleButtonProps) {
  const dims = size === 'sm' ? 'h-10 w-10' : 'h-12 w-12';
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={`flex ${dims} shrink-0 items-center justify-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--color-bg))] focus-visible:ring-[rgb(var(--color-accent))] disabled:opacity-50 ${
        playing
          ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-accent))]'
          : 'border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] text-[rgb(var(--color-text))] hover:border-[rgb(var(--color-accent))] hover:text-[rgb(var(--color-accent))]'
      } ${className}`}
      {...props}
    >
      {playing ? <PauseIcon className={icon} aria-hidden /> : <PlayIcon className={`${icon} ml-0.5`} aria-hidden />}
    </button>
  );
}
