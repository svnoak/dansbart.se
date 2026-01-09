import { onMounted, computed } from 'vue';
import { useDiscovery } from '../hooks/useDiscovery.js';
import { trackInteraction, AnalyticsEvents } from '../analytics.js';
import PopularSection from './discovery/PopularSection.js';
import StyleExplorer from './discovery/StyleExplorer.js';
import PlaylistSection from './discovery/PlaylistSection.js';
import CompactTrackCard from './discovery/CompactTrackCard.js';
import StatsDashboard from './StatsDashboard.js';

export default {
  name: 'DiscoveryPage',
  components: {
    'popular-section': PopularSection,
    'style-explorer': StyleExplorer,
    'playlist-section': PlaylistSection,
    'compact-track-card': CompactTrackCard,
    'stats-dashboard': StatsDashboard
  },
  props: {
    currentTrack: Object,
    isPlaying: Boolean,
    isSpotifyMode: Boolean
  },
  emits: ['play', 'stop', 'navigate-to-search', 'navigate-to-classify', 'refresh', 'filter-style', 'show-similar', 'add-to-queue'],
  setup(_props, { emit }) {
    const discovery = useDiscovery();

    // Limit tracks to 3 for compact display
    const limitedPopularTracks = computed(() => discovery.popularTracks.value.slice(0, 3));

    // Fetch all discovery data on mount (fetch 3 instead of 6)
    onMounted(() => {
      // Track page view
      trackInteraction(AnalyticsEvents.DISCOVERY_PAGE_VIEW);

      discovery.fetchPopular();
      discovery.fetchStyleOverview();
      discovery.fetchPlaylists();
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

    const handleClassifyClick = () => {
      // Track navigation to classify
      trackInteraction(AnalyticsEvents.DISCOVERY_TO_CLASSIFY, null, { trigger: 'cta_button' });

      emit('navigate-to-classify');
    };

    const handlePlaylistPlay = (track, sourcePreference) => {
      // Track playlist track play
      trackInteraction(AnalyticsEvents.DISCOVERY_PLAYLIST_PLAY, track.id, { source: sourcePreference });

      // Emit play with source preference
      emit('play', track, sourcePreference);
    };

    const handleViewAllPlaylist = (playlist) => {
      // Track view all click
      trackInteraction(AnalyticsEvents.DISCOVERY_PLAYLIST_VIEW_ALL, null, { playlist_id: playlist.id });

      // Navigate to search with playlist filters
      // For now, just navigate to search - could add specific filters later
      emit('navigate-to-search', {});
    };

    return {
      ...discovery,
      limitedPopularTracks,
      handleStyleClick,
      handleSearchClick,
      handleClassifyClick,
      handlePlay,
      handlePlaylistPlay,
      handleViewAllPlaylist
    };
  },
  template: `
    <div class="max-w-4xl mx-auto">
      <!-- Hero Section -->
      <div class="text-center mb-12">
        <h1 class="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
          Hitta låtar att dansa folkdans till
        </h1>
        <p class="text-lg text-gray-600 mb-6">
          Leta efter specifika dansstilar, tempo och mer!
        </p>
        <stats-dashboard></stats-dashboard>
      </div>

      <!-- Primary Call to Actions -->
      <div class="grid md:grid-cols-2 gap-3 mb-10">
        <button
          @click="handleSearchClick"
          class="group relative overflow-hidden bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl p-5 transition-all shadow-md hover:shadow-lg"
        >
          <div class="flex items-center gap-3">
            <div class="flex-1 text-left">
              <h3 class="text-base font-bold mb-0.5">Utforska alla låtar</h3>
              <p class="text-indigo-100 text-xs">Sök och filtrera bland tusentals låtar</p>
            </div>
            <svg class="w-5 h-5 transform group-hover:translate-x-1 transition-transform flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </div>
        </button>

        <button
          @click="handleClassifyClick"
          class="group relative overflow-hidden bg-orange-500 hover:bg-orange-600 text-white rounded-xl p-5 transition-all shadow-md hover:shadow-lg"
        >
          <div class="flex items-center gap-3">
            <div class="flex-1 text-left">
              <h3 class="text-base font-bold mb-0.5">Hjälp till kategorisera</h3>
              <p class="text-orange-100 text-xs">Bidra med din kunskap</p>
            </div>
            <svg class="w-5 h-5 transform group-hover:translate-x-1 transition-transform flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </div>
        </button>
      </div>

      <!-- Style Explorer Section -->
      <style-explorer
        :styles="styleOverview"
        :loading="loading.styles"
        @style-click="handleStyleClick"
      ></style-explorer>

      <!-- Playlists Section -->
      <playlist-section
        :playlists="playlists"
        :loading="loading.playlists"
        :current-track="currentTrack"
        :is-playing="isPlaying"
        :is-spotify-mode="isSpotifyMode"
        @play="handlePlaylistPlay"
        @stop="$emit('stop')"
        @view-all="handleViewAllPlaylist"
      ></playlist-section>

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
    </div>
  `
};
