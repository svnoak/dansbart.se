import { useState, type MutableRefObject } from 'react';
import { CloseIcon, QueueListIcon } from '@/icons';
import { formatDurationMs } from '@/utils/formatDuration';
import type { TrackListDto } from '@/api/models/trackListDto';
import type { PlaybackSource } from '@/player/embedUrl';
import { useCurrentBarIndex } from '@/player/hooks/useCurrentBarIndex';
import { SourceSwitcher } from './SourceSwitcher';
import { PlayerProgressBar } from './PlayerProgressBar';
import { MobileScrollableBarProgress } from './MobileScrollableBarProgress';
import { PlayerControls } from './PlayerControls';
import { QueuePanel } from './QueuePanel';

interface MobilePlayerOverlayProps {
  onClose: () => void;
  hasYt: boolean;
  hasSpot: boolean;
  activeSource: PlaybackSource;
  onSourceChange: (source: PlaybackSource) => void;
  embedUrl: string | null | undefined;
  isYouTubeEmbed: boolean;
  currentTrack: TrackListDto;
  playbackPositionMs: number;
  durationMs: number;
  progressPercent: number;
  controlsDisabled: boolean;
  bars: number[];
  structureMode: 'none' | 'bars';
  onToggleStructureMode: () => void;
  structureButtonLabel: string;
  progressBarRef: MutableRefObject<HTMLDivElement | null>;
  onSeek: (clientX: number) => void;
  onSeekToTime: (seconds: number) => void;
  isDraggingRef: MutableRefObject<boolean>;
  barTicks: { left: number }[];
  isShuffled: boolean;
  onToggleShuffle: () => void;
  repeatMode: 'none' | 'one' | 'all';
  onCycleRepeat: () => void;
  isPlaying: boolean;
  onTogglePlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onJumpBack: () => void;
  onJumpForward: () => void;
  jumpAmount: number;
  jumpLabel: string;
  queue: TrackListDto[];
  onPlayFromQueue: (index: number) => void;
  onRemoveFromQueue: (index: number) => void;
  onClearQueue: () => void;
  onReorderQueue: (fromIndex: number, toIndex: number) => void;
}

export function MobilePlayerOverlay({
  onClose,
  hasYt,
  hasSpot,
  activeSource,
  onSourceChange,
  embedUrl,
  isYouTubeEmbed,
  currentTrack,
  playbackPositionMs,
  durationMs,
  progressPercent,
  controlsDisabled,
  bars,
  structureMode,
  onToggleStructureMode,
  structureButtonLabel,
  progressBarRef,
  onSeek,
  onSeekToTime,
  isDraggingRef,
  barTicks,
  isShuffled,
  onToggleShuffle,
  repeatMode,
  onCycleRepeat,
  isPlaying,
  onTogglePlayPause,
  onPrev,
  onNext,
  onJumpBack,
  onJumpForward,
  jumpAmount,
  jumpLabel,
  queue,
  onPlayFromQueue,
  onRemoveFromQueue,
  onClearQueue,
  onReorderQueue,
}: MobilePlayerOverlayProps) {
  const [mobileQueueOpen, setMobileQueueOpen] = useState(false);
  const currentBarIndex = useCurrentBarIndex(bars, playbackPositionMs);
  const showMobileBars = structureMode === 'bars' && bars.length > 0;

  return (
    <div className="fixed inset-0 bg-[rgb(var(--color-bg))] z-[100] flex flex-col overflow-hidden transition-transform duration-300 ease-in-out">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 pt-12 pb-4 shrink-0">
        <button
          onClick={onClose}
          aria-label="Stäng spelare"
          className="text-[rgb(var(--color-text))] hover:text-[rgb(var(--color-accent))] transition-colors"
        >
          <CloseIcon className="w-8 h-8" />
        </button>
        <SourceSwitcher
          hasYt={hasYt}
          hasSpot={hasSpot}
          activeSource={activeSource}
          onSourceChange={onSourceChange}
          variant="mobile"
        />
      </div>

      {/* Scrollable top section: embed + track info */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6">
        {/* Video/Spotify embed placeholder (actual embed positioned fixed over this) */}
        {embedUrl && (
          <div
            className="w-full mb-6 rounded-lg bg-[rgb(var(--color-border))]/20 shrink-0"
            style={{ aspectRatio: isYouTubeEmbed ? '16/9' : '300/82' }}
          />
        )}

        {/* Track info */}
        <div className="mb-6 shrink-0">
          <h2 className="text-2xl font-extrabold text-[rgb(var(--color-text))] mb-2">
            {currentTrack.title}
          </h2>
          <p className="text-lg text-[rgb(var(--color-accent))] font-bold mb-1">
            {currentTrack.artistName ?? 'Okänd artist'}
          </p>
          {currentTrack.danceStyle && (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              {currentTrack.danceStyle}
              {currentTrack.subStyle && ` · ${currentTrack.subStyle}`}
            </p>
          )}
        </div>
      </div>

      {/* Fixed bottom controls section */}
      <div className="shrink-0 px-6 pb-6">
        {/* Spotify controls message */}
        {controlsDisabled && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-[rgb(var(--color-border))]/30 text-center">
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              Använd Spotify-spelaren ovan för att kontrollera uppspelning
            </p>
          </div>
        )}

        {/* Progress bar — swaps between thin bar and scrollable bar segments */}
        <div className="mb-2">
          {showMobileBars ? (
            <MobileScrollableBarProgress
              bars={bars}
              currentBarIndex={currentBarIndex}
              playbackPositionMs={playbackPositionMs}
              durationMs={durationMs}
              onSeekToTime={onSeekToTime}
              isDraggingRef={isDraggingRef}
            />
          ) : (
            <PlayerProgressBar
              progressPercent={progressPercent}
              durationMs={durationMs}
              playbackPositionMs={playbackPositionMs}
              isYouTubeEmbed={isYouTubeEmbed}
              controlsDisabled={controlsDisabled}
              structureMode={structureMode}
              barTicks={barTicks}
              progressBarRef={progressBarRef}
              onSeek={onSeek}
              isDraggingRef={isDraggingRef}
              variant="mobile"
            />
          )}
        </div>

        {/* Time display */}
        <div className="flex justify-between text-xs mb-2 text-[rgb(var(--color-text-muted))] font-mono">
          <span>{formatDurationMs(Math.round(playbackPositionMs))}</span>
          <span>{durationMs > 0 ? formatDurationMs(durationMs) : '0:00'}</span>
        </div>

        {/* Structure mode toggle */}
        {bars.length > 0 && (
          <div className="flex items-center justify-center mb-4">
            <button
              type="button"
              onClick={() => onToggleStructureMode()}
              className={`text-xs font-bold uppercase border px-3 py-1 rounded transition-colors ${
                structureMode !== 'none'
                  ? 'bg-[rgb(var(--color-accent))]/10 text-[rgb(var(--color-accent))] border-[rgb(var(--color-accent))]/30'
                  : 'bg-transparent text-[rgb(var(--color-text-muted))] border-[rgb(var(--color-border))]'
              }`}
            >
              {structureButtonLabel}
            </button>
          </div>
        )}

        {/* Controls */}
        <PlayerControls
          isShuffled={isShuffled}
          onToggleShuffle={onToggleShuffle}
          repeatMode={repeatMode}
          onCycleRepeat={onCycleRepeat}
          isPlaying={isPlaying}
          onTogglePlayPause={onTogglePlayPause}
          controlsDisabled={controlsDisabled}
          onPrev={onPrev}
          onNext={onNext}
          onJumpBack={onJumpBack}
          onJumpForward={onJumpForward}
          jumpAmount={jumpAmount}
          jumpLabel={jumpLabel}
          hasQueue={queue.length > 0}
          isQueueOpen={mobileQueueOpen}
          onShowQueue={() => setMobileQueueOpen((v) => !v)}
          variant="overlay"
        />

        {/* Queue toggle pill */}
        <div className="flex justify-center mb-4">
          <button
            type="button"
            onClick={() => setMobileQueueOpen((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
              mobileQueueOpen || queue.length > 0
                ? 'bg-[rgb(var(--color-accent))]/10 text-[rgb(var(--color-accent))] border border-[rgb(var(--color-accent))]/30'
                : 'bg-[rgb(var(--color-border))]/30 text-[rgb(var(--color-text-muted))] border border-[rgb(var(--color-border))]'
            }`}
          >
            <QueueListIcon className="w-5 h-5" />
            Ko ({queue.length})
          </button>
        </div>
      </div>

      {/* Queue slide-over panel */}
      <div
        className={`absolute inset-0 bg-[rgb(var(--color-bg))] z-10 flex flex-col transition-transform duration-300 ease-in-out ${
          mobileQueueOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="px-6 pt-12 pb-4 shrink-0">
          <QueuePanel
            queue={queue}
            currentTrack={currentTrack}
            onPlayFromQueue={onPlayFromQueue}
            onRemoveFromQueue={onRemoveFromQueue}
            onClearQueue={onClearQueue}
            onReorderQueue={onReorderQueue}
            onClose={() => setMobileQueueOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}
