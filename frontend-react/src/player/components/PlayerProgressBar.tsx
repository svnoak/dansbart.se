import { useState, type MutableRefObject } from 'react';
import { formatDurationMs } from '@/utils/formatDuration';

interface BarTick {
  left: number;
}

interface PlayerProgressBarProps {
  progressPercent: number;
  durationMs: number;
  playbackPositionMs: number;
  isYouTubeEmbed: boolean;
  controlsDisabled: boolean;
  structureMode: 'none' | 'bars';
  barTicks: BarTick[];
  progressBarRef: MutableRefObject<HTMLDivElement | null>;
  onSeek: (clientX: number) => void;
  isDraggingRef: MutableRefObject<boolean>;
  variant: 'desktop' | 'mobile';
}

export function PlayerProgressBar({
  progressPercent,
  durationMs,
  playbackPositionMs,
  isYouTubeEmbed,
  controlsDisabled,
  structureMode,
  barTicks,
  progressBarRef,
  onSeek,
  isDraggingRef,
  variant,
}: PlayerProgressBarProps) {
  const seekable = isYouTubeEmbed && !controlsDisabled;
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!seekable) return;
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    const target = e.currentTarget;
    const pointerId = e.pointerId;
    target.setPointerCapture(pointerId);
    onSeek(e.clientX);
    const onMove = (moveEvent: PointerEvent) => onSeek(moveEvent.clientX);
    const onUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      target.releasePointerCapture(pointerId);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  const sharedProps = {
    ref: progressBarRef,
    onClick: (e: React.MouseEvent<HTMLDivElement>) => {
      if (controlsDisabled) return;
      e.stopPropagation();
      onSeek(e.clientX);
    },
    onPointerDown: handlePointerDown,
    role: 'slider' as const,
    'aria-label': 'Spola i låten',
    'aria-valuemin': 0,
    'aria-valuemax': durationMs,
    'aria-valuenow': Math.round(playbackPositionMs),
    'aria-valuetext': `${formatDurationMs(Math.round(playbackPositionMs))} av ${durationMs > 0 ? formatDurationMs(durationMs) : '0:00'}`,
  };

  if (variant === 'mobile') {
    return (
      <div
        {...sharedProps}
        className={`relative h-2 w-full rounded-full bg-[rgb(var(--color-border))] ${seekable ? 'cursor-pointer' : ''}`}
      >
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-[rgb(var(--color-accent))] pointer-events-none${!isDragging ? ' transition-[width] duration-200 ease-linear' : ''}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    );
  }

  return (
    <div
      {...sharedProps}
      className={`group relative w-full transition-all duration-200 ${
        structureMode === 'bars' ? 'h-8' : 'h-1.5 rounded-full'
      } bg-[rgb(var(--color-border))] ${seekable ? 'cursor-pointer' : ''}`}
    >
      {barTicks.map((tick, i) => (
        <div
          key={i}
          className="absolute top-0 h-full border-l border-[rgb(var(--color-text-muted))]/40 pointer-events-none"
          style={{ left: `${tick.left}%` }}
        />
      ))}
      <div
        className={`absolute inset-y-0 left-0 bg-[rgb(var(--color-accent))]/40 pointer-events-none${!isDragging ? ' transition-[width] duration-200 ease-linear' : ''} ${
          structureMode === 'bars' ? 'border-r-2 border-[rgb(var(--color-accent))]' : 'rounded-full'
        }`}
        style={{ width: `${progressPercent}%` }}
      />
      <div
        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 pointer-events-none${!isDragging ? ' transition-[left] duration-200 ease-linear' : ''}`}
        style={{ left: `${progressPercent}%` }}
      >
        <div className="h-3 w-3 bg-[rgb(var(--color-accent))] rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}
