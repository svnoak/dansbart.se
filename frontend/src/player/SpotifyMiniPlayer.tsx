import { useEffect, useRef } from 'react';
import type { TrackListDto } from '@/api/models/trackListDto';
import { pushPlayerEvent, pushPlayerError } from '@/player/playerObservability';

const SPOTIFY_API_TIMEOUT_MS = 15_000;
const SPOTIFY_CONTROLLER_TIMEOUT_MS = 10_000;

interface SpotifyPlaybackUpdate {
  data: {
    isPaused?: boolean;
    position?: number;
    duration?: number;
    isBuffering?: boolean;
  };
}

interface SpotifyEmbedController {
  addListener(name: string, fn: (e: SpotifyPlaybackUpdate) => void): void;
  loadUri(uri: string): void;
  destroy(): void;
  resume(): void;
  pause(): void;
}

declare global {
  interface Window {
    SpotifyIframeApi?: {
      createController(
        element: HTMLElement,
        options: { uri: string; width?: string; height?: string },
        callback: (controller: SpotifyEmbedController) => void
      ): void;
    };
    onSpotifyIframeApiReady?: () => void;
  }
}

function getSpotifyTrackId(track: TrackListDto | null): string | null {
  if (!track?.playbackLinks?.length) return null;
  const link = track.playbackLinks.find(
    (l) => l.platform?.toLowerCase() === 'spotify'
  );
  if (!link?.deepLink) return null;
  const raw = link.deepLink.trim();

  // Bare 22-char ID (current backend format)
  if (/^[a-zA-Z0-9]{22}$/.test(raw)) return raw;

  // spotify:track:ID URI
  const uriMatch = raw.match(/^spotify:track:([a-zA-Z0-9]{22})$/);
  if (uriMatch) return uriMatch[1];

  // https://open.spotify.com/track/ID URL
  try {
    const u = new URL(raw);
    if (u.hostname.includes('spotify.com')) {
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'track' && parts[1]) return parts[1];
    }
  } catch {
    // ignore
  }

  return null;
}

export function SpotifyMiniPlayer({
  track,
  isPlaying,
}: {
  track: TrackListDto | null;
  isPlaying: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SpotifyEmbedController | null>(null);
  const trackId = getSpotifyTrackId(track);

  // Load Spotify IFrame API script once and create controller for current track
  useEffect(() => {
    if (!trackId) return;

    let controllerTimer: ReturnType<typeof setTimeout> | null = null;
    let apiTimer: ReturnType<typeof setTimeout> | null = null;

    function createOrLoadController() {
      const container = containerRef.current;
      if (!container || !window.SpotifyIframeApi) return;

      // Destroy any previous controller
      if (controllerRef.current) {
        try {
          controllerRef.current.destroy();
        } catch {
          // ignore
        }
        controllerRef.current = null;
      }

      controllerTimer = setTimeout(() => {
        pushPlayerEvent('spotify_controller_init_timeout', { trackId: trackId ?? '' });
      }, SPOTIFY_CONTROLLER_TIMEOUT_MS);

      window.SpotifyIframeApi.createController(
        container,
        {
          uri: `spotify:track:${trackId}`,
          width: '100%',
          height: '100%',
        },
        (controller) => {
          if (controllerTimer) clearTimeout(controllerTimer);
          controllerRef.current = controller;
          // Sync initial play state
          try {
            if (isPlaying) {
              controller.resume();
            } else {
              controller.pause();
            }
          } catch (err) {
            pushPlayerError(err instanceof Error ? err : new Error(String(err)), {
              phase: 'spotify_initial_sync',
              trackId: trackId ?? '',
            });
          }
        }
      );
    }

    if (window.SpotifyIframeApi) {
      createOrLoadController();
      return () => {
        if (controllerTimer) clearTimeout(controllerTimer);
      };
    }

    // Load script if not already loading
    if (!document.getElementById('spotify-api-script')) {
      const script = document.createElement('script');
      script.id = 'spotify-api-script';
      script.src = 'https://open.spotify.com/embed/iframe-api/v1';
      script.async = true;
      document.body.appendChild(script);
    }

    apiTimer = setTimeout(() => {
      pushPlayerEvent('spotify_api_load_timeout', { trackId: trackId ?? '' });
    }, SPOTIFY_API_TIMEOUT_MS);

    const prevCallback = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = () => {
      if (apiTimer) clearTimeout(apiTimer);
      prevCallback?.();
      createOrLoadController();
    };

    return () => {
      if (apiTimer) clearTimeout(apiTimer);
      if (controllerTimer) clearTimeout(controllerTimer);
      window.onSpotifyIframeApiReady = prevCallback;
    };
  }, [trackId, isPlaying]);

  // Keep Spotify embed in sync with play/pause button
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    if (isPlaying) {
      controller.resume();
    } else {
      controller.pause();
    }
  }, [isPlaying]);

  // Container div where Spotify IFrame API will render its own iframe
  return <div ref={containerRef} className="h-full w-full" />;
}

