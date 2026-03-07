import { useRef, useEffect, useCallback, useState, type MutableRefObject } from 'react';

const BAR_SEGMENT_WIDTH = 48;

interface MobileScrollableBarProgressProps {
  bars: number[];
  currentBarIndex: number;
  playbackPositionMs: number;
  durationMs: number;
  onSeekToTime: (seconds: number) => void;
  isDraggingRef: MutableRefObject<boolean>;
}

export function MobileScrollableBarProgress({
  bars,
  currentBarIndex,
  playbackPositionMs,
  durationMs,
  onSeekToTime,
  isDraggingRef,
}: MobileScrollableBarProgressProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrollingRef = useRef(false);
  const userScrollTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isInitialRef = useRef(true);
  const [isDragging, setIsDragging] = useState(false);

  const totalWidth = bars.length * BAR_SEGMENT_WIDTH;
  const positionSec = playbackPositionMs / 1000;
  const durationSec = durationMs / 1000;

  // Get the end time for a bar segment
  const getBarEnd = useCallback(
    (i: number) => {
      if (i + 1 < bars.length) return bars[i + 1];
      return durationSec > 0 ? durationSec : bars[i] + 10;
    },
    [bars, durationSec]
  );

  // Fraction through the current bar (0-1)
  const currentBarFraction =
    currentBarIndex >= 0 && currentBarIndex < bars.length
      ? Math.min(
          1,
          Math.max(
            0,
            (positionSec - bars[currentBarIndex]) /
              (getBarEnd(currentBarIndex) - bars[currentBarIndex])
          )
        )
      : 0;

  // Auto-scroll to keep current bar visible
  useEffect(() => {
    if (userScrollingRef.current || isDragging || !scrollRef.current || currentBarIndex < 0) return;
    const container = scrollRef.current;
    const targetLeft =
      currentBarIndex * BAR_SEGMENT_WIDTH - container.clientWidth / 2 + BAR_SEGMENT_WIDTH / 2;
    container.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: isInitialRef.current ? 'instant' : 'smooth',
    });
    isInitialRef.current = false;
  }, [currentBarIndex, isDragging]);

  // Reset on track change
  useEffect(() => {
    isInitialRef.current = true;
  }, [bars]);

  // Track user scrolling
  const handleScroll = useCallback(() => {
    if (isDragging) return;
    userScrollingRef.current = true;
    clearTimeout(userScrollTimerRef.current);
    userScrollTimerRef.current = setTimeout(() => {
      userScrollingRef.current = false;
    }, 2000);
  }, [isDragging]);

  // Seek from pointer position
  const getSecondsFromPointer = useCallback(
    (clientX: number) => {
      if (!scrollRef.current || bars.length === 0) return null;
      const rect = scrollRef.current.getBoundingClientRect();
      const x = clientX - rect.left + scrollRef.current.scrollLeft;
      const barIndex = Math.max(0, Math.min(bars.length - 1, Math.floor(x / BAR_SEGMENT_WIDTH)));
      const barStart = bars[barIndex];
      const barEnd = getBarEnd(barIndex);
      const fraction = Math.max(
        0,
        Math.min(1, (x - barIndex * BAR_SEGMENT_WIDTH) / BAR_SEGMENT_WIDTH)
      );
      return barStart + fraction * (barEnd - barStart);
    },
    [bars, getBarEnd]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      isDraggingRef.current = true;
      setIsDragging(true);
      const target = e.currentTarget;
      const pointerId = e.pointerId;
      target.setPointerCapture(pointerId);

      const sec = getSecondsFromPointer(e.clientX);
      if (sec !== null) onSeekToTime(sec);

      const onMove = (moveEvent: PointerEvent) => {
        const s = getSecondsFromPointer(moveEvent.clientX);
        if (s !== null) onSeekToTime(s);
      };
      const onUp = () => {
        isDraggingRef.current = false;
        setIsDragging(false);
        target.releasePointerCapture(pointerId);
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [getSecondsFromPointer, onSeekToTime, isDraggingRef]
  );

  if (bars.length === 0) return null;

  return (
    <div className="relative">
      {/* Left fade gradient */}
      <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-[rgb(var(--color-bg))] to-transparent z-10 pointer-events-none" />
      {/* Right fade gradient */}
      <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-[rgb(var(--color-bg))] to-transparent z-10 pointer-events-none" />

      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-hide touch-pan-x"
        onScroll={handleScroll}
      >
        <div
          className="relative h-10 flex"
          style={{ width: `${totalWidth}px` }}
          onPointerDown={handlePointerDown}
          role="slider"
          aria-label="Spola i låten"
          aria-valuemin={0}
          aria-valuemax={durationMs}
          aria-valuenow={Math.round(playbackPositionMs)}
        >
          {bars.map((_, i) => {
            const isPast = i < currentBarIndex;
            const isCurrent = i === currentBarIndex;
            return (
              <div
                key={i}
                className="relative shrink-0 border-r border-[rgb(var(--color-text-muted))]/20"
                style={{ width: `${BAR_SEGMENT_WIDTH}px` }}
              >
                {/* Fill for past bars */}
                {isPast && (
                  <div className="absolute inset-0 bg-[rgb(var(--color-accent))]/30" />
                )}
                {/* Partial fill for current bar */}
                {isCurrent && (
                  <div
                    className={`absolute inset-y-0 left-0 bg-[rgb(var(--color-accent))]/30 border-r-2 border-[rgb(var(--color-accent))]${!isDragging ? ' transition-[width] duration-200 ease-linear' : ''}`}
                    style={{ width: `${currentBarFraction * 100}%` }}
                  />
                )}
                {/* Bar number */}
                <span className="absolute inset-0 flex items-center justify-center text-xs font-mono text-[rgb(var(--color-text-muted))]/60 pointer-events-none select-none">
                  {i + 1}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
