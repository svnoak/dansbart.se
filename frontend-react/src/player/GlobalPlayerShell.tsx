import { useState, useEffect, useRef, useCallback } from 'react';
import { useConsent } from '@/consent/useConsent';
import { usePlayer } from '@/player/usePlayer';
import {
  getEmbedUrlForSource,
  getYouTubeVideoId,
  hasYouTube,
  hasSpotify,
  type PlaybackSource,
} from '@/player/embedUrl';
import { SmartNudge } from '@/player/SmartNudge';
import { useYouTubePlayer } from './hooks/useYouTubePlayer';
import { usePlaybackPosition } from './hooks/usePlaybackPosition';
import { useWindowWidth } from './hooks/useWindowWidth';
import { useStructureBars } from './hooks/useStructureBars';
import { EmbedContainer } from './components/EmbedContainer';
import { PlayerProgressBar } from './components/PlayerProgressBar';
import { SourceSwitcher } from './components/SourceSwitcher';
import { TrackInfo } from './components/TrackInfo';
import { PlayerControls } from './components/PlayerControls';
import { MobilePlayerOverlay } from './components/MobilePlayerOverlay';

const JUMP_SECONDS = 10;
const JUMP_BARS = 4;

export function GlobalPlayerShell() {
  const { consentStatus } = useConsent();
  const {
    currentTrack,
    queue,
    isPlaying,
    playFromQueue,
    togglePlayPause,
    removeFromQueue,
    clearQueue,
    next,
    prev,
    queueOpen,
    toggleQueue,
  } = usePlayer();

  const [expanded, setExpanded] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'one' | 'all'>('none');
  const [activeSource, setActiveSource] = useState<PlaybackSource>('youtube');
  const [structureMode, setStructureMode] = useState<'none' | 'bars'>('none');

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const isDraggingRef = useRef(false);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const windowWidth = useWindowWidth();
  const bars = useStructureBars(currentTrack?.id);

  const hasYt = hasYouTube(currentTrack);
  const hasSpot = hasSpotify(currentTrack);
  const embedUrl = getEmbedUrlForSource(currentTrack, activeSource);
  const youtubeVideoId = getYouTubeVideoId(currentTrack);
  const isYouTubeEmbed = activeSource === 'youtube' && !!youtubeVideoId;

  // Reset position and source when track changes
  const [prevTrackId, setPrevTrackId] = useState(currentTrack?.id);
  if (prevTrackId !== currentTrack?.id) {
    setPrevTrackId(currentTrack?.id);
    if (currentTrack) {
      setActiveSource(hasYt ? 'youtube' : hasSpot ? 'spotify' : activeSource);
      if (embedUrl) setExpanded(true);
    }
  }

  // Auto-close mobile overlay when resizing to desktop
  const [prevWindowWidth, setPrevWindowWidth] = useState(windowWidth);
  if (prevWindowWidth !== windowWidth) {
    setPrevWindowWidth(windowWidth);
    if (windowWidth >= 768 && expanded) {
      setExpanded(false);
    }
  }

  const { ytPlayerRef } = useYouTubePlayer({
    youtubeVideoId,
    consentStatus,
    isPlaying,
    activeSource,
    onEnded: next,
  });

  const { playbackPositionMs, setPlaybackPositionMs, playbackDurationMs, setPlaybackDurationMs } =
    usePlaybackPosition({
      isYouTubeEmbed,
      isPlaying,
      ytPlayerRef,
      isDraggingRef,
    });

  // Reset playback position when track changes
  const [prevTrackIdForPos, setPrevTrackIdForPos] = useState(currentTrack?.id);
  if (prevTrackIdForPos !== currentTrack?.id) {
    setPrevTrackIdForPos(currentTrack?.id);
    setPlaybackPositionMs(0);
    setPlaybackDurationMs(0);
  }

  // Keep Spotify iframe in sync with play/pause (postMessage)
  useEffect(() => {
    if (isYouTubeEmbed || !iframeRef.current) return;
    try {
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({
          event: 'command',
          func: isPlaying ? 'playVideo' : 'pauseVideo',
          args: [],
        }),
        '*'
      );
    } catch {
      // ignore
    }
  }, [isPlaying, isYouTubeEmbed]);

  const trackDurationMs = currentTrack?.durationMs ?? 0;
  const durationMs = playbackDurationMs > 0 ? playbackDurationMs : trackDurationMs;
  const progressPercent = durationMs > 0 ? Math.min(100, (playbackPositionMs / durationMs) * 100) : 0;
  const durationSec = durationMs / 1000;

  const barTicks =
    structureMode === 'bars' && durationSec > 0
      ? bars.map((time) => ({ left: (time / durationSec) * 100 })).filter((b) => b.left <= 100)
      : [];
  const structureButtonLabel = structureMode === 'bars' ? 'Dolj takter' : 'Visa takter';

  const handleSeek = (clientX: number) => {
    if (!isYouTubeEmbed || !progressBarRef.current || !ytPlayerRef.current?.seekTo) return;
    const effectiveDurationSec = durationSec || (ytPlayerRef.current.getDuration?.() ?? 0);
    if (effectiveDurationSec <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const sec = fraction * effectiveDurationSec;
    setPlaybackPositionMs(sec * 1000);
    ytPlayerRef.current.seekTo(sec, true);
  };

  const hasBars = structureMode === 'bars' && bars.length > 0;
  const jumpAmount = hasBars ? JUMP_BARS : JUMP_SECONDS;
  const jumpLabel = hasBars ? `${JUMP_BARS} takter` : `${JUMP_SECONDS} s`;

  const jumpByBars = useCallback(
    (direction: 1 | -1) => {
      if (!isYouTubeEmbed || !ytPlayerRef.current?.getCurrentTime || !ytPlayerRef.current?.seekTo) return;
      const current = ytPlayerRef.current.getCurrentTime();
      const nextBarIdx = bars.findIndex((b) => b > current);
      const currentIdx = nextBarIdx === -1 ? bars.length - 1 : Math.max(0, nextBarIdx - 1);
      let targetIdx = currentIdx + direction * JUMP_BARS;
      if (targetIdx < 0) targetIdx = 0;
      if (targetIdx >= bars.length) targetIdx = bars.length - 1;
      const sec = bars[targetIdx];
      ytPlayerRef.current.seekTo(sec, true);
      setPlaybackPositionMs(sec * 1000);
    },
    [bars, isYouTubeEmbed, ytPlayerRef, setPlaybackPositionMs]
  );

  const handleJumpBack = () => {
    if (!isYouTubeEmbed || !ytPlayerRef.current?.getCurrentTime || !ytPlayerRef.current?.seekTo) return;
    if (hasBars) { jumpByBars(-1); return; }
    const current = ytPlayerRef.current.getCurrentTime();
    const nextSec = Math.max(0, current - JUMP_SECONDS);
    ytPlayerRef.current.seekTo(nextSec, true);
    setPlaybackPositionMs(nextSec * 1000);
  };

  const handleJumpForward = () => {
    if (!isYouTubeEmbed || !ytPlayerRef.current?.getCurrentTime || !ytPlayerRef.current?.seekTo) return;
    if (hasBars) { jumpByBars(1); return; }
    const current = ytPlayerRef.current.getCurrentTime();
    const duration = durationSec || (ytPlayerRef.current.getDuration?.() ?? 0);
    const nextSec = Math.min(duration, current + JUMP_SECONDS);
    ytPlayerRef.current.seekTo(nextSec, true);
    setPlaybackPositionMs(nextSec * 1000);
  };

  const controlsDisabled = activeSource === 'spotify';
  const isMobile = windowWidth < 768;
  const fullMode = expanded;

  const toggleStructureMode = () => setStructureMode((m) => (m === 'none' ? 'bars' : 'none'));

  // Match Vue: only render player when there is a current track
  if (!currentTrack) return null;

  const getEmbedStyle = (): React.CSSProperties => {
    if (isMobile && expanded) {
      return {
        position: 'fixed',
        top: '120px',
        left: '1.5rem',
        right: '1.5rem',
        width: 'auto',
        height: 'auto',
        aspectRatio: isYouTubeEmbed ? '16/9' : 'auto',
        zIndex: 101,
      };
    } else if (!isMobile) {
      return {
        position: 'fixed',
        bottom: '112px',
        left: '16px',
        width: isYouTubeEmbed ? '400px' : '320px',
        height: isYouTubeEmbed ? '225px' : '82px',
        zIndex: 120,
      };
    } else {
      return {
        position: 'fixed',
        bottom: '96px',
        right: '16px',
        width: isYouTubeEmbed ? '160px' : '300px',
        height: isYouTubeEmbed ? '90px' : '82px',
        zIndex: 30,
      };
    }
  };

  return (
    <>
      {embedUrl && (isYouTubeEmbed || !isMobile || expanded) && (
        <EmbedContainer
          embedUrl={embedUrl}
          isYouTubeEmbed={isYouTubeEmbed}
          style={getEmbedStyle()}
          isPlaying={isPlaying}
          expanded={expanded}
          iframeRef={iframeRef}
        />
      )}

      {expanded && isMobile && (
        <MobilePlayerOverlay
          onClose={() => setExpanded(false)}
          hasYt={hasYt}
          hasSpot={hasSpot}
          activeSource={activeSource}
          onSourceChange={setActiveSource}
          embedUrl={embedUrl}
          isYouTubeEmbed={isYouTubeEmbed}
          currentTrack={currentTrack}
          playbackPositionMs={playbackPositionMs}
          durationMs={durationMs}
          progressPercent={progressPercent}
          controlsDisabled={controlsDisabled}
          bars={bars}
          structureMode={structureMode}
          onToggleStructureMode={toggleStructureMode}
          structureButtonLabel={structureButtonLabel}
          progressBarRef={progressBarRef}
          onSeek={handleSeek}
          isDraggingRef={isDraggingRef}
          barTicks={barTicks}
          isShuffled={isShuffled}
          onToggleShuffle={() => setIsShuffled((s) => !s)}
          repeatMode={repeatMode}
          onCycleRepeat={() => setRepeatMode((m) => (m === 'none' ? 'all' : m === 'all' ? 'one' : 'none'))}
          isPlaying={isPlaying}
          onTogglePlayPause={togglePlayPause}
          onPrev={prev}
          onNext={next}
          onJumpBack={handleJumpBack}
          onJumpForward={handleJumpForward}
          jumpAmount={jumpAmount}
          jumpLabel={jumpLabel}
          queue={queue}
          onPlayFromQueue={playFromQueue}
          onRemoveFromQueue={removeFromQueue}
          onClearQueue={clearQueue}
        />
      )}

      <SmartNudge track={currentTrack} isPlaying={isPlaying} />

      {/* Fixed bottom bar: progress on top, then 3-column row */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[120] flex flex-col border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-in-out ${
          expanded && isMobile ? 'translate-y-full' : 'translate-y-0'
        }`}
        aria-label="Global spelare"
      >
        {/* Progress bar on top - desktop only */}
        <div
          className="hidden md:block w-full px-4 pt-2"
          onClick={(e) => e.stopPropagation()}
          role="group"
          aria-label="Uppspelningsposition"
        >
          <PlayerProgressBar
            progressPercent={progressPercent}
            durationMs={durationMs}
            playbackPositionMs={playbackPositionMs}
            isYouTubeEmbed={isYouTubeEmbed}
            controlsDisabled={controlsDisabled}
            structureMode={structureMode}
            barTicks={barTicks}
            progressBarRef={progressBarRef}
            onSeek={handleSeek}
            isDraggingRef={isDraggingRef}
            variant="desktop"
          />
        </div>

        {/* Mobile: thin progress strip */}
        <div className="md:hidden w-full h-1 bg-[rgb(var(--color-border))] relative">
          <div
            className="h-full bg-[rgb(var(--color-accent))] pointer-events-none"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Main row: left (art + title) | center (controls) | right (source) */}
        <div
          className={`flex h-20 items-center justify-between px-4 py-3 ${isMobile ? 'cursor-pointer' : ''}`}
          onClick={(e) =>
            isMobile &&
            !(e.target as HTMLElement).closest('button') &&
            currentTrack &&
            setExpanded((v) => !v)
          }
          onKeyDown={(e) => {
            if (isMobile && currentTrack && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setExpanded((v) => !v);
            }
          }}
          role={isMobile ? 'button' : undefined}
          tabIndex={isMobile && currentTrack ? 0 : -1}
          aria-expanded={isMobile ? expanded : undefined}
          aria-label={isMobile && currentTrack ? 'Öppna spelaren' : undefined}
        >
          <TrackInfo
            currentTrack={currentTrack}
            playbackPositionMs={playbackPositionMs}
            durationMs={durationMs}
            activeSource={activeSource}
            bars={bars}
            structureMode={structureMode}
            onToggleStructureMode={toggleStructureMode}
            structureButtonLabel={structureButtonLabel}
          />

          <PlayerControls
            isShuffled={isShuffled}
            onToggleShuffle={() => setIsShuffled((s) => !s)}
            repeatMode={repeatMode}
            onCycleRepeat={() => setRepeatMode((m) => (m === 'none' ? 'all' : m === 'all' ? 'one' : 'none'))}
            isPlaying={isPlaying}
            onTogglePlayPause={togglePlayPause}
            controlsDisabled={controlsDisabled}
            onPrev={prev}
            onNext={next}
            onJumpBack={handleJumpBack}
            onJumpForward={handleJumpForward}
            jumpAmount={jumpAmount}
            jumpLabel={jumpLabel}
            hasQueue={queue.length > 0}
            isQueueOpen={queueOpen}
            onShowQueue={toggleQueue}
            variant="bar"
            fullMode={fullMode}
          />

          {/* Right: source switcher */}
          <div
            className="hidden md:flex w-1/3 justify-end items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <SourceSwitcher
              hasYt={hasYt}
              hasSpot={hasSpot}
              activeSource={activeSource}
              onSourceChange={setActiveSource}
              variant="desktop"
            />
          </div>
        </div>

      </div>
    </>
  );
}
