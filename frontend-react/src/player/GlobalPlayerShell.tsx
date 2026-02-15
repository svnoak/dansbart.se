import { useState, useEffect, useRef } from 'react';
import { useConsent } from '@/consent/ConsentContext';
import { usePlayer } from '@/player/PlayerContext';
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
} from '@/icons';
import type { TrackListDto } from '@/api/models/trackListDto';
import { formatDurationMs } from '@/utils/formatDuration';

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
  const hasYt = hasYouTube(currentTrack);
  const hasSpot = hasSpotify(currentTrack);
  const embedUrl = getEmbedUrlForSource(currentTrack, activeSource);
  const youtubeVideoId = getYouTubeVideoId(currentTrack);
  const isYouTubeEmbed = activeSource === 'youtube' && !!youtubeVideoId;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const ytPlayerRef = useRef<YTPlayerInstance | null>(null);
  const isDraggingRef = useRef(false);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const trackDurationMs = currentTrack?.durationMs ?? 0;
  const durationMs = playbackDurationMs > 0 ? playbackDurationMs : trackDurationMs;

  // Reset position when track changes
  useEffect(() => {
    setPlaybackPositionMs(0);
    setPlaybackDurationMs(0);
  }, [currentTrack?.id]);

  // Set active source when track changes: prefer YouTube if available, else Spotify (match Vue)
  useEffect(() => {
    if (!currentTrack) return;
    setActiveSource((prev) => {
      const next = hasYt ? 'youtube' : hasSpot ? 'spotify' : prev;
      return next;
    });
  }, [currentTrack?.id, hasYt, hasSpot]);

  // Auto-expand when playing a track that has an embed so Spotify/YouTube is visible
  useEffect(() => {
    if (currentTrack && embedUrl) setExpanded(true);
  }, [currentTrack?.id, embedUrl]);

  // Load YouTube IFrame API and create player only when consent is granted and source is YouTube
  useEffect(() => {
    if (activeSource !== 'youtube' || !youtubeVideoId || consentStatus !== 'granted' || typeof window === 'undefined') return;

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
  }, [youtubeVideoId, consentStatus, next, activeSource]);

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

  // Match Vue: only render player when there is a current track
  if (!currentTrack) return null;

  return (
    <>
      {/* Embed: YouTube IFrame API when YouTube; Spotify iframe when Spotify. Match Vue positioning. */}
      {embedUrl && (isYouTubeEmbed || expanded) && (
        <div
          className={`fixed bottom-24 right-4 z-30 w-80 overflow-hidden rounded-lg border border-[rgb(var(--color-border))] bg-black shadow-xl transition-all duration-300 ease-in-out ${
            isYouTubeEmbed
              ? 'h-48 ' + (isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')
              : 'h-[82px]'
          }`}
          aria-hidden={isYouTubeEmbed && !isPlaying}
        >
          {isYouTubeEmbed ? (
            <div id={YT_PLAYER_CONTAINER_ID} className="h-full w-full" />
          ) : (
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

      {/* Fixed bottom bar: progress on top, then 3-column row (Vue PlayerDockedView) */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[120] flex flex-col border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]"
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
            className={`relative h-1.5 w-full rounded-full bg-[rgb(var(--color-border))] ${isYouTubeEmbed && durationMs > 0 ? 'cursor-pointer' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              handleSeek(e.clientX);
            }}
            onPointerDown={(e) => {
              if (!isYouTubeEmbed || durationMs <= 0) return;
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
          className="flex h-20 items-center justify-between px-4 py-3 cursor-pointer md:cursor-default"
          onClick={(e) => !(e.target as HTMLElement).closest('button') && currentTrack && setExpanded((e) => !e)}
          onKeyDown={(e) => {
            if (currentTrack && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setExpanded((e) => !e);
            }
          }}
          role="button"
          tabIndex={currentTrack ? 0 : -1}
          aria-expanded={expanded}
          aria-label={currentTrack ? 'Öppna spelaren' : undefined}
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
            className="flex items-center justify-end md:justify-center w-1/3 md:w-1/3 gap-2 md:gap-4"
            onClick={(e) => e.stopPropagation()}
            role="group"
            aria-label="Spelarkontroller"
          >
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
              aria-label={`Spola tillbaka ${jumpLabel}`}
              title={`Rewind ${jumpLabel}`}
              className={`group relative w-10 h-10 flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))] transition-colors ${fullMode ? 'flex' : 'hidden md:flex'}`}
            >
              <JumpBackIcon className="w-6 h-6" />
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-px text-[8px] font-bold select-none pointer-events-none text-[rgb(var(--color-text-muted))] group-hover:text-[rgb(var(--color-accent))]" aria-hidden>
                {JUMP_SECONDS}
              </span>
            </button>
            {/* Previous */}
            <button
              type="button"
              onClick={prev}
              aria-label="Föregående spår"
              title="Previous Track"
              className="text-[rgb(var(--color-text))] hover:text-[rgb(var(--color-accent))] transition-colors"
            >
              <SkipPreviousIcon className="w-6 h-6" />
            </button>
            {/* Main Play - Vue: rounded-full shadow-lg active:scale-95, green when Spotify */}
            <button
              type="button"
              onClick={togglePlayPause}
              aria-label={isPlaying ? 'Pausa' : 'Spela'}
              title={isPlaying ? 'Pause' : 'Play'}
              className={`rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 shrink-0 aspect-square ${fullMode ? 'w-16 h-16' : 'w-12 h-12'} ${isSpotifyActive ? 'bg-[#1DB954] hover:bg-[#1ed760]' : 'bg-[rgb(var(--color-accent))] hover:opacity-90'}`}
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
              aria-label="Nästa spår"
              title="Next Track"
              className="text-[rgb(var(--color-text))] hover:text-[rgb(var(--color-accent))] transition-colors"
            >
              <SkipNextIcon className="w-6 h-6" />
            </button>
            {/* Jump Forward */}
            <button
              type="button"
              onClick={handleJumpForward}
              aria-label={`Spola framåt ${jumpLabel}`}
              title={`Forward ${jumpLabel}`}
              className={`group relative w-10 h-10 flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))] transition-colors ${fullMode ? 'flex' : 'hidden md:flex'}`}
            >
              <JumpForwardIcon className="w-6 h-6" />
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-px text-[8px] font-bold select-none pointer-events-none text-[rgb(var(--color-text-muted))] group-hover:text-[rgb(var(--color-accent))]" aria-hidden>
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
