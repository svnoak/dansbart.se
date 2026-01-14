import { ref } from 'vue';
import TrackCard from './TrackCard.js';
import ArtistCard from './ArtistCard.js';
import AlbumCard from './AlbumCard.js';
import FilterBar from './FilterBar.js';
import StatsDashboard from './StatsDashboard.js';

export default {
  name: 'SearchPage',
  components: {
    'track-card': TrackCard,
    'artist-card': ArtistCard,
    'album-card': AlbumCard,
    'filter-bar': FilterBar,
    'stats-dashboard': StatsDashboard,
  },
  props: {
    // Filter props
    filters: Object,
    styleTree: Array,
    targetTempo: Number,
    tempoEnabled: Boolean,
    computedMin: Number,
    computedMax: Number,
    minBounciness: Number,
    maxBounciness: Number,
    bouncinessEnabled: Boolean,
    minArticulation: Number,
    maxArticulation: Number,
    articulationEnabled: Boolean,
    // Data
    tracks: Array,
    artists: Array,
    albums: Array,
    // Loading states (computed based on search type in parent)
    loading: Boolean,
    loadingMore: Boolean,
    hasMore: Boolean,
    // Player state
    currentTrack: Object,
    isPlaying: Boolean,
    activeSource: String,
  },
  emits: [
    'update:main-style',
    'update:sub-style',
    'update:search',
    'update:search-type',
    'update:source',
    'update:vocals',
    'update:style-confirmed',
    'update:traditional-only',
    'update:min-duration',
    'update:max-duration',
    'update:target-tempo',
    'update:tempo-enabled',
    'update:min-bounciness',
    'update:max-bounciness',
    'update:bounciness-enabled',
    'update:min-articulation',
    'update:max-articulation',
    'update:articulation-enabled',
    'filter-style',
    'play',
    'stop',
    'refresh',
    'show-similar',
    'add-to-queue',
    'navigate-to-artist',
    'navigate-to-album',
  ],
  setup() {
    const scrollTrigger = ref(null);

    return {
      scrollTrigger
    };
  },
  template: `
    <div>
      <div class="max-w-4xl mx-auto mb-8 text-center">
        <stats-dashboard></stats-dashboard>
      </div>

      <filter-bar
        :main-style="filters.mainStyle"
        :sub-style="filters.subStyle"
        :search="filters.search"
        :search-type="filters.searchType"
        :source="filters.source"
        :vocals="filters.vocals"
        :style-confirmed="filters.styleConfirmed"
        :traditional-only="filters.traditionalOnly"
        :min-duration="filters.minDuration"
        :max-duration="filters.maxDuration"
        :target-tempo="targetTempo"
        :tempo-enabled="tempoEnabled"
        :min-bounciness="minBounciness"
        :max-bounciness="maxBounciness"
        :bounciness-enabled="bouncinessEnabled"
        :min-articulation="minArticulation"
        :max-articulation="maxArticulation"
        :articulation-enabled="articulationEnabled"
        :computed-min="computedMin"
        :computed-max="computedMax"
        :style-tree="styleTree"
        @update:main-style="$emit('update:main-style', $event)"
        @update:sub-style="$emit('update:sub-style', $event)"
        @update:search="$emit('update:search', $event)"
        @update:search-type="$emit('update:search-type', $event)"
        @update:source="$emit('update:source', $event)"
        @update:vocals="$emit('update:vocals', $event)"
        @update:style-confirmed="$emit('update:style-confirmed', $event)"
        @update:traditional-only="$emit('update:traditional-only', $event)"
        @update:min-duration="$emit('update:min-duration', $event)"
        @update:max-duration="$emit('update:max-duration', $event)"
        @update:target-tempo="$emit('update:target-tempo', $event)"
        @update:tempo-enabled="$emit('update:tempo-enabled', $event)"
        @update:min-bounciness="$emit('update:min-bounciness', $event)"
        @update:max-bounciness="$emit('update:max-bounciness', $event)"
        @update:bounciness-enabled="$emit('update:bounciness-enabled', $event)"
        @update:min-articulation="$emit('update:min-articulation', $event)"
        @update:max-articulation="$emit('update:max-articulation', $event)"
        @update:articulation-enabled="$emit('update:articulation-enabled', $event)"
        @filter-style="$emit('filter-style', $event)"
      ></filter-bar>

      <div class="max-w-4xl mx-auto">
        <!-- Tracks View -->
        <div v-if="filters.searchType === 'tracks'">
          <div v-if="loading" class="grid gap-4">
            <div v-for="i in 5" :key="i" class="bg-white rounded-xl shadow-sm p-6 animate-pulse">
              <div class="flex gap-4">
                <div class="flex-1">
                  <div class="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
                  <div class="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div class="h-3 bg-gray-200 rounded w-1/3"></div>
                </div>
                <div class="w-12 h-12 bg-gray-200 rounded-full"></div>
              </div>
            </div>
          </div>

          <div v-else class="grid gap-4">
            <track-card
              v-for="track in tracks"
              :key="track.id"
              :track="track"
              :current-track="currentTrack"
              :is-spotify-mode="activeSource === 'spotify'"
              :is-playing="isPlaying"
              @play="$emit('play', $event)"
              @stop="$emit('stop')"
              @refresh="$emit('refresh')"
              @filter-style="$emit('filter-style', $event)"
              @show-similar="$emit('show-similar', $event)"
              @add-to-queue="$emit('add-to-queue', $event)"
              @navigate-to-artist="$emit('navigate-to-artist', $event)"
              @navigate-to-album="$emit('navigate-to-album', $event)"
            ></track-card>

            <div
              ref="scrollTrigger"
              class="py-8 text-center w-full"
              style="min-height: 50px; display: block"
            >
              <div v-if="loadingMore" class="flex items-center justify-center gap-2 text-gray-500">
                <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                    fill="none"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  ></path>
                </svg>
                <span>Laddar fler...</span>
              </div>
              <div v-else-if="!hasMore && tracks.length > 0" class="text-gray-400 text-sm">
                Inga fler låtar att visa
              </div>
            </div>
          </div>
        </div>

        <!-- Artists View -->
        <div v-else-if="filters.searchType === 'artists'">
          <div v-if="loading" class="grid gap-4">
            <div v-for="i in 5" :key="i" class="bg-white rounded-xl shadow-sm p-6 animate-pulse">
              <div class="flex gap-4">
                <div class="w-16 h-16 bg-gray-200 rounded-full flex-shrink-0"></div>
                <div class="flex-1">
                  <div class="h-5 bg-gray-200 rounded w-2/3 mb-3"></div>
                  <div class="h-4 bg-gray-200 rounded w-1/3"></div>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="grid gap-4">
            <artist-card
              v-for="artist in artists"
              :key="artist.id"
              :artist="artist"
              @navigate-to-artist="$emit('navigate-to-artist', $event)"
            ></artist-card>

            <div
              ref="scrollTrigger"
              class="py-8 text-center w-full"
              style="min-height: 50px; display: block"
            >
              <div v-if="loadingMore" class="flex items-center justify-center gap-2 text-gray-500">
                <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                    fill="none"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  ></path>
                </svg>
                <span>Laddar fler...</span>
              </div>
              <div v-else-if="!hasMore && artists.length > 0" class="text-gray-400 text-sm">
                Inga fler artister att visa
              </div>
            </div>
          </div>
        </div>

        <!-- Albums View -->
        <div v-else-if="filters.searchType === 'albums'">
          <div v-if="loading" class="grid gap-4">
            <div v-for="i in 5" :key="i" class="bg-white rounded-xl shadow-sm p-6 animate-pulse">
              <div class="flex gap-4">
                <div class="w-16 h-16 bg-gray-200 rounded flex-shrink-0"></div>
                <div class="flex-1">
                  <div class="h-5 bg-gray-200 rounded w-2/3 mb-3"></div>
                  <div class="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div class="h-3 bg-gray-200 rounded w-1/3"></div>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="grid gap-4">
            <album-card
              v-for="album in albums"
              :key="album.id"
              :album="album"
              @navigate-to-album="$emit('navigate-to-album', $event)"
            ></album-card>

            <div
              ref="scrollTrigger"
              class="py-8 text-center w-full"
              style="min-height: 50px; display: block"
            >
              <div v-if="loadingMore" class="flex items-center justify-center gap-2 text-gray-500">
                <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                    fill="none"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  ></path>
                </svg>
                <span>Laddar fler...</span>
              </div>
              <div v-else-if="!hasMore && albums.length > 0" class="text-gray-400 text-sm">
                Inga fler album att visa
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};
