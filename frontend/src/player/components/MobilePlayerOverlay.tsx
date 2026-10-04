import { useState, type MutableRefObject } from 'react';
import { ChevronDownIcon, QueueListIcon } from '@/icons';
import { IconButton } from '@/ui/IconButton';
import { formatDurationMs } from '@/utils/formatDuration';
import { tempoCategoryLabel } from '@/utils/tempoLabel';
import { StylePill } from '@/components/TrackRow/StylePill';
import { stylePillState } from '@/components/TrackRow/stylePillState';
import type { TrackListDto } from '@/api/models/trackListDto';
import type { PlaybackSource } from '@/player/embedUrl';
import { useCurrentBarIndex } from '@/player/hooks/useCurrentBarIndex';
import { SmartNudge } from '@/player/SmartNudge';
import { WakeLockToggle } from '../WakeLockToggle';
import { SourceSwitcher } from './SourceSwitcher';
import { PlayerProgressBar } from './PlayerProgressBar';
import { MobileScrollableBarProgress } from './MobileScrollableBarProgress';
import { PlayerControls } from './PlayerControls';
import { QueuePanel } from './QueuePanel';

/**
 * Where the top of the embed sits. GlobalPlayerShell positions the real embed
 * at this fixed offset, so the header below must end exactly here.
 */
const EMBED_TOP_PX = 108;
const HEADER_ROW_PX = 56;

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
  repeatMode: 'none' | 'one' | 'all' | 'stop';
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
  const barsOn = structureMode === 'bars';
  const pillState = stylePillState(currentTrack.danceStyle, currentTrack.confidence);
  const tempo = tempoCategoryLabel(currentTrack.tempoCategory);
  const subtitle = [currentTrack.artistName ?? 'Okänd artist', currentTrack.albumTitle]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="fixed inset-0 bg-[rgb(var(--color-bg))] z-[100] flex flex-col overflow-hidden transition-transform duration-300 ease-in-out">
      {/* Header: a 56 px row, padded down so the embed below lands where the shell places it */}
      <div className="shrink-0 px-3" style={{ paddingTop: `${EMBED_TOP_PX - HEADER_ROW_PX}px` }}>
        <div className="grid grid-cols-[44px_1fr_44px] items-center" style={{ height: `${HEADER_ROW_PX}px` }}>
          <IconButton aria-label="Stäng spelaren" onClick={onClose}>
            <ChevronDownIcon className="h-6 w-6" aria-hidden />
          </IconButton>
          <p className="text-center text-[13px] font-semibold text-[rgb(var(--color-text-muted))]">Spelar nu</p>
          <IconButton
            aria-label={mobileQueueOpen ? 'Stäng kön' : 'Visa kön'}
            aria-pressed={mobileQueueOpen}
            onClick={() => setMobileQueueOpen((v) => !v)}
            className={mobileQueueOpen ? 'bg-[rgb(var(--color-accent-muted))]' : ''}
          >
            <QueueListIcon className="h-5 w-5" aria-hidden />
          </IconButton>
        </div>
      </div>

      {/* Scrollable top section: embed + track info */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6">
        {/* Video/Spotify embed placeholder (actual embed positioned fixed over this) */}
        {embedUrl && (
          <div
            className="w-full mb-2 rounded-[var(--radius-lg)] bg-[rgb(var(--color-accent-muted))] shrink-0"
            style={{ aspectRatio: isYouTubeEmbed ? '16/9' : '300/82' }}
          />
        )}

        <div className="mb-4 flex justify-center">
          <SourceSwitcher
            hasYt={hasYt}
            hasSpot={hasSpot}
            activeSource={activeSource}
            onSourceChange={onSourceChange}
            variant="mobile"
          />
        </div>

        {/* Track info */}
        <div className="mb-6 shrink-0">
          <h2 className="text-[22px] font-bold leading-tight text-[rgb(var(--color-text))] mb-1">
            {currentTrack.title}
          </h2>
          <p className="text-[15px] text-[rgb(var(--color-text-muted))] mb-3">{subtitle}</p>
          <div className="flex flex-wrap items-center gap-2">
            <StylePill style={currentTrack.danceStyle} state={pillState} size="md" />
            {tempo && <span className="text-[14px] text-[rgb(var(--color-text-muted))]">{tempo}</span>}
          </div>
        </div>

        {/* Inline SmartNudge */}
        <SmartNudge track={currentTrack} isPlaying={isPlaying} inline mobilePlayerOpen={true} />
      </div>

      {/* Fixed bottom controls section */}
      <div className="shrink-0 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/* Spotify controls message */}
        {controlsDisabled && (
          <div className="mb-4 rounded-[var(--radius)] bg-[rgb(var(--color-accent-muted))] px-4 py-2 text-center">
            <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
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
            />
          ) : (
            <PlayerProgressBar
              progressPercent={progressPercent}
              durationMs={durationMs}
              playbackPositionMs={playbackPositionMs}
              isYouTubeEmbed={isYouTubeEmbed || activeSource === 'local'}
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

        {/* Time row, with the bars switch between the two times when the track has bars */}
        <div className="mb-2 flex items-center justify-between text-[13px] tabular-nums text-[rgb(var(--color-text-muted))]">
          <span>{formatDurationMs(Math.round(playbackPositionMs))}</span>
          {bars.length > 0 && (
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[13px] font-semibold text-[rgb(var(--color-text))]">
              <input
                type="checkbox"
                checked={barsOn}
                onChange={onToggleStructureMode}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={`relative inline-block h-6 w-10 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[rgb(var(--color-focus))] ${
                  barsOn ? 'bg-[rgb(var(--color-selected))]' : 'bg-[rgb(var(--color-border-strong))]'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    barsOn ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`}
                />
              </span>
              Takter
            </label>
          )}
          <span>{durationMs > 0 ? formatDurationMs(durationMs) : '0:00'}</span>
        </div>

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

        <div className="mt-3">
          <WakeLockToggle />
        </div>
      </div>

      {/* Queue slide-up panel */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-[rgb(var(--color-bg))] z-10 flex flex-col transition-transform duration-300 ease-in-out ${
          mobileQueueOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          top:
            isYouTubeEmbed && embedUrl
              ? `calc(${EMBED_TOP_PX}px + (100vw - 3rem) * 9 / 16 + 0.5rem)`
              : 0,
        }}
      >
        <div className="px-6 pt-4 pb-4 flex-1 min-h-0">
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
