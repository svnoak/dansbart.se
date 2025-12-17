import { createApp, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'; // Added nextTick
import { useTracks } from './hooks/tracks.js';
import { useFilters } from './hooks/filter.js';
import { usePlayer } from './hooks/player.js';
import { trackSession } from './analytics.js';
import { showError } from './hooks/useToast.js';

import './main.css';

import TrackCard from './components/TrackCard.js';
import FilterBar from './components/FilterBar.js';
import GlobalPlayer from './components/player/GlobalPlayer.js';
import StatsDashboard from './components/StatsDashboard.js';
import Header from './components/Header.js';
import CookieConsent from './components/CookieConsent.js';
import Toast from './components/toasts/Toast.js';

const app = createApp({
  components: {
    'track-card': TrackCard,
    'filter-bar': FilterBar,
    'global-player': GlobalPlayer,
    'stats-dashboard': StatsDashboard,
    'site-header': Header,
    'cookie-consent': CookieConsent,
    'toast-container': Toast,
  },
  setup() {
    const filterLogic = useFilters();
    const trackLogic = useTracks();
    const playerLogic = usePlayer();
    const { togglePlay } = playerLogic;

    const scrollTrigger = ref(null);
    let observer = null;

    const handlePlay = (track, sourcePreference = null) => {
      const list = trackLogic.tracks.value;
      const index = list.findIndex(t => t.id === track.id);
      if (index !== -1) {
        playerLogic.playContext(list, index, sourcePreference);
      }
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
      } catch (error) {
        console.error('Failed to load track:', error);
        // Show error toast and fall back to normal flow
        showError('Spåret kunde inte hittas');
        trackLogic.fetchTracks();
      }
    };

    onMounted(() => {
      // Check for track deep link
      const urlParams = new URLSearchParams(window.location.search);
      const trackId = urlParams.get('track');

      if (trackId) {
        // Load and play specific track
        loadAndPlayTrack(trackId);
      } else {
        // Normal flow: load track list
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
      handlePlay,
      togglePlay,
      scrollTrigger,
    };
  },
});

app.config.devtools = true;
app.mount('#app');
