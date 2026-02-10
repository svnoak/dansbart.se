import { useConsent } from '../../consent';

/** Spotify Embed Controller callback payload (from embed iframe API) */
interface SpotifyPlaybackUpdate {
  data: { isPaused?: boolean; position?: number; duration?: number; isBuffering?: boolean };
}
interface SpotifyEmbedController {
  addListener(name: string, fn: (e: SpotifyPlaybackUpdate) => void): void;
  loadUri(uri: string): void;
  destroy(): void;
  resume(): void;
  pause(): void;
  togglePlay(): void;
  seek(seconds: number): void;
  restart(): void;
}
declare global {
  interface Window {
    SpotifyIframeApi?: {
      createController(
        element: HTMLElement,
        options: object,
        callback: (controller: SpotifyEmbedController) => void,
      ): void;
    };
    onSpotifyIframeApiReady?: () => void;
  }
}

export default {
  props: ['trackId', 'activeSource'],
  emits: ['ready', 'playback-update', 'error'],

  setup() {
    const { consentStatus } = useConsent();
    return { consentStatus };
  },

  template: `
    <div class="w-full h-full">
        <div ref="spotifyEmbed" class="w-full h-full"></div>
    </div>
    `,

  data() {
    return {
      controller: null,
      apiReady: false,
      currentTrackId: null,
      isReady: false,
      apiInitialized: false,
    };
  },

  mounted() {
    // Only initialize API if consent is granted
    if (this.consentStatus === 'granted') {
      this.initAPI();
    }

    // Listen for consent changes
    window.addEventListener('consent-changed', this.onConsentChanged);
  },

  beforeUnmount() {
    this.destroyController();
    window.removeEventListener('consent-changed', this.onConsentChanged);
  },

  watch: {
    trackId(newId) {
      const src = this.activeSource as string;
      if (newId && src === 'spotify') {
        this.loadTrack(newId);
      }
    },
    activeSource(newSource) {
      const src = newSource as string;
      if (src === 'spotify' && this.trackId) {
        // When switching to spotify, ensure we have a controller
        this.$nextTick(() => {
          if (!this.controller && this.apiReady) {
            this.createController(this.trackId);
          } else if (this.controller && this.currentTrackId !== this.trackId) {
            this.loadTrack(this.trackId);
          }
        });
      } else if (src !== 'spotify' && this.controller) {
        // Pause when switching away from Spotify
        this.pause();
      }
    },
  },

  methods: {
    onConsentChanged(event) {
      if (event.detail.status === 'granted' && !this.apiInitialized) {
        this.initAPI();
      }
    },
    initAPI() {
      // Only load if consent is granted
      if (this.consentStatus !== 'granted') return;

      this.apiInitialized = true;

      // Check if already loaded
      if (window.SpotifyIframeApi) {
        this.apiReady = true;
        if (this.activeSource === 'spotify' && this.trackId) {
          this.$nextTick(() => this.createController(this.trackId));
        }
        return;
      }

      // Check if script is already being loaded
      if (document.getElementById('spotify-api-script')) {
        // Wait for the callback
        const checkReady = setInterval(() => {
          if (window.SpotifyIframeApi) {
            clearInterval(checkReady);
            this.apiReady = true;
            if (this.activeSource === 'spotify' && this.trackId) {
              this.createController(this.trackId);
            }
          }
        }, 100);
        return;
      }

      // Load the script
      const script = document.createElement('script');
      script.id = 'spotify-api-script';
      script.src = 'https://open.spotify.com/embed/iframe-api/v1';
      script.async = true;
      document.body.appendChild(script);

      // Set up the callback
      const self = this;
      window.onSpotifyIframeApiReady = () => {
        const IFrameAPI = window.SpotifyIframeApi;
        window.SpotifyIframeApi = IFrameAPI;
        self.apiReady = true;
        if (self.activeSource === 'spotify' && self.trackId) {
          self.createController(self.trackId);
        }
      };
    },

    createController(trackId) {
      if (!window.SpotifyIframeApi) return;

      const element = this.$refs.spotifyEmbed;
      if (!element) {
        // Retry if element not ready
        setTimeout(() => this.createController(trackId), 100);
        return;
      }

      // Destroy existing controller
      this.destroyController();

      const options = {
        uri: `spotify:track:${trackId}`,
        width: '100%',
        height: '100%',
      };

      const self = this;
      const api = window.SpotifyIframeApi;
      if (api?.createController)
        api.createController(element, options, (controller: SpotifyEmbedController) => {
          self.controller = controller;
          self.currentTrackId = trackId;
          self.isReady = true;
          controller.addListener('playback_update', e => {
          self.$emit('playback-update', {
            isPaused: e.data.isPaused,
            position: (e.data.position ?? 0) / 1000,
            duration: (e.data.duration ?? 0) / 1000,
            isBuffering: e.data.isBuffering,
          });
        });
          controller.addListener('ready', () => {
            self.$emit('ready');
          });
        });
    },

    loadTrack(trackId) {
      if (!trackId) return;

      if (!this.controller) {
        if (this.apiReady) {
          this.createController(trackId);
        }
        return;
      }

      if (this.currentTrackId === trackId) return;

      this.currentTrackId = trackId;
      this.controller.loadUri(`spotify:track:${trackId}`);
    },

    destroyController() {
      if (this.controller) {
        try {
          this.controller.destroy();
        } catch {
          // Ignore errors during cleanup
        }
        this.controller = null;
        this.isReady = false;
      }
    },

    // --- Public Methods (Parent calls these via $refs.spotifyEngine.play()) ---
    play() {
      if (this.controller) {
        this.controller.resume();
      }
    },

    pause() {
      if (this.controller) {
        this.controller.pause();
      }
    },

    resume() {
      if (this.controller) {
        this.controller.resume();
      }
    },

    togglePlay() {
      if (this.controller) {
        this.controller.togglePlay();
      }
    },

    seek(seconds) {
      if (this.controller) {
        this.controller.seek(seconds);
      }
    },

    restart() {
      if (this.controller) {
        this.controller.restart();
      }
    },
  },
};
