import { ref, reactive } from 'vue';
import {
  getPopularTracks,
  getRecentTracks,
  getCuratedTracks,
  getStyleOverview,
  getCuratedPlaylists,
} from '../api/generated/discovery/discovery';

export function useDiscovery() {
  const popularTracks = ref([]);
  const recentTracks = ref([]);
  const curatedTracks = ref([]);
  const styleOverview = ref([]);
  const playlists = ref([]);

  const loading = reactive({
    popular: false,
    recent: false,
    curated: false,
    styles: false,
    playlists: false
  });

  const error = ref(null);

  // Fetch sections independently for progressive loading
  const fetchPopular = async () => {
    loading.popular = true;
    try {
      const response = await getPopularTracks({ limit: 3 });
      popularTracks.value = response.data;
    } catch (e) {
      error.value = e.message;
      popularTracks.value = [];
    } finally {
      loading.popular = false;
    }
  };

  const fetchRecent = async () => {
    loading.recent = true;
    try {
      const response = await getRecentTracks({ limit: 3 });
      recentTracks.value = response.data;
    } catch (e) {
      error.value = e.message;
      recentTracks.value = [];
    } finally {
      loading.recent = false;
    }
  };

  const fetchCurated = async () => {
    loading.curated = true;
    try {
      const response = await getCuratedTracks({ limit: 3 });
      curatedTracks.value = response.data;
    } catch (e) {
      error.value = e.message;
      curatedTracks.value = [];
    } finally {
      loading.curated = false;
    }
  };

  const fetchStyleOverview = async () => {
    loading.styles = true;
    try {
      const response = await getStyleOverview();
      styleOverview.value = response.data;
    } catch (e) {
      error.value = e.message;
      styleOverview.value = [];
    } finally {
      loading.styles = false;
    }
  };

  const fetchPlaylists = async () => {
    loading.playlists = true;
    try {
      const response = await getCuratedPlaylists();
      playlists.value = response.data;
    } catch (e) {
      error.value = e.message;
      playlists.value = [];
    } finally {
      loading.playlists = false;
    }
  };

  return {
    popularTracks,
    recentTracks,
    curatedTracks,
    styleOverview,
    playlists,
    loading,
    error,
    fetchPopular,
    fetchRecent,
    fetchCurated,
    fetchStyleOverview,
    fetchPlaylists
  };
}
