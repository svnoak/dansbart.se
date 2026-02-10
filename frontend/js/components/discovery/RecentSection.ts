import EmptyState from './EmptyState.js';

export default {
  name: 'RecentSection',
  components: {
    'empty-state': EmptyState
  },
  props: {
    tracks: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    },
    currentTrack: Object,
    isPlaying: Boolean,
    isSpotifyMode: Boolean
  },
  emits: ['play', 'stop', 'refresh', 'filter-style', 'show-similar'],
  template: `
    <section class="mb-8">
      <h2 class="text-2xl font-bold text-gray-900 mb-6">Nyligen tillagda</h2>

      <!-- Loading State -->
      <div v-if="loading" class="grid gap-4">
        <div v-for="i in 3" :key="i" class="bg-white rounded-xl shadow-sm p-6 animate-pulse">
          <div class="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
          <div class="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>

      <!-- Empty State -->
      <empty-state v-else-if="tracks.length === 0" type="recent" />

      <!-- Track List -->
      <div v-else class="grid gap-4">
        <slot
          v-for="track in tracks"
          :key="track.id"
          name="track-card"
          :track="track"
        ></slot>
      </div>
    </section>
  `
};
