import { useState, useEffect, useRef } from 'react';
import { useConsent } from '@/consent/useConsent';
import { usePlayer } from '@/player/usePlayer';
import {
  getEmbedUrlForSource,
  getYouTubeVideoId,
  hasYouTube,
  hasSpotify,
  type PlaybackSource,
} from '@/player/embedUrl';
import { IconButton } from '@/ui';
import {
  PlayIcon,
  PauseIcon,
  ShuffleIcon,
  RepeatIcon,
  SkipPreviousIcon,
  SkipNextIcon,
  JumpBackIcon,
  JumpForwardIcon,
  QueueListIcon,
  SpotifyIcon,
  YouTubeIcon,
  ChevronDownIcon,
} from '@/icons';
import type { TrackListDto } from '@/api/models/trackListDto';
import { formatDurationMs } from '@/utils/formatDuration';
import { SmartNudge } from '@/player/SmartNudge';

const YT_PLAYER_CONTAINER_ID = 'global-yt-player-container';

// Match Vue: jump amount 10 sec (structureMode 'none'); 4 bars when structure mode added later
const JUMP_SECONDS = 10;

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
  } = usePlayer();
  const [expanded, setExpanded] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'one' | 'all'>('none');
  const [activeSource, setActiveSource] = useState<PlaybackSource>('youtube');
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0);
  const [playbackDurationMs, setPlaybackDurationMs] = useState(0);
  const [ytPlayerReady, setYtPlayerReady] = useState(false);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 768
  );
  const hasYt = hasYouTube(currentTrack);
  const hasSpot = hasSpotify(currentTrack);
  const embedUrl = getEmbedUrlForSource(currentTrack, activeSource);
  const youtubeVideoId = getYouTubeVideoId(currentTrack);
  const isYouTubeEmbed = activeSource === 'youtube' && !!youtubeVideoId;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const ytPlayerRef = useRef<YTPlayerInstance | null>(null);
  const isDraggingRef = useRef(false);
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  const trackDurationMs = currentTrack?.durationMs ?? 0;
  const durationMs = playbackDurationMs > 0 ? playbackDurationMs : trackDurationMs;

  // Reset position and source when track changes
  const [prevTrackId, setPrevTrackId] = useState(currentTrack?.id);
  if (prevTrackId !== currentTrack?.id) {
    setPrevTrackId(currentTrack?.id);
    setPlaybackPositionMs(0);
    setPlaybackDurationMs(0);
    if (currentTrack) {
      setActiveSource(hasYt ? 'youtube' : hasSpot ? 'spotify' : activeSource);
      if (embedUrl) setExpanded(true);
    }
  }

  // Track window width for responsive behavior
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-close mobile overlay when resizing to desktop
  const [prevWindowWidth, setPrevWindowWidth] = useState(windowWidth);
  if (prevWindowWidth !== windowWidth) {
    setPrevWindowWidth(windowWidth);
    if (windowWidth >= 768 && expanded) {
      setExpanded(false);
    }
  }

  // Load YouTube IFrame API and create player when consent is granted
  useEffect(() => {
    if (!youtubeVideoId || consentStatus !== 'granted' || typeof window === 'undefined') return;

    const createPlayer = () => {
      const YT = window.YT;
      if (!YT?.Player) return;
      const container = document.getElementById(YT_PLAYER_CONTAINER_ID);
      if (!container || ytPlayerRef.current) return;

      new YT.Player(YT_PLAYER_CONTAINER_ID, {
        height: '100%',
        width: '100%',
        playerVars: { autoplay: 1, enablejsapi: 1 },
        events: {
          onReady: (e: { target: YTPlayerInstance }) => {
            ytPlayerRef.current = e.target;
            if (youtubeVideoId) e.target.loadVideoById(youtubeVideoId);
            setYtPlayerReady(true);
          },
          onStateChange: (e: { data: number }) => {
            if (e.data === window.YT!.PlayerState.ENDED) next();
          },
        },
      });
    };

    if (window.YT?.Player) {
      createPlayer();
    } else {
      window.onYouTubeIframeAPIReady = createPlayer;
      if (!document.getElementById('yt-iframe-api-script')) {
        const script = document.createElement('script');
        script.id = 'yt-iframe-api-script';
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
      }
    }

    return () => {
      setYtPlayerReady(false);
      if (ytPlayerRef.current?.destroy) {
        try {
          ytPlayerRef.current.destroy();
        } catch {
          // ignore
        }
        ytPlayerRef.current = null;
      }
    };
  }, [youtubeVideoId, consentStatus, next]);

  // Pause YouTube when switching away from YouTube source
  useEffect(() => {
    if (activeSource !== 'youtube' && ytPlayerRef.current?.pauseVideo) {
      ytPlayerRef.current.pauseVideo();
    }
  }, [activeSource]);

  // When YouTube video ID changes and player exists, load the new video then sync play state
  useEffect(() => {
    if (!youtubeVideoId || !ytPlayerRef.current?.loadVideoById) return;
    ytPlayerRef.current.loadVideoById(youtubeVideoId);
    const player = ytPlayerRef.current;
    const shouldPlay = isPlayingRef.current;
    const sync = () => {
      if (shouldPlay) player.playVideo?.();
      else player.pauseVideo?.();
    };
    sync();
    const t = setTimeout(sync, 300);
    return () => clearTimeout(t);
  }, [youtubeVideoId]);

  // Sync play/pause with YouTube player only when player is ready (avoids lag/wrong state)
  useEffect(() => {
    if (!isYouTubeEmbed || !ytPlayerReady || !ytPlayerRef.current) return;
    if (isPlaying) ytPlayerRef.current.playVideo?.();
    else ytPlayerRef.current.pauseVideo?.();
  }, [isPlaying, isYouTubeEmbed, ytPlayerReady]);

  // Poll playback position when playing (YouTube only); skip updates while user is dragging
  useEffect(() => {
    if (!isYouTubeEmbed || !isPlaying) return;
    const tick = () => {
      if (isDraggingRef.current) return;
      const player = ytPlayerRef.current;
      if (!player?.getCurrentTime || typeof player.getCurrentTime !== 'function') return;
      const sec = player.getCurrentTime();
      const dur = player.getDuration?.();
      setPlaybackPositionMs(sec * 1000);
      if (typeof dur === 'number' && dur > 0) setPlaybackDurationMs(dur * 1000);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [isYouTubeEmbed, isPlaying]);

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

  const progressPercent = durationMs > 0 ? Math.min(100, (playbackPositionMs / durationMs) * 100) : 0;
  const durationSec = durationMs / 1000;

  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const handleSeek = (clientX: number) => {
    if (!isYouTubeEmbed || durationMs <= 0 || !progressBarRef.current || !ytPlayerRef.current?.seekTo) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const sec = fraction * durationSec;
    setPlaybackPositionMs(sec * 1000);
    ytPlayerRef.current.seekTo(sec, true);
  };

  const jumpLabel = `${JUMP_SECONDS} s`;
  const handleJumpBack = () => {
    if (!isYouTubeEmbed || !ytPlayerRef.current?.getCurrentTime || !ytPlayerRef.current?.seekTo) return;
    const current = ytPlayerRef.current.getCurrentTime();
    const nextSec = Math.max(0, current - JUMP_SECONDS);
    ytPlayerRef.current.seekTo(nextSec, true);
    setPlaybackPositionMs(nextSec * 1000);
  };
  const handleJumpForward = () => {
    if (!isYouTubeEmbed || !ytPlayerRef.current?.getCurrentTime || !ytPlayerRef.current?.seekTo) return;
    const current = ytPlayerRef.current.getCurrentTime();
    const duration = durationSec || (ytPlayerRef.current.getDuration?.() ?? 0);
    const nextSec = Math.min(duration, current + JUMP_SECONDS);
    ytPlayerRef.current.seekTo(nextSec, true);
    setPlaybackPositionMs(nextSec * 1000);
  };
  const isSpotifyActive = activeSource === 'spotify';
  const fullMode = expanded;
  const controlsDisabled = isSpotifyActive; // Spotify embed doesn't expose playback API

  // Match Vue: only render player when there is a current track
  if (!currentTrack) return null;

  // Video embed positioning based on screen size and expanded state
  const isMobile = windowWidth < 768;
  const getEmbedStyle = (): React.CSSProperties => {
    if (isMobile && expanded) {
      // Mobile expanded: centered in overlay
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
      // Desktop: fixed bottom-left
      return {
        position: 'fixed',
        bottom: '112px',
        left: '16px',
        width: isYouTubeEmbed ? '400px' : '320px',
        height: isYouTubeEmbed ? '225px' : '82px',
        zIndex: 120,
      };
    } else {
      // Mobile collapsed: small bottom-right
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
      {/* Embed: YouTube IFrame API when YouTube; Spotify iframe when Spotify */}
      {embedUrl && (isYouTubeEmbed || !isMobile || expanded) && (
        <div
          style={getEmbedStyle()}
          className={`overflow-hidden rounded-lg border border-[rgb(var(--color-border))] bg-black shadow-xl transition-all duration-300 ease-in-out ${
            isYouTubeEmbed && !isPlaying && !expanded
              ? 'opacity-0 pointer-events-none'
              : 'opacity-100 pointer-events-auto'
          }`}
          aria-hidden={isYouTubeEmbed && !isPlaying && !expanded}
        >
          {/* Wrapper div React controls – the YT IFrame API replaces the inner div so we hide/show via the wrapper */}
          <div
            className="h-full w-full"
            style={{ display: isYouTubeEmbed ? 'block' : 'none' }}
          >
            <div
              id={YT_PLAYER_CONTAINER_ID}
              className="h-full w-full"
            />
          </div>
          {!isYouTubeEmbed && embedUrl && (
            <iframe
              ref={iframeRef}
              title="Uppspelning"
              src={embedUrl}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      )}

      {/* Mobile full-screen overlay - shown when expanded on mobile */}
      {expanded && isMobile && (
        <div className="fixed inset-0 bg-[rgb(var(--color-bg))] z-[100] flex flex-col overflow-y-auto transition-transform duration-300 ease-in-out">
          {/* Header bar */}
          <div className="flex items-center justify-between px-6 pt-12 pb-4 shrink-0">
            <button
              onClick={() => setExpanded(false)}
              aria-label="Stäng spelare"
              className="text-[rgb(var(--color-text))] hover:text-[rgb(var(--color-accent))] transition-colors"
            >
              <ChevronDownIcon className="w-8 h-8" />
            </button>
            {(hasYt || hasSpot) && (
              <div className="flex gap-2 bg-[rgb(var(--color-border))]/30 rounded-lg p-1">
                {hasYt && (
                  <button
                    type="button"
                    onClick={() => setActiveSource('youtube')}
                    className={`p-2 rounded transition-all ${
                      activeSource === 'youtube'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]'
                    }`}
                    aria-label="YouTube som källa"
                  >
                    <YouTubeIcon className="w-5 h-5" />
                  </button>
                )}
                {hasSpot && (
                  <button
                    type="button"
                    onClick={() => setActiveSource('spotify')}
                    className={`p-2 rounded transition-all ${
                      activeSource === 'spotify'
                        ? 'bg-green-50 text-green-600'
                        : 'bg-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]'
                    }`}
                    aria-label="Spotify som källa"
                  >
                    <SpotifyIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
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
              <div
                ref={progressBarRef}
                className={`relative h-2 w-full rounded-full bg-[rgb(var(--color-border))] ${
                  isYouTubeEmbed && durationMs > 0 && !controlsDisabled ? 'cursor-pointer' : ''
                }`}
                onClick={(e) => {
                  if (controlsDisabled) return;
                  e.stopPropagation();
                  handleSeek(e.clientX);
                }}
                onPointerDown={(e) => {
                  if (controlsDisabled || !isYouTubeEmbed || durationMs <= 0) return;
                  e.preventDefault();
                  isDraggingRef.current = true;
                  const target = e.currentTarget;
                  const pointerId = e.pointerId;
                  target.setPointerCapture(pointerId);
                  handleSeek(e.clientX);
                  const onMove = (moveEvent: PointerEvent) => handleSeek(moveEvent.clientX);
                  const onUp = () => {
                    isDraggingRef.current = false;
                    target.releasePointerCapture(pointerId);
                    document.removeEventListener('pointermove', onMove);
                    document.removeEventListener('pointerup', onUp);
                  };
                  document.addEventListener('pointermove', onMove);
                  document.addEventListener('pointerup', onUp);
                }}
                role="slider"
                aria-label="Spola i låten"
                aria-valuemin={0}
                aria-valuemax={durationMs}
                aria-valuenow={Math.round(playbackPositionMs)}
                aria-valuetext={`${formatDurationMs(Math.round(playbackPositionMs))} av ${durationMs > 0 ? formatDurationMs(durationMs) : '0:00'}`}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[rgb(var(--color-accent))] pointer-events-none"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Time display */}
            <div className="flex justify-between text-xs mb-8 text-[rgb(var(--color-text-muted))] font-mono">
              <span>{formatDurationMs(Math.round(playbackPositionMs))}</span>
              <span>{durationMs > 0 ? formatDurationMs(durationMs) : '0:00'}</span>
            </div>

            {/* Controls - all visible */}
            <div className="flex justify-center items-center gap-6 mb-8">
              <IconButton
                aria-label={isShuffled ? 'Shuffle påslaget' : 'Shuffle avslaget'}
                aria-pressed={isShuffled}
                onClick={() => setIsShuffled((s) => !s)}
                className={`w-10 h-10 flex items-center justify-center transition-colors ${
                  isShuffled
                    ? 'text-[rgb(var(--color-accent))]'
                    : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]'
                }`}
              >
                <ShuffleIcon className="w-6 h-6" />
              </IconButton>

              <button
                type="button"
                onClick={handleJumpBack}
                disabled={controlsDisabled}
                aria-label={`Spola tillbaka ${jumpLabel}`}
                className={`group relative w-12 h-12 flex items-center justify-center transition-colors ${
                  controlsDisabled
                    ? 'text-[rgb(var(--color-border))] cursor-not-allowed'
                    : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]'
                }`}
              >
                <JumpBackIcon className="w-8 h-8" />
                <span
                  className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-px text-[10px] font-bold select-none pointer-events-none ${
                    controlsDisabled
                      ? 'text-[rgb(var(--color-border))]'
                      : 'text-[rgb(var(--color-text-muted))] group-hover:text-[rgb(var(--color-accent))]'
                  }`}
                  aria-hidden
                >
                  {JUMP_SECONDS}
                </span>
              </button>

              <button
                type="button"
                onClick={prev}
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
                onClick={togglePlayPause}
                disabled={controlsDisabled}
                aria-label={
                  controlsDisabled
                    ? 'Använd Spotify-spelaren för att kontrollera uppspelning'
                    : isPlaying
                      ? 'Pausa'
                      : 'Spela'
                }
                className={`rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 w-20 h-20 text-white ${
                  controlsDisabled
                    ? 'bg-[rgb(var(--color-border))] cursor-not-allowed opacity-50'
                    : 'bg-[rgb(var(--color-accent))] hover:opacity-90'
                }`}
              >
                {isPlaying ? (
                  <PauseIcon className="w-10 h-10" aria-hidden />
                ) : (
                  <PlayIcon className="w-10 h-10 ml-0.5" aria-hidden />
                )}
              </button>

              <button
                type="button"
                onClick={next}
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
                onClick={handleJumpForward}
                disabled={controlsDisabled}
                aria-label={`Spola framåt ${jumpLabel}`}
                className={`group relative w-12 h-12 flex items-center justify-center transition-colors ${
                  controlsDisabled
                    ? 'text-[rgb(var(--color-border))] cursor-not-allowed'
                    : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]'
                }`}
              >
                <JumpForwardIcon className="w-8 h-8" />
                <span
                  className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-px text-[10px] font-bold select-none pointer-events-none ${
                    controlsDisabled
                      ? 'text-[rgb(var(--color-border))]'
                      : 'text-[rgb(var(--color-text-muted))] group-hover:text-[rgb(var(--color-accent))]'
                  }`}
                  aria-hidden
                >
                  {JUMP_SECONDS}
                </span>
              </button>

              <button
                type="button"
                aria-label={
                  repeatMode === 'one'
                    ? 'Repetera en låt'
                    : repeatMode === 'all'
                      ? 'Repetera alla'
                      : 'Repetera av'
                }
                aria-pressed={repeatMode !== 'none'}
                onClick={() => setRepeatMode((m) => (m === 'none' ? 'all' : m === 'all' ? 'one' : 'none'))}
                className={`relative w-10 h-10 flex items-center justify-center transition-colors ${
                  repeatMode !== 'none'
                    ? 'text-[rgb(var(--color-accent))]'
                    : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]'
                }`}
              >
                <RepeatIcon className="w-6 h-6" />
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

            {/* Queue if non-empty */}
            {queue.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-[rgb(var(--color-text-muted))]">
                    Kö ({queue.length})
                  </h3>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearQueue();
                    }}
                    className="text-xs text-[rgb(var(--color-accent))] hover:underline"
                  >
                    Rensa kö
                  </button>
                </div>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                  {queue.map((t, i) => (
                    <QueueItem
                      key={t.id ?? i}
                      track={t}
                      isCurrent={currentTrack?.id === t.id}
                      onPlay={() => playFromQueue(i)}
                      onRemove={() => removeFromQueue(i)}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <SmartNudge track={currentTrack} isPlaying={isPlaying} />

      {/* Fixed bottom bar: progress on top, then 3-column row (Vue PlayerDockedView) */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[120] flex flex-col border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-in-out ${
          expanded && isMobile ? 'translate-y-full' : 'translate-y-0'
        }`}
        aria-label="Global spelare"
      >
        {/* Progress bar on top - full width (Vue: progress-bar above h-20 row) */}
        <div
          className="hidden md:block w-full px-4 pt-2"
          onClick={(e) => e.stopPropagation()}
          role="group"
          aria-label="Uppspelningsposition"
        >
          <div
            ref={progressBarRef}
            className={`relative h-1.5 w-full rounded-full bg-[rgb(var(--color-border))] ${isYouTubeEmbed && durationMs > 0 && !controlsDisabled ? 'cursor-pointer' : ''}`}
            onClick={(e) => {
              if (controlsDisabled) return;
              e.stopPropagation();
              handleSeek(e.clientX);
            }}
            onPointerDown={(e) => {
              if (controlsDisabled || !isYouTubeEmbed || durationMs <= 0) return;
              e.preventDefault();
              isDraggingRef.current = true;
              const target = e.currentTarget;
              const pointerId = e.pointerId;
              target.setPointerCapture(pointerId);
              handleSeek(e.clientX);
              const onMove = (moveEvent: PointerEvent) => handleSeek(moveEvent.clientX);
              const onUp = () => {
                isDraggingRef.current = false;
                target.releasePointerCapture(pointerId);
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
              };
              document.addEventListener('pointermove', onMove);
              document.addEventListener('pointerup', onUp);
            }}
            role="slider"
            aria-label="Spola i låten"
            aria-valuemin={0}
            aria-valuemax={durationMs}
            aria-valuenow={Math.round(playbackPositionMs)}
            aria-valuetext={`${formatDurationMs(Math.round(playbackPositionMs))} av ${durationMs > 0 ? formatDurationMs(durationMs) : '0:00'}`}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[rgb(var(--color-accent))] pointer-events-none"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        {/* Mobile: thin progress strip (Vue md:hidden h-1) */}
        <div className="md:hidden w-full h-1 bg-[rgb(var(--color-border))] relative">
          <div
            className="h-full bg-[rgb(var(--color-accent))] pointer-events-none"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Main row: left (art + title) | center (controls) | right (source) - Vue h-20 */}
        <div
          className={`flex h-20 items-center justify-between px-4 py-3 ${isMobile ? 'cursor-pointer' : ''}`}
          onClick={(e) => isMobile && !(e.target as HTMLElement).closest('button') && currentTrack && setExpanded((e) => !e)}
          onKeyDown={(e) => {
            if (isMobile && currentTrack && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setExpanded((e) => !e);
            }
          }}
          role={isMobile ? "button" : undefined}
          tabIndex={isMobile && currentTrack ? 0 : -1}
          aria-expanded={isMobile ? expanded : undefined}
          aria-label={isMobile && currentTrack ? 'Öppna spelaren' : undefined}
        >
          {/* Left: art + title + time (Vue w-2/3 md:w-1/3) */}
          <div className="flex min-w-0 w-2/3 md:w-1/3 items-center gap-3">
            <div className="w-12 h-12 shrink-0 rounded bg-[rgb(var(--color-border))]/50 flex items-center justify-center text-xl">
              🎵
            </div>
            <div className="min-w-0">
              <div className="font-bold truncate text-sm md:text-base text-[rgb(var(--color-text))]">
                {currentTrack?.title ?? 'Välj en låt att spela'}
              </div>
              <div className="text-[10px] text-[rgb(var(--color-text-muted))] font-mono md:hidden">
                {formatDurationMs(Math.round(playbackPositionMs))} / {durationMs > 0 ? formatDurationMs(durationMs) : '0:00'}
              </div>
              {activeSource === 'youtube' && (
                <div className="hidden md:block text-[10px] text-[rgb(var(--color-text-muted))] font-mono">
                  {formatDurationMs(Math.round(playbackPositionMs))} / {durationMs > 0 ? formatDurationMs(durationMs) : '0:00'}
                </div>
              )}
            </div>
          </div>

          {/* Center: controls (Vue order: shuffle, jump back, prev, play, next, jump forward, repeat, queue) */}
          <div
            className="flex flex-col items-center justify-end md:justify-center w-1/3 md:w-1/3 gap-1"
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
            {/* Shuffle - hidden on small, visible md+ (Vue fullMode ? flex : hidden md:flex) */}
            <IconButton
              aria-label={isShuffled ? 'Shuffle påslaget, klicka för att stänga av' : 'Shuffle avslaget, klicka för att slå på'}
              aria-pressed={isShuffled}
              onClick={() => setIsShuffled((s) => !s)}
              className={`relative w-8 h-8 items-center justify-center transition-colors ${fullMode ? 'flex' : 'hidden md:flex'} ${isShuffled ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]'}`}
            >
              <ShuffleIcon className="w-5 h-5" />
            </IconButton>
            {/* Jump Back */}
            <button
              type="button"
              onClick={handleJumpBack}
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
                {JUMP_SECONDS}
              </span>
            </button>
            {/* Previous */}
            <button
              type="button"
              onClick={prev}
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
            {/* Main Play - consistent color, disabled when Spotify active */}
            <button
              type="button"
              onClick={togglePlayPause}
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
            {/* Next */}
            <button
              type="button"
              onClick={next}
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
            {/* Jump Forward */}
            <button
              type="button"
              onClick={handleJumpForward}
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
                {JUMP_SECONDS}
              </span>
            </button>
            {/* Repeat */}
            <button
              type="button"
              aria-label={
                repeatMode === 'one'
                  ? 'Repetera en låt, klicka för att stoppa efter spår'
                  : repeatMode === 'all'
                    ? 'Repetera alla, klicka för att repetera en'
                    : 'Repetera av, klicka för att repetera alla'
              }
              aria-pressed={repeatMode !== 'none'}
              onClick={() => setRepeatMode((m) => (m === 'none' ? 'all' : m === 'all' ? 'one' : 'none'))}
              title="Repeat"
              className={`relative w-8 h-8 flex items-center justify-center transition-colors ${fullMode ? 'flex' : 'hidden md:flex'} ${repeatMode !== 'none' ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]'}`}
            >
              <RepeatIcon className="w-5 h-5" />
              {repeatMode === 'one' && (
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-extrabold bg-white px-0.5 leading-none shadow-sm rounded-sm text-[rgb(var(--color-accent))]" aria-hidden>
                  1
                </span>
              )}
            </button>
            {/* Queue */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
              aria-label="Visa kö"
              title="Visa kö"
              className={`relative w-8 h-8 flex items-center justify-center transition-colors ${fullMode ? 'flex' : 'hidden md:flex'} ${queue.length > 0 ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]'}`}
            >
              <QueueListIcon className="w-5 h-5" />
            </button>
            </div>
          </div>

          {/* Right: source switcher (Vue hidden md:flex w-1/3) */}
          <div className="hidden md:flex w-1/3 justify-end items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {(hasYt || hasSpot) && (
              <>
                <span className="text-[10px] text-[rgb(var(--color-text-muted))] font-bold uppercase mr-2">Källa</span>
                {hasYt && (
                  <button
                    type="button"
                    onClick={() => setActiveSource('youtube')}
                    className={`p-1.5 rounded border transition-all ${activeSource === 'youtube' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-transparent border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]'}`}
                    aria-label="YouTube som källa"
                  >
                    <YouTubeIcon className="w-4 h-4" />
                  </button>
                )}
                {hasSpot && (
                  <button
                    type="button"
                    onClick={() => setActiveSource('spotify')}
                    className={`p-1.5 rounded border transition-all ${activeSource === 'spotify' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-transparent border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]'}`}
                    aria-label="Spotify som källa"
                  >
                    <SpotifyIcon className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Expanded: queue (Vue QueueManager in modal; we keep inline) */}
        {expanded && currentTrack && (
          <div className="border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-4 py-3">
            {queue.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-[rgb(var(--color-text-muted))]">Kö ({queue.length})</h3>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); clearQueue(); }}
                    className="text-xs text-[rgb(var(--color-accent))] hover:underline"
                  >
                    Rensa kö
                  </button>
                </div>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                  {queue.map((t, i) => (
                    <QueueItem
                      key={t.id ?? i}
                      track={t}
                      isCurrent={currentTrack?.id === t.id}
                      onPlay={() => playFromQueue(i)}
                      onRemove={() => removeFromQueue(i)}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function QueueItem({
  track,
  isCurrent,
  onPlay,
  onRemove,
}: {
  track: TrackListDto;
  isCurrent: boolean;
  onPlay: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded-[var(--radius)] py-1.5 px-2 hover:bg-[rgb(var(--color-border))]/30">
      <button
        type="button"
        onClick={onPlay}
        className="min-w-0 flex-1 text-left text-sm text-[rgb(var(--color-text))] hover:underline"
      >
        <span className={isCurrent ? 'font-medium' : ''}>
          {track.title ?? 'Okänd låt'}
        </span>
        {' · '}
        <span className="text-[rgb(var(--color-text-muted))]">
          {track.artistName ?? 'Okänd artist'}
        </span>
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="shrink-0 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
        aria-label="Ta bort från kö"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </li>
  );
}
