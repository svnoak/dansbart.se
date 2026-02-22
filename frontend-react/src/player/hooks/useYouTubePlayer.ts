import { useState, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { PlaybackSource } from '@/player/embedUrl';

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
            if (e.data === window.YT!.PlayerState.ENDED) onEnded();
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
