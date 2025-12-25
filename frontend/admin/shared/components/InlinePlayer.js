/**
 * Inline Track Player for Admin Panels
 * Simple audio player that works with Spotify embed URLs
 */

import { ref, computed } from 'vue';

export default {
  props: {
    playbackLinks: {
      type: Array,
      default: () => [],
    },
    trackTitle: {
      type: String,
      default: 'Unknown Track',
    },
  },
  setup(props) {
    const isPlaying = ref(false);
    const currentTime = ref(0);
    const duration = ref(0);
    const audioElement = ref(null);

    // Get the best available playback link (prefer Spotify)
    const playbackUrl = computed(() => {
      if (!props.playbackLinks || props.playbackLinks.length === 0) return null;

      // Try Spotify first
      const spotifyLink = props.playbackLinks.find((l) => l.platform === 'spotify');
      if (spotifyLink) {
        return extractSpotifyTrackId(spotifyLink.deep_link);
      }

      // Fallback to YouTube or other platforms
      const youtubeLink = props.playbackLinks.find((l) => l.platform === 'youtube');
      if (youtubeLink) {
        return youtubeLink.deep_link;
      }

      return null;
    });

    const hasPlaybackUrl = computed(() => playbackUrl.value !== null);

    // Extract Spotify track ID from various URL formats
    function extractSpotifyTrackId(url) {
      if (!url) return null;

      // If it's already just the track ID (22 alphanumeric characters)
      if (/^[a-zA-Z0-9]{22}$/.test(url)) {
        return url;
      }

      // Format: spotify:track:ID
      if (url.startsWith('spotify:track:')) {
        return url.split(':')[2];
      }

      // Format: https://open.spotify.com/track/ID
      if (url.includes('/track/')) {
        const match = url.match(/\/track\/([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
      }

      return null;
    }

    // Spotify embed URL
    const spotifyEmbedUrl = computed(() => {
      const trackId = playbackUrl.value;
      if (!trackId || trackId.startsWith('http')) return null; // Not a Spotify track
      return `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;
    });

    // Toggle play/pause (for Spotify iframe, we just show the player)
    function togglePlay() {
      isPlaying.value = !isPlaying.value;
    }

    // Open in new tab
    function openInNewTab() {
      const spotifyLink = props.playbackLinks.find((l) => l.platform === 'spotify');
      if (spotifyLink) {
        const trackId = extractSpotifyTrackId(spotifyLink.deep_link);
        if (trackId) {
          window.open(`https://open.spotify.com/track/${trackId}`, '_blank');
        }
      }
    }

    return {
      isPlaying,
      currentTime,
      duration,
      audioElement,
      hasPlaybackUrl,
      spotifyEmbedUrl,
      togglePlay,
      openInNewTab,
    };
  },
  template: /*html*/ `
    <div class="inline-player">
      <!-- No playback available -->
      <div v-if="!hasPlaybackUrl" class="text-xs text-gray-500">
        No preview
      </div>

      <!-- Spotify iframe player -->
      <div v-else-if="spotifyEmbedUrl" class="flex items-center gap-2">
        <button
          @click="togglePlay"
          class="bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1"
          :title="isPlaying ? 'Hide player' : 'Show player'">
          {{ isPlaying ? '⏸' : '▶' }}
        </button>

        <button
          @click="openInNewTab"
          class="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs"
          title="Open in Spotify">
          🎵
        </button>

        <!-- Spotify Embed (shown when playing) -->
        <div v-if="isPlaying" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" @click.self="togglePlay">
          <div class="bg-gray-900 p-4 rounded-lg border border-gray-700 shadow-xl">
            <div class="flex justify-between items-center mb-2">
              <h3 class="text-sm font-bold text-white">{{ trackTitle }}</h3>
              <button @click="togglePlay" class="text-gray-400 hover:text-white text-xl">×</button>
            </div>
            <iframe
              :src="spotifyEmbedUrl"
              width="380"
              height="152"
              frameborder="0"
              allowtransparency="true"
              allow="encrypted-media"
              class="rounded">
            </iframe>
          </div>
        </div>
      </div>

      <!-- Fallback for non-Spotify links -->
      <div v-else class="flex items-center gap-2">
        <a
          :href="playbackUrl"
          target="_blank"
          class="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-xs">
          ▶ Play
        </a>
      </div>
    </div>
  `,
};
