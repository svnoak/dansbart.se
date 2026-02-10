/**
 * Global type extensions for browser and third-party scripts.
 */
interface YTPlayerState {
  CUED: number;
  PLAYING: number;
  ENDED: number;
  [key: string]: number;
}
interface YTPlayerCtor {
  new (elementId: string, options: Record<string, string | number | object>): {
    loadVideoById: (id: string) => void;
    playVideo: () => void;
    pauseVideo: () => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    destroy: () => void;
    seekTo: (seconds: number, allowSeekAhead: boolean) => void;
    [key: string]:
      | string
      | number
      | (() => void)
      | ((a: string) => void)
      | ((...args: number[]) => void)
      | (() => number);
  };
}
interface YTNamespace {
  Player: YTPlayerCtor;
  PlayerState: YTPlayerState;
}
interface SpotifyCreateController {
  createController: (
    element: HTMLElement,
    options: Record<string, string | number>,
    callbacks: Record<string, (e?: { data?: object }) => void>,
  ) => void;
}
declare global {
  interface Window {
    __DANSBART_AUTH_CONFIG__?: { authEnabled?: boolean; authMethod?: string };
    _tempVoterId?: string;
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
    SpotifyIframeApi?: SpotifyCreateController;
    onSpotifyIframeApiReady?: () => void;
  }
  const YT: YTNamespace | undefined;
}
export {};
