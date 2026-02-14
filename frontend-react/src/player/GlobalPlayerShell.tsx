import { useState, useEffect, useRef } from 'react';
import { useConsent } from '@/consent/ConsentContext';
import { usePlayer } from '@/player/PlayerContext';
import { getEmbedUrl, getYouTubeVideoId } from '@/player/embedUrl';
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
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0);
  const [playbackDurationMs, setPlaybackDurationMs] = useState(0);
  const [ytPlayerReady, setYtPlayerReady] = useState(false);
  const embedUrl = getEmbedUrl(currentTrack);
  const youtubeVideoId = getYouTubeVideoId(currentTrack);
  const isYouTubeEmbed = !!youtubeVideoId;
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

  // Auto-expand when playing a track that has an embed so Spotify/YouTube is visible
  useEffect(() => {
    if (currentTrack && embedUrl) setExpanded(true);
  }, [currentTrack?.id, embedUrl]);

  // Load YouTube IFrame API and create player only when consent is granted
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

  return (
    <>
      {/* Larger embed: YouTube uses IFrame API (container always mounted when YouTube track so we can poll progress); Spotify only when expanded. Embed visible only while playing so it hides on pause. */}
      {currentTrack && embedUrl && (isYouTubeEmbed || expanded) && (
        <div
          className={`fixed bottom-24 right-4 z-30 w-80 h-48 overflow-hidden rounded-lg border border-[rgb(var(--color-border))] bg-black shadow-xl transition-all duration-300 ease-in-out ${
            isYouTubeEmbed ? (isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none') : ''
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

      <div
        className="sticky bottom-0 z-20 mx-2 mb-2 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] shadow-lg"
        aria-label="Global spelare"
      >
        <div className="px-4 py-3">
        {/* Progress bar on top (like Vue frontend), room for sections switch later */}
        <div
          className="mb-3 flex w-full items-center gap-2"
          onClick={(e) => e.stopPropagation()}
          role="group"
          aria-label="Uppspelningsposition"
        >
          <span className="text-xs text-[rgb(var(--color-text-muted))]">
            {formatDurationMs(Math.round(playbackPositionMs))}
          </span>
          <div
            ref={progressBarRef}
            className={`relative h-1 flex-1 rounded-full bg-[rgb(var(--color-border))] ${isYouTubeEmbed && durationMs > 0 ? 'cursor-pointer' : ''}`}
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
              className="h-full rounded-full bg-[rgb(var(--color-accent))] pointer-events-none"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs text-[rgb(var(--color-text-muted))]">
            {durationMs > 0 ? formatDurationMs(durationMs) : '0:00'}
          </span>
        </div>
        <div
          className="flex flex-wrap items-center gap-4"
          onClick={() => currentTrack && setExpanded((e) => !e)}
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
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--color-border))]/50 text-[rgb(var(--color-text-muted))]">
            {currentTrack ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
                <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
              </svg>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-[rgb(var(--color-text))]">
              {currentTrack?.title ?? 'Välj en låt att spela'}
            </p>
            <p className="truncate text-sm text-[rgb(var(--color-text-muted))]">
              {currentTrack?.artistName ?? ''}
            </p>
          </div>

          <div
            className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto sm:flex-1"
            onClick={(e) => e.stopPropagation()}
            role="group"
            aria-label="Spelarkontroller"
          >
            <IconButton
              aria-label={isShuffled ? 'Shuffle påslaget, klicka för att stänga av' : 'Shuffle avslaget, klicka för att slå på'}
              aria-pressed={isShuffled}
              onClick={() => setIsShuffled((s) => !s)}
              className={`h-9 w-9 rounded-lg ${isShuffled ? 'bg-[rgb(var(--color-accent))]/25 text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-accent))]/35' : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]'}`}
            >
              <ShuffleIcon className="h-5 w-5" />
            </IconButton>
            <IconButton
              aria-label="Spola tillbaka 10 s"
              className="relative h-9 w-9 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]"
              onClick={() => {
                if (!isYouTubeEmbed || !ytPlayerRef.current?.getCurrentTime || !ytPlayerRef.current?.seekTo) return;
                const current = ytPlayerRef.current.getCurrentTime();
                const nextSec = Math.max(0, current - 10);
                ytPlayerRef.current.seekTo(nextSec, true);
                setPlaybackPositionMs(nextSec * 1000);
              }}
            >
              <JumpBackIcon className="h-6 w-6" />
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-px text-[8px] font-bold select-none pointer-events-none text-[rgb(var(--color-text-muted))]">
                10
              </span>
            </IconButton>
            <IconButton aria-label="Föregående spår" onClick={prev} className="h-9 w-9">
              <SkipPreviousIcon className="h-6 w-6" />
            </IconButton>
            <button
              type="button"
              onClick={togglePlayPause}
              aria-label={isPlaying ? 'Pausa' : 'Spela'}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-accent))] text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))] focus-visible:ring-offset-2"
            >
              {isPlaying ? (
                <PauseIcon className="h-6 w-6" aria-hidden />
              ) : (
                <PlayIcon className="h-6 w-6 ml-0.5" aria-hidden />
              )}
            </button>
            <IconButton aria-label="Nästa spår" onClick={next} className="h-9 w-9">
              <SkipNextIcon className="h-6 w-6" />
            </IconButton>
            <IconButton
              aria-label="Spola framåt 10 s"
              className="relative h-9 w-9 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]"
              onClick={() => {
                if (!isYouTubeEmbed || !ytPlayerRef.current?.getCurrentTime || !ytPlayerRef.current?.seekTo) return;
                const current = ytPlayerRef.current.getCurrentTime();
                const duration = durationSec || (ytPlayerRef.current.getDuration?.() ?? 0);
                const nextSec = Math.min(duration, current + 10);
                ytPlayerRef.current.seekTo(nextSec, true);
                setPlaybackPositionMs(nextSec * 1000);
              }}
            >
              <JumpForwardIcon className="h-6 w-6" />
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-px text-[8px] font-bold select-none pointer-events-none text-[rgb(var(--color-text-muted))]">
                10
              </span>
            </IconButton>
            <IconButton
              aria-label={
                repeatMode === 'one'
                  ? 'Repetera en låt, klicka för att stoppa efter spår'
                  : repeatMode === 'all'
                    ? 'Repetera alla, klicka för att repetera en'
                    : 'Repetera av, klicka för att repetera alla'
              }
              aria-pressed={repeatMode !== 'none'}
              onClick={() =>
                setRepeatMode((m) => (m === 'none' ? 'all' : m === 'all' ? 'one' : 'none'))
              }
              className={`relative h-9 w-9 ${repeatMode !== 'none' ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]'}`}
            >
              <RepeatIcon className="h-5 w-5" />
              {repeatMode === 'one' && (
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-extrabold bg-white px-0.5 leading-none shadow-sm rounded-sm text-[rgb(var(--color-accent))]">
                  1
                </span>
              )}
            </IconButton>
            <IconButton
              aria-label="Visa kö"
              onClick={() => setExpanded(true)}
              className={`h-9 w-9 ${queue.length > 0 ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]'}`}
            >
              <QueueListIcon className="h-5 w-5" />
            </IconButton>
          </div>

          <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:flex-1" onClick={(e) => e.stopPropagation()}>
            {currentTrack?.playbackLinks?.some((l) => l.platform === 'SPOTIFY' || l.platform === 'spotify') && (
              <span className="text-[rgb(var(--color-text-muted))]" aria-hidden>
                <SpotifyIcon className="h-4 w-4" />
              </span>
            )}
            {currentTrack?.playbackLinks?.some((l) => l.platform === 'YOUTUBE' || l.platform === 'youtube') && (
              <span className="text-[rgb(var(--color-text-muted))]" aria-hidden>
                <YouTubeIcon className="h-4 w-4" />
              </span>
            )}
          </div>
        </div>
      </div>

      {expanded && currentTrack && (
        <div className="border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-4 py-3">
          {queue.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-[rgb(var(--color-text-muted))]">
                  Kö ({queue.length})
                </h3>
                <button
                  type="button"
                  onClick={() => clearQueue()}
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
