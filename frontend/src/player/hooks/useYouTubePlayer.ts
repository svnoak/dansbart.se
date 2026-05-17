import { useState, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { PlaybackSource } from '@/player/embedUrl';
import { pushPlayerEvent } from '@/player/playerObservability';

const YT_READY_TIMEOUT_MS = 15_000;
const YT_PLAYER_READY_TIMEOUT_MS = 10_000;

const YT_ERROR_LABELS: Record<number, string> = {
  2: 'invalid_parameter',
  5: 'html5_error',
  100: 'video_not_found',
  101: 'embedding_not_allowed',
  150: 'embedding_not_allowed',
};

export const YT_PLAYER_CONTAINER_ID = 'global-yt-player-container';

interface UseYouTubePlayerOptions {
  youtubeVideoId: string | null | undefined;
  consentStatus: string | null;
  isPlaying: boolean;
  activeSource: PlaybackSource;
  onEnded: () => void;
}

interface UseYouTubePlayerResult {
  ytPlayerRef: MutableRefObject<YTPlayerInstance | null>;
  ytPlayerReady: boolean;
}

export function useYouTubePlayer({
  youtubeVideoId,
  consentStatus,
  isPlaying,
  activeSource,
  onEnded,
}: UseYouTubePlayerOptions): UseYouTubePlayerResult {
  const ytPlayerRef = useRef<YTPlayerInstance | null>(null);
  const [ytPlayerReady, setYtPlayerReady] = useState(false);
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const isYouTubeEmbed = activeSource === 'youtube' && !!youtubeVideoId;

  // Load YouTube IFrame API and create player when consent is granted
  useEffect(() => {
    if (!youtubeVideoId || consentStatus !== 'granted' || typeof window === 'undefined') return;

    let playerReadyTimer: ReturnType<typeof setTimeout> | null = null;

    const createPlayer = () => {
      const YT = window.YT;
      if (!YT?.Player) return;
      const container = document.getElementById(YT_PLAYER_CONTAINER_ID);
      if (!container || ytPlayerRef.current) return;

      playerReadyTimer = setTimeout(() => {
        pushPlayerEvent('youtube_player_init_timeout', { videoId: youtubeVideoId ?? '' });
      }, YT_PLAYER_READY_TIMEOUT_MS);

      new YT.Player(YT_PLAYER_CONTAINER_ID, {
        height: '100%',
        width: '100%',
        playerVars: { autoplay: 1, enablejsapi: 1 },
        events: {
          onReady: (e: { target: YTPlayerInstance }) => {
            if (playerReadyTimer) clearTimeout(playerReadyTimer);
            ytPlayerRef.current = e.target;
            if (youtubeVideoId) e.target.loadVideoById(youtubeVideoId);
            setYtPlayerReady(true);
          },
          onStateChange: (e: { data: number }) => {
            if (e.data === window.YT!.PlayerState.ENDED) onEnded();
          },
          onError: (e: { data: number }) => {
            pushPlayerEvent('youtube_player_error', {
              videoId: youtubeVideoId ?? '',
              errorCode: String(e.data),
              errorLabel: YT_ERROR_LABELS[e.data] ?? 'unknown',
            });
          },
        },
      });
    };

    if (window.YT?.Player) {
      createPlayer();
    } else {
      const apiReadyTimer = setTimeout(() => {
        pushPlayerEvent('youtube_api_load_timeout', { videoId: youtubeVideoId ?? '' });
      }, YT_READY_TIMEOUT_MS);

      window.onYouTubeIframeAPIReady = () => {
        clearTimeout(apiReadyTimer);
        createPlayer();
      };

      if (!document.getElementById('yt-iframe-api-script')) {
        const script = document.createElement('script');
        script.id = 'yt-iframe-api-script';
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
      }
    }

    return () => {
      if (playerReadyTimer) clearTimeout(playerReadyTimer);
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
  }, [youtubeVideoId, consentStatus, onEnded]);

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

  return { ytPlayerRef, ytPlayerReady };
}
