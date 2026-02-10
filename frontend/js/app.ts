import { createApp, onMounted, onUnmounted, ref, watch, nextTick, computed, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTracks } from './hooks/tracks';
import { useFilters } from './hooks/filter';
import { usePlayer } from './hooks/player';
import { useArtistsList } from './hooks/artistsList';
import { useAlbumsList } from './hooks/albumsList';
import { useAuthConfig } from './hooks/useAuthConfig';
import { trackSession } from './analytics';
import { showError, showToast } from './hooks/useToast';
import type { TrackWithPlayback } from './hooks/player';

import './main.css';

import TrackCard from './components/TrackCard';
import ArtistCard from './components/ArtistCard';
import AlbumCard from './components/AlbumCard';
import FilterBar from './components/FilterBar';
import GlobalPlayer from './components/player/GlobalPlayer';
import StatsDashboard from './components/StatsDashboard';
import Header from './components/Header';
import CookieConsent from './components/CookieConsent';
import Toast from './components/toasts/Toast';
import SimilarTracksModal from './components/SimilarTracksModal';
import PlaylistModal from './components/modals/PlaylistModal';
import DiscoveryPage from './components/DiscoveryPage';
import SearchPage from './components/SearchPage';
import ClassifyPage from './components/ClassifyPage';
import ArtistPage from './components/ArtistPage';
import AlbumPage from './components/AlbumPage';
import router from './router';

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
    'search-page': SearchPage,
    'classify-page': ClassifyPage,
    'artist-page': ArtistPage,
    'album-page': AlbumPage,
  },
  setup() {
    useAuthConfig().fetchAuthConfig();
    const route = useRoute();
    const routerInstance = useRouter();
    const filterLogic = useFilters();
    const trackLogic = useTracks();
    const artistsLogic = useArtistsList();
    const albumsLogic = useAlbumsList();
    const playerLogic = usePlayer();
    const { togglePlay } = playerLogic;

    const currentPage = computed(() => (route.meta.page as string) || 'discovery');
    const currentArtistId = computed(() => (route.params.id as string) || null);
    const currentAlbumId = computed(() => (route.params.id as string) || null);

    const scrollTrigger = ref<HTMLElement | null>(null);
    let observer: IntersectionObserver | null = null;

    const navigateToPage = (page: string): void => {
      routerInstance.push({ name: page });
    };

    const handlePlay = (track: TrackWithPlayback, sourcePreference: 'youtube' | 'spotify' | null = null): void => {
      const list = trackLogic.tracks.value;
      const index = list.findIndex(t => t.id === track.id);
      if (index !== -1) {
        playerLogic.playContext(list, index, sourcePreference);
      }
    };

    const handleDiscoveryPlay = (track: TrackWithPlayback, sourcePreference: 'youtube' | 'spotify' | null = null): void => {
      playerLogic.playContext([track], 0, sourcePreference);
    };

    const similarModalTrackId = ref<string | null>(null);
    const similarTracks = ref<TrackWithPlayback[]>([]);

    const showSimilarModal = (trackId: string): void => {
      similarModalTrackId.value = trackId;
    };

    const closeSimilarModal = (): void => {
      similarModalTrackId.value = null;
      similarTracks.value = [];
    };

    const addToQueue = (track: TrackWithPlayback): void => {
      const success = playerLogic.addToQueue(track);
      const title = (track as { title?: string }).title ?? 'Låt';
      if (success) {
        showToast(`"${title}" tillagd i kön`, 'success');
      } else {
        showToast(`"${title}" finns redan i kön`, 'info');
      }
    };

    const handleSimilarPlay = (track: TrackWithPlayback, sourcePreference: 'youtube' | 'spotify' | null = null): void => {
      if (similarTracks.value.length > 0) {
        const index = similarTracks.value.findIndex(t => t.id === track.id);
        if (index !== -1) {
          playerLogic.playContext(similarTracks.value, index, sourcePreference);
          return;
        }
      }
      playerLogic.playContext([track], 0, sourcePreference);
    };

    const createObserver = (): void => {
      if (observer) observer.disconnect();
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry?.isIntersecting && !trackLogic.loading.value && !trackLogic.loadingMore.value) {
            trackLogic.loadMore();
          }
        },
        { root: null, rootMargin: '200px', threshold: 0 },
      );
      if (scrollTrigger.value) {
        observer.observe(scrollTrigger.value);
      }
    };

    const loadAndPlayTrack = async (trackId: string): Promise<void> => {
      try {
        const response = await fetch(`/api/tracks/${trackId}`);
        if (!response.ok) throw new Error('Track not found');
        const track = (await response.json()) as TrackWithPlayback;
        playerLogic.playContext([track], 0);
        trackLogic.fetchTracks();
      } catch {
        showError('Låten kunde inte hittas');
        trackLogic.fetchTracks();
      }
    };

    const syncFiltersToURL = (): void => {
      const filterParams = filterLogic.filtersToQueryParams();
      const query: Record<string, string> = {};
      filterParams.forEach((value, key) => {
        query[key] = value;
      });
      routerInstance.replace({ query });
    };

    const navigateToSearch = (
      filters: Record<string, string | number | boolean | null | undefined> = {},
    ): void => {
      Object.assign(filterLogic.filters.value, filters);
      const filterParams = filterLogic.filtersToQueryParams();
      const query: Record<string, string> = {};
      filterParams.forEach((value, key) => {
        query[key] = value;
      });
      routerInstance.push({ name: 'search', query });
      trackLogic.fetchTracks();
    };

    const navigateToArtist = (artistId: string): void => {
      routerInstance.push({ name: 'artist', params: { id: artistId } });
    };

    const navigateToAlbum = (albumId: string): void => {
      routerInstance.push({ name: 'album', params: { id: albumId } });
    };

    const navigateToClassify = (): void => {
      routerInstance.push({ name: 'classify' });
    };

    onMounted(async () => {
      await playerLogic.loadQueueFromStorage();
      const urlParams = new URLSearchParams(window.location.search);
      filterLogic.loadFiltersFromQueryParams(urlParams);
      const trackQuery = route.query.track;
      if (trackQuery) {
        const id = Array.isArray(trackQuery) ? trackQuery[0] : trackQuery;
        if (id) loadAndPlayTrack(id);
      } else if (route.name === 'search') {
        trackLogic.fetchTracks();
      }
      trackSession();
    });

    onUnmounted(() => {
      if (observer) observer.disconnect();
    });

    const loading = computed(() => {
      const searchType = filterLogic.filters.value.searchType;
      if (searchType === 'tracks') return trackLogic.loading.value;
      if (searchType === 'artists') return artistsLogic.loading.value;
      if (searchType === 'albums') return albumsLogic.loading.value;
      return false;
    });

    const loadingMore = computed(() => {
      const searchType = filterLogic.filters.value.searchType;
      if (searchType === 'tracks') return trackLogic.loadingMore.value;
      if (searchType === 'artists') return artistsLogic.loadingMore.value;
      if (searchType === 'albums') return albumsLogic.loadingMore.value;
      return false;
    });

    const hasMore = computed(() => {
      const searchType = filterLogic.filters.value.searchType;
      if (searchType === 'tracks') return trackLogic.hasMore.value;
      if (searchType === 'artists') return artistsLogic.hasMore.value;
      if (searchType === 'albums') return albumsLogic.hasMore.value;
      return false;
    });

    watch(
      () => currentPage.value,
      (newPage) => {
        if (newPage === 'search' && filterLogic.filters.value.searchType === 'tracks') {
          trackLogic.fetchTracks();
        } else if (newPage === 'search' && filterLogic.filters.value.searchType === 'artists') {
          artistsLogic.fetchArtists();
        } else if (newPage === 'search' && filterLogic.filters.value.searchType === 'albums') {
          albumsLogic.fetchAlbums();
        }
      },
      { immediate: true },
    );

    watch(
      () => loading.value,
      async (isLoading) => {
        if (!isLoading) {
          await nextTick();
          createObserver();
        }
      },
    );

    watch(scrollTrigger, (el) => {
      if (el) createObserver();
    });

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
        if (currentPage.value === 'search') syncFiltersToURL();
      },
      { deep: true },
    );

    return {
      tracks: trackLogic.tracks,
      artists: artistsLogic.artists,
      albums: albumsLogic.albums,
      loading,
      loadingMore,
      hasMore,
      fetchTracks: trackLogic.fetchTracks,
      loadMore: trackLogic.loadMore,
      fetchArtists: artistsLogic.fetchArtists,
      fetchAlbums: albumsLogic.fetchAlbums,
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
// @ts-expect-error Vue devtools flag not typed in AppConfig
app.config.devtools = true;
app.mount('#app');
