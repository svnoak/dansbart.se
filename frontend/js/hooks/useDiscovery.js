import { ref, reactive } from 'vue';

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
      const res = await fetch('/api/discovery/popular?limit=3');
      if (!res.ok) throw new Error('Failed to fetch popular tracks');
      popularTracks.value = await res.json();
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
      const res = await fetch('/api/discovery/recent?limit=3');
      if (!res.ok) throw new Error('Failed to fetch recent tracks');
      recentTracks.value = await res.json();
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
      const res = await fetch('/api/discovery/curated?limit=3');
      if (!res.ok) throw new Error('Failed to fetch curated tracks');
      curatedTracks.value = await res.json();
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
      const res = await fetch('/api/discovery/by-style');
      if (!res.ok) throw new Error('Failed to fetch style overview');
      styleOverview.value = await res.json();
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
      const res = await fetch('/api/discovery/playlists');
      if (!res.ok) throw new Error('Failed to fetch playlists');
      playlists.value = await res.json();
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
