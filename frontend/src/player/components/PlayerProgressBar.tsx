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
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const getMagneticX = (clientX: number): number => {
    if (structureMode !== 'bars' || barTicks.length === 0 || !progressBarRef.current) {
      return clientX;
    }
    const rect = progressBarRef.current.getBoundingClientRect();
    const SNAP_THRESHOLD_PX = 8;
    let closestTickX = clientX;
    let closestDistance = Infinity;
    for (const tick of barTicks) {
      const tickX = rect.left + (tick.left / 100) * rect.width;
      const distance = Math.abs(tickX - clientX);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestTickX = tickX;
      }
    }
    return closestDistance <= SNAP_THRESHOLD_PX ? closestTickX : clientX;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!seekable) return;
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    const target = e.currentTarget;
    const pointerId = e.pointerId;
    target.setPointerCapture(pointerId);
    onSeek(getMagneticX(e.clientX));
    const onMove = (moveEvent: PointerEvent) => onSeek(getMagneticX(moveEvent.clientX));
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
      e.stopPropagation();
      if (!controlsDisabled) onSeek(getMagneticX(e.clientX));
    },
    onPointerDown: handlePointerDown,
    role: 'slider' as const,
    'aria-label': 'Spola i låten',
    'aria-valuemin': 0,
    'aria-valuemax': durationMs,
    'aria-valuenow': Math.round(playbackPositionMs),
    'aria-valuetext': `${formatDurationMs(Math.round(playbackPositionMs))} av ${durationMs > 0 ? formatDurationMs(durationMs) : '0:00'}`,
  };

  const getHoveredBarIndex = (clientX: number): number | null => {
    if (!progressBarRef.current || barTicks.length === 0) return null;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    // Find the bar whose tick is closest
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < barTicks.length; i++) {
      const dist = Math.abs(barTicks[i].left - pct);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    return closestIdx;
  };

  const handleBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const idx = getHoveredBarIndex(e.clientX);
    setHoveredBar(idx);
    if (progressBarRef.current) {
      const rect = progressBarRef.current.getBoundingClientRect();
      setHoverX(e.clientX - rect.left);
    }
  };

  const handleBarMouseLeave = () => {
    setHoveredBar(null);
  };

  // Desktop bars mode: continuous bar with tick overlays + numbered labels + hover tooltip
  if (structureMode === 'bars' && barTicks.length > 0 && variant === 'desktop') {
    const shouldShowLabel = (i: number) => {
      const barNum = i + 1;
      return barNum === 1 || barNum % 4 === 0;
    };

    return (
      <div className="relative w-full h-8 flex flex-col justify-end">
        {/* Bar number labels */}
        <div className="absolute top-0 left-0 right-0 h-4 pointer-events-none select-none">
          {barTicks.map((tick, i) =>
            shouldShowLabel(i) ? (
              <span
                key={i}
                className="absolute text-[10px] font-mono text-[rgb(var(--color-text-muted))]/60 -translate-x-1/2"
                style={{ left: `${tick.left}%` }}
              >
                {i + 1}
              </span>
            ) : null,
          )}
        </div>

        {/* Progress bar area */}
        <div
          {...sharedProps}
          className={`relative w-full h-3 rounded-full bg-[rgb(var(--color-border))] ${seekable ? 'cursor-pointer' : ''}`}
          onMouseMove={handleBarMouseMove}
          onMouseLeave={handleBarMouseLeave}
        >
          {/* Filled progress */}
          <div
            className={`absolute inset-y-0 left-0 rounded-full bg-[rgb(var(--color-accent))]/40 pointer-events-none${!isDragging ? ' transition-[width] duration-200 ease-linear' : ''}`}
            style={{ width: `${progressPercent}%` }}
          />

          {/* Tick lines */}
          {barTicks.map((tick, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-[rgb(var(--color-text-muted))]/30 pointer-events-none"
              style={{ left: `${tick.left}%` }}
            />
          ))}

          {/* Playhead dot */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 pointer-events-none${!isDragging ? ' transition-[left] duration-200 ease-linear' : ''}`}
            style={{ left: `${progressPercent}%` }}
          >
            <div className="h-3.5 w-3.5 bg-[rgb(var(--color-accent))] rounded-full shadow" />
          </div>

          {/* Hover tooltip */}
          {hoveredBar !== null && (
            <div
              className="absolute -top-7 -translate-x-1/2 z-20 pointer-events-none bg-[rgb(var(--color-bg-secondary))] border border-[rgb(var(--color-border))] rounded px-1.5 py-0.5 text-[10px] font-mono text-[rgb(var(--color-text-primary))] shadow whitespace-nowrap"
              style={{ left: `${hoverX}px` }}
            >
              Takt {hoveredBar + 1}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mobile bars mode: continuous bar with tick overlays (no labels/tooltip)
  if (structureMode === 'bars' && barTicks.length > 0 && variant === 'mobile') {
    return (
      <div
        {...sharedProps}
        className={`relative w-full h-2 rounded-full bg-[rgb(var(--color-border))] ${seekable ? 'cursor-pointer' : ''}`}
      >
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-[rgb(var(--color-accent))] pointer-events-none${!isDragging ? ' transition-[width] duration-200 ease-linear' : ''}`}
          style={{ width: `${progressPercent}%` }}
        />
        {barTicks.map((tick, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-px bg-[rgb(var(--color-text-muted))]/30 pointer-events-none"
            style={{ left: `${tick.left}%` }}
          />
        ))}
      </div>
    );
  }

  // Standard continuous progress bar (no bars mode)
  if (variant === 'mobile') {
    return (
      <div
        {...sharedProps}
        className={`relative w-full h-2 rounded-full bg-[rgb(var(--color-border))] ${seekable ? 'cursor-pointer' : ''}`}
      >
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-[rgb(var(--color-accent))] pointer-events-none${!isDragging ? ' transition-[width] duration-200 ease-linear' : ''}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    );
  }

  const handleTimeMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || durationMs <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(Math.round(pct * durationMs));
    setHoverX(e.clientX - rect.left);
  };

  const handleTimeMouseLeave = () => {
    setHoverTime(null);
  };

  return (
    <div
      {...sharedProps}
      className={`group relative w-full h-1.5 rounded-full bg-[rgb(var(--color-border))] ${seekable ? 'cursor-pointer' : ''}`}
      onMouseMove={handleTimeMouseMove}
      onMouseLeave={handleTimeMouseLeave}
    >
      <div
        className={`absolute inset-y-0 left-0 rounded-full bg-[rgb(var(--color-accent))]/40 pointer-events-none${!isDragging ? ' transition-[width] duration-200 ease-linear' : ''}`}
        style={{ width: `${progressPercent}%` }}
      />
      <div
        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 pointer-events-none${!isDragging ? ' transition-[left] duration-200 ease-linear' : ''}`}
        style={{ left: `${progressPercent}%` }}
      >
        <div className="h-3 w-3 bg-[rgb(var(--color-accent))] rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      {hoverTime !== null && (
        <div
          className="absolute -top-7 -translate-x-1/2 z-20 pointer-events-none bg-[rgb(var(--color-bg-secondary))] border border-[rgb(var(--color-border))] rounded px-1.5 py-0.5 text-[10px] font-mono text-[rgb(var(--color-text-primary))] shadow whitespace-nowrap"
          style={{ left: `${hoverX}px` }}
        >
          {formatDurationMs(hoverTime)}
        </div>
      )}
    </div>
  );
}
