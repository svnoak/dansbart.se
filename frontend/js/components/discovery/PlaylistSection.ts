import EmptyState from './EmptyState.js';
import CompactTrackCard from './CompactTrackCard';

export default {
  name: 'PlaylistSection',
  components: {
    'empty-state': EmptyState,
    'compact-track-card': CompactTrackCard
  },
  props: {
    playlists: {
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
  emits: ['play', 'stop', 'view-all'],
  template: `
    <section class="mb-8">
      <h2 class="text-2xl font-bold text-gray-900 mb-6">Kurerade spellistor</h2>

      <!-- Loading State -->
      <div v-if="loading" class="space-y-6">
        <div v-for="i in 3" :key="i" class="bg-white rounded-lg shadow-sm p-5 animate-pulse">
          <div class="h-5 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div class="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div class="space-y-2">
            <div v-for="j in 3" :key="j" class="h-12 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <empty-state v-else-if="playlists.length === 0" type="playlists" />

      <!-- Playlist Cards -->
      <div v-else class="space-y-6">
        <div
          v-for="playlist in playlists"
          :key="playlist.id"
          class="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
        >
          <!-- Playlist Header -->
          <div class="bg-gradient-to-r from-indigo-50 to-purple-50 p-5 border-b border-gray-100">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <h3 class="font-bold text-gray-900 text-lg mb-1">{{ playlist.name }}</h3>
                <p class="text-sm text-gray-600">{{ playlist.description }}</p>
              </div>
              <div class="text-sm text-gray-500 ml-4">
                {{ playlist.track_count }} låtar
              </div>
            </div>
          </div>

          <!-- Playlist Tracks -->
          <div class="p-3 space-y-2">
            <compact-track-card
              v-for="track in playlist.tracks"
              :key="track.id"
              :track="track"
              :current-track="currentTrack"
              :is-spotify-mode="isSpotifyMode"
              :is-playing="isPlaying"
              @play="$emit('play', $event)"
              @stop="$emit('stop')"
            ></compact-track-card>
          </div>

          <!-- View All Button -->
          <div class="p-3 bg-gray-50 border-t border-gray-100">
            <button
              @click="$emit('view-all', playlist)"
              class="w-full text-center text-sm font-medium text-indigo-600 hover:text-indigo-700 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              Visa fler danser
            </button>
          </div>
        </div>
      </div>
    </section>
  `
};
