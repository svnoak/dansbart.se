/** YouTube IFrame API (loaded via script tag). */
declare global {
  interface YTPlayerInstance {
    loadVideoById: (id: string) => void;
    playVideo: () => void;
    pauseVideo: () => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    destroy: () => void;
    seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  }

  interface YTPlayerCtor {
    new (
      elementId: string,
      options: {
        height: string;
        width: string;
        playerVars?: Record<string, number | string>;
        events?: {
          onReady?: (event: { target: YTPlayerInstance }) => void;
          onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
          onError?: (event: { data: number }) => void;
        };
      }
    ): YTPlayerInstance;
  }

  interface YTNamespace {
    Player: YTPlayerCtor;
    PlayerState: {
      UNSTARTED: number;
      ENDED: number;
      PLAYING: number;
      PAUSED: number;
      BUFFERING: number;
      CUED: number;
    };
  }

  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export {};
