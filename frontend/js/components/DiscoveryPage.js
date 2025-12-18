import { onMounted, computed } from 'vue';
import { useDiscovery } from '../hooks/useDiscovery.js';
import { trackInteraction, AnalyticsEvents } from '../analytics.js';
import PopularSection from './discovery/PopularSection.js';
import StyleExplorer from './discovery/StyleExplorer.js';
import RecentSection from './discovery/RecentSection.js';
import CompactTrackCard from './discovery/CompactTrackCard.js';
import StatsDashboard from './StatsDashboard.js';

export default {
  name: 'DiscoveryPage',
  components: {
    'popular-section': PopularSection,
    'style-explorer': StyleExplorer,
    'recent-section': RecentSection,
    'compact-track-card': CompactTrackCard,
    'stats-dashboard': StatsDashboard
  },
  props: {
    currentTrack: Object,
    isPlaying: Boolean,
    isSpotifyMode: Boolean
  },
  emits: ['play', 'stop', 'navigate-to-search', 'refresh', 'filter-style', 'show-similar', 'add-to-queue'],
  setup(_props, { emit }) {
    const discovery = useDiscovery();

    // Limit tracks to 3 for compact display
    const limitedPopularTracks = computed(() => discovery.popularTracks.value.slice(0, 3));
    const limitedRecentTracks = computed(() => discovery.recentTracks.value.slice(0, 3));

    // Fetch all discovery data on mount (fetch 3 instead of 6)
    onMounted(() => {
      // Track page view
      trackInteraction(AnalyticsEvents.DISCOVERY_PAGE_VIEW);

      discovery.fetchPopular();
      discovery.fetchStyleOverview();
      discovery.fetchRecent();
    });

    const handleStyleClick = (styleName) => {
      // Track style click
      trackInteraction(AnalyticsEvents.DISCOVERY_STYLE_CLICK, null, { style: styleName });

      // Emit navigate-to-search with the style filter
      emit('navigate-to-search', { mainStyle: styleName });
    };

    const handleSearchClick = () => {
      // Track navigation to search
      trackInteraction(AnalyticsEvents.DISCOVERY_TO_SEARCH, null, { trigger: 'cta_button' });

      emit('navigate-to-search', {});
    };

    const handlePlay = (track) => {
      // Track which section the track was played from
      let section = 'unknown';
      if (discovery.popularTracks.value.some(t => t.id === track.id)) {
        section = 'popular';
      } else if (discovery.recentTracks.value.some(t => t.id === track.id)) {
        section = 'recent';
      }

      trackInteraction(AnalyticsEvents.DISCOVERY_TRACK_PLAY, track.id, { section });

      // Emit the play event to parent
      emit('play', track);
    };

    return {
      ...discovery,
      limitedPopularTracks,
      limitedRecentTracks,
      handleStyleClick,
      handleSearchClick,
      handlePlay
    };
  },
  template: `
    <div class="max-w-4xl mx-auto">
      <!-- Hero Section -->
      <div class="text-center mb-12">
        <h1 class="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
          Upptäck svensk folkmusik för dans
        </h1>
        <p class="text-lg text-gray-600 mb-6">
          Hitta perfekta låtar för polska, hambo, vals och mer. Från nybörjare till instruktörer.
        </p>
        <stats-dashboard></stats-dashboard>
      </div>

      <!-- Popular Tracks Section -->
      <popular-section
        :tracks="limitedPopularTracks"
        :loading="loading.popular"
        :current-track="currentTrack"
        :is-playing="isPlaying"
        :is-spotify-mode="isSpotifyMode"
        @play="handlePlay"
        @stop="$emit('stop')"
      >
        <template #track-card="{ track }">
          <compact-track-card
            :track="track"
            :current-track="currentTrack"
            :is-spotify-mode="isSpotifyMode"
            :is-playing="isPlaying"
            @play="handlePlay"
            @stop="$emit('stop')"
            @add-to-queue="$emit('add-to-queue', $event)"
          ></compact-track-card>
        </template>
      </popular-section>

      <!-- Style Explorer Section -->
      <style-explorer
        :styles="styleOverview"
        :loading="loading.styles"
        @style-click="handleStyleClick"
      ></style-explorer>

      <!-- Recent Tracks Section -->
      <recent-section
        :tracks="limitedRecentTracks"
        :loading="loading.recent"
        :current-track="currentTrack"
        :is-playing="isPlaying"
        :is-spotify-mode="isSpotifyMode"
        @play="handlePlay"
        @stop="$emit('stop')"
      >
        <template #track-card="{ track }">
          <compact-track-card
            :track="track"
            :current-track="currentTrack"
            :is-spotify-mode="isSpotifyMode"
            :is-playing="isPlaying"
            @play="handlePlay"
            @stop="$emit('stop')"
            @add-to-queue="$emit('add-to-queue', $event)"
          ></compact-track-card>
        </template>
      </recent-section>

      <!-- Call to Action -->
      <div class="text-center mt-12 mb-8">
        <button
          @click="handleSearchClick"
          class="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-8 py-3 rounded-full transition-colors shadow-sm hover:shadow-md"
        >
          Utforska alla låtar
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </button>
      </div>
    </div>
  `
};
