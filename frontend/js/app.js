import { createApp, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'; // Added nextTick
import { useTracks } from './hooks/tracks.js';
import { useFilters } from './hooks/filter.js';
import { usePlayer } from './hooks/player.js';
import { trackSession } from './analytics.js';
import { showError, showToast } from './hooks/useToast.js';

import './main.css';

import TrackCard from './components/TrackCard.js';
import FilterBar from './components/FilterBar.js';
import GlobalPlayer from './components/player/GlobalPlayer.js';
import StatsDashboard from './components/StatsDashboard.js';
import Header from './components/Header.js';
import CookieConsent from './components/CookieConsent.js';
import Toast from './components/toasts/Toast.js';
import SimilarTracksModal from './components/SimilarTracksModal.js';
import DiscoveryPage from './components/DiscoveryPage.js';
import ClassifyPage from './components/ClassifyPage.js';

const app = createApp({
  components: {
    'track-card': TrackCard,
    'filter-bar': FilterBar,
    'global-player': GlobalPlayer,
    'stats-dashboard': StatsDashboard,
    'site-header': Header,
    'cookie-consent': CookieConsent,
    'toast-container': Toast,
    'similar-tracks-modal': SimilarTracksModal,
    'discovery-page': DiscoveryPage,
    'classify-page': ClassifyPage,
  },
  setup() {
    const filterLogic = useFilters();
    const trackLogic = useTracks();
    const playerLogic = usePlayer();
    const { togglePlay } = playerLogic;

    // Page routing state
    const currentPage = ref('discovery');

    const scrollTrigger = ref(null);
    let observer = null;

    const navigateToPage = (page) => {
        currentPage.value = page;
        
        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('page', page);
        
        // Remove track parameter if switching pages to avoid confusion
        url.searchParams.delete('track');
        
        window.history.pushState({}, '', url);
    };

    const handlePlay = (track, sourcePreference = null) => {
      const list = trackLogic.tracks.value;
      const index = list.findIndex(t => t.id === track.id);
      if (index !== -1) {
        playerLogic.playContext(list, index, sourcePreference);
      }
    };

    // Discovery tracks play handler
    const handleDiscoveryPlay = (track, sourcePreference = null) => {
      // Just play the single track (discovery tracks aren't meant to be a playlist)
      playerLogic.playContext([track], 0, sourcePreference);
    };

    // Similar Tracks Modal
    const similarModalTrackId = ref(null);
    const similarTracks = ref([]);

    const showSimilarModal = (trackId) => {
      similarModalTrackId.value = trackId;
    };

    const closeSimilarModal = () => {
      similarModalTrackId.value = null;
      similarTracks.value = [];
    };

    // Queue management
    const addToQueue = (track) => {
      const success = playerLogic.addToQueue(track);
      if (success) {
        showToast(`"${track.title}" tillagd i kön`, 'success');
      } else {
        showToast(`"${track.title}" finns redan i kön`, 'info');
      }
    };

    const handleSimilarPlay = (track, sourcePreference = null) => {
      // For similar tracks, create a play context from the similar tracks list
      // If the track is in the similar tracks list, use that context
      // Otherwise, just play the single track
      if (similarTracks.value.length > 0) {
        const index = similarTracks.value.findIndex(t => t.id === track.id);
        if (index !== -1) {
          playerLogic.playContext(similarTracks.value, index, sourcePreference);
          return;
        }
      }

      // Fallback: play just this track
      playerLogic.playContext([track], 0, sourcePreference);
    };

    const createObserver = () => {
      if (observer) observer.disconnect();

      observer = new IntersectionObserver(
        entries => {
          const entry = entries[0];

          if (entry.isIntersecting) {
            if (!trackLogic.loading.value && !trackLogic.loadingMore.value) {
              trackLogic.loadMore();
            }
          }
        },
        {
          root: null, // viewport
          rootMargin: '200px',
          threshold: 0,
        }
      );

      if (scrollTrigger.value) {
        observer.observe(scrollTrigger.value);
      }
    };

    const loadAndPlayTrack = async trackId => {
      try {
        const response = await fetch(`/api/tracks/${trackId}`);
        if (!response.ok) throw new Error('Track not found');

        const track = await response.json();

        // Start playing this track immediately
        playerLogic.playContext([track], 0);

        // Load full track list in background
        trackLogic.fetchTracks();
      } catch {
        // Show error toast and fall back to normal flow
        showError('Låten kunde inte hittas');
        trackLogic.fetchTracks();
      }
    };

    // Sync filters to URL
    const syncFiltersToURL = () => {
      const url = new URL(window.location);
      const filterParams = filterLogic.filtersToQueryParams();

      // Clear existing filter params and add new ones
      const keysToKeep = ['page', 'track'];
      const newParams = new URLSearchParams();
      keysToKeep.forEach(key => {
        if (url.searchParams.has(key)) {
          newParams.set(key, url.searchParams.get(key));
        }
      });

      // Add filter params
      filterParams.forEach((value, key) => {
        newParams.set(key, value);
      });

      url.search = newParams.toString();
      window.history.replaceState({}, '', url);
    };

    // Navigation functions
    const navigateToSearch = (filters = {}) => {
      currentPage.value = 'search';
      Object.assign(filterLogic.filters.value, filters);

      const url = new URL(window.location);
      url.searchParams.set('page', 'search');

      // Add filter params to URL
      const filterParams = filterLogic.filtersToQueryParams();
      filterParams.forEach((value, key) => {
        url.searchParams.set(key, value);
      });

      window.history.pushState({}, '', url);
      trackLogic.fetchTracks();
    };

    onMounted(async () => {
      // Load saved queue from localStorage
      await playerLogic.loadQueueFromStorage();

      // Check for track deep link or page parameter
      const urlParams = new URLSearchParams(window.location.search);
      const trackId = urlParams.get('track');
      const page = urlParams.get('page');

      // Load filters from URL if present
      filterLogic.loadFiltersFromQueryParams(urlParams);

      if (trackId) {
        currentPage.value = 'search';
        loadAndPlayTrack(trackId);
      } else if (page === 'search') {
        currentPage.value = 'search';
        trackLogic.fetchTracks();
      } else if (page === 'classify') {
        currentPage.value = 'classify';
      } else {
        // Default to discovery page
        currentPage.value = 'discovery';
      }

      // Handle browser back/forward
      window.addEventListener('popstate', () => {
        const params = new URLSearchParams(window.location.search);
        const pageParam = params.get('page');
        const trackParam = params.get('track');

        // Load filters from URL on navigation
        filterLogic.loadFiltersFromQueryParams(params);

        if (trackParam) {
          currentPage.value = 'search';
          loadAndPlayTrack(trackParam);
        } else if (pageParam === 'search') {
          currentPage.value = 'search';
          trackLogic.fetchTracks();
        } else {
          currentPage.value = 'discovery';
        }
      });

      trackSession();
    });

    onUnmounted(() => {
      if (observer) observer.disconnect();
    });

    watch(
      () => trackLogic.loading.value,
      async isLoading => {
        if (!isLoading) {
          await nextTick(); // Wait for v-else to render the div
          createObserver();
        }
      }
    );
    watch(scrollTrigger, el => {
      if (el) createObserver();
    });

    // Watch filters and sync to URL (only on search page)
    watch(
      () => [
        filterLogic.filters.value,
        filterLogic.targetTempo.value,
        filterLogic.tempoEnabled.value,
        filterLogic.minBounciness.value,
        filterLogic.maxBounciness.value,
        filterLogic.bouncinessEnabled.value,
        filterLogic.minArticulation.value,
        filterLogic.maxArticulation.value,
        filterLogic.articulationEnabled.value,
      ],
      () => {
        if (currentPage.value === 'search') {
          syncFiltersToURL();
        }
      },
      { deep: true }
    );

    return {
      ...trackLogic,
      ...playerLogic,
      filters: filterLogic.filters,
      styleTree: filterLogic.styleTree,
      targetTempo: filterLogic.targetTempo,
      tempoEnabled: filterLogic.tempoEnabled,
      computedMin: filterLogic.computedMin,
      computedMax: filterLogic.computedMax,
      handleFilterStyle: filterLogic.handleFilterStyle,
      minBounciness: filterLogic.minBounciness,
      maxBounciness: filterLogic.maxBounciness,
      bouncinessEnabled: filterLogic.bouncinessEnabled,
      minArticulation: filterLogic.minArticulation,
      maxArticulation: filterLogic.maxArticulation,
      articulationEnabled: filterLogic.articulationEnabled,
      handlePlay,
      handleDiscoveryPlay,
      togglePlay,
      scrollTrigger,
      similarModalTrackId,
      similarTracks,
      showSimilarModal,
      closeSimilarModal,
      handleSimilarPlay,
      currentPage,
      navigateToSearch,
      navigateToPage,
      addToQueue,
    };
  },
});

app.config.devtools = true;
app.mount('#app');
