import { createApp, onMounted, onUnmounted, ref, watch, nextTick, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTracks } from './hooks/tracks.js';
import { useFilters } from './hooks/filter.js';
import { usePlayer } from './hooks/player.js';
import { useArtistsList } from './hooks/artistsList.js';
import { useAlbumsList } from './hooks/albumsList.js';
import { trackSession } from './analytics.js';
import { showError, showToast } from './hooks/useToast.js';

import './main.css';

import TrackCard from './components/TrackCard.js';
import ArtistCard from './components/ArtistCard.js';
import AlbumCard from './components/AlbumCard.js';
import FilterBar from './components/FilterBar.js';
import GlobalPlayer from './components/player/GlobalPlayer.js';
import StatsDashboard from './components/StatsDashboard.js';
import Header from './components/Header.js';
import CookieConsent from './components/CookieConsent.js';
import Toast from './components/toasts/Toast.js';
import SimilarTracksModal from './components/SimilarTracksModal.js';
import PlaylistModal from './components/modals/PlaylistModal.js';
import DiscoveryPage from './components/DiscoveryPage.js';
import ClassifyPage from './components/ClassifyPage.js';
import ArtistPage from './components/ArtistPage.js';
import AlbumPage from './components/AlbumPage.js';
import router from './router.js';

const app = createApp({
  components: {
    'track-card': TrackCard,
    'artist-card': ArtistCard,
    'album-card': AlbumCard,
    'filter-bar': FilterBar,
    'global-player': GlobalPlayer,
    'stats-dashboard': StatsDashboard,
    'site-header': Header,
    'cookie-consent': CookieConsent,
    'toast-container': Toast,
    'similar-tracks-modal': SimilarTracksModal,
    'playlist-modal': PlaylistModal,
    'discovery-page': DiscoveryPage,
    'classify-page': ClassifyPage,
    'artist-page': ArtistPage,
    'album-page': AlbumPage,
  },
  setup() {
    const route = useRoute();
    const routerInstance = useRouter();
    const filterLogic = useFilters();
    const trackLogic = useTracks();
    const artistsLogic = useArtistsList();
    const albumsLogic = useAlbumsList();
    const playerLogic = usePlayer();
    const { togglePlay } = playerLogic;

    // Derive current page and IDs from route
    const currentPage = computed(() => route.meta.page || 'discovery');
    const currentArtistId = computed(() => route.params.id || null);
    const currentAlbumId = computed(() => route.params.id || null);

    const scrollTrigger = ref(null);
    let observer = null;

    const navigateToPage = (page) => {
      routerInstance.push({ name: page });
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

    // Sync filters to URL query params
    const syncFiltersToURL = () => {
      const filterParams = filterLogic.filtersToQueryParams();
      const query = {};
      filterParams.forEach((value, key) => {
        query[key] = value;
      });

      routerInstance.replace({ query });
    };

    // Navigation functions
    const navigateToSearch = (filters = {}) => {
      Object.assign(filterLogic.filters.value, filters);

      // Build query params from filters
      const filterParams = filterLogic.filtersToQueryParams();
      const query = {};
      filterParams.forEach((value, key) => {
        query[key] = value;
      });

      routerInstance.push({ name: 'search', query });
      trackLogic.fetchTracks();
    };

    const navigateToArtist = (artistId) => {
      routerInstance.push({ name: 'artist', params: { id: artistId } });
    };

    const navigateToAlbum = (albumId) => {
      routerInstance.push({ name: 'album', params: { id: albumId } });
    };

    const navigateToClassify = () => {
      routerInstance.push({ name: 'classify' });
    };

    onMounted(async () => {
      // Load saved queue from localStorage
      await playerLogic.loadQueueFromStorage();

      // Load filters from URL query params if present
      const urlParams = new URLSearchParams(window.location.search);
      filterLogic.loadFiltersFromQueryParams(urlParams);

      // Handle track deep link (for backwards compatibility with old URLs)
      if (route.query.track) {
        loadAndPlayTrack(route.query.track);
      } else if (route.name === 'search') {
        trackLogic.fetchTracks();
      }

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
      ...artistsLogic,
      ...albumsLogic,
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
      currentArtistId,
      currentAlbumId,
      navigateToSearch,
      navigateToPage,
      navigateToArtist,
      navigateToAlbum,
      navigateToClassify,
      addToQueue,
    };
  },
});

app.use(router);
app.config.devtools = true;
app.mount('#app');
