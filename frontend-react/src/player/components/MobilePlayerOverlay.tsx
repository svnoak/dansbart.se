import type { MutableRefObject } from 'react';
import { CloseIcon } from '@/icons';
import { formatDurationMs } from '@/utils/formatDuration';
import type { TrackListDto } from '@/api/models/trackListDto';
import type { PlaybackSource } from '@/player/embedUrl';
import { SourceSwitcher } from './SourceSwitcher';
import { PlayerProgressBar } from './PlayerProgressBar';
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
  isDraggingRef,
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
}: MobilePlayerOverlayProps) {
  return (
    <div className="fixed inset-0 bg-[rgb(var(--color-bg))] z-[100] flex flex-col overflow-y-auto transition-transform duration-300 ease-in-out">
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

      {/* Content area - scrollable */}
      <div className="flex-1 flex flex-col px-6 pb-10 min-h-0 overflow-y-auto">
        {/* Video/Spotify embed placeholder (actual embed positioned fixed over this) */}
        {embedUrl && (
          <div
            className="w-full mb-6 rounded-lg bg-[rgb(var(--color-border))]/20"
            style={{ aspectRatio: isYouTubeEmbed ? '16/9' : '300/82' }}
          />
        )}

        {/* Track info */}
        <div className="mb-6">
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

        {/* Spacer */}
        <div className="flex-1 min-h-[20px]" />

        {/* Spotify controls message */}
        {controlsDisabled && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-[rgb(var(--color-border))]/30 text-center">
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              Använd Spotify-spelaren ovan för att kontrollera uppspelning
            </p>
          </div>
        )}

        {/* Progress bar */}
        <div className="mb-2 shrink-0">
          <PlayerProgressBar
            progressPercent={progressPercent}
            durationMs={durationMs}
            playbackPositionMs={playbackPositionMs}
            isYouTubeEmbed={isYouTubeEmbed}
            controlsDisabled={controlsDisabled}
            structureMode={structureMode}
            barTicks={[]}
            progressBarRef={progressBarRef}
            onSeek={onSeek}
            isDraggingRef={isDraggingRef}
            variant="mobile"
          />
        </div>

        {/* Time display */}
        <div className="flex justify-between text-xs mb-4 text-[rgb(var(--color-text-muted))] font-mono">
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
          onShowQueue={() => {}}
          variant="overlay"
        />

        {/* Queue */}
        <QueuePanel
          queue={queue}
          currentTrack={currentTrack}
          onPlayFromQueue={onPlayFromQueue}
          onRemoveFromQueue={onRemoveFromQueue}
          onClearQueue={onClearQueue}
        />
      </div>
    </div>
  );
}
