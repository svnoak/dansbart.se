import { ref, watch } from 'vue';
import { useFilters } from './filter.js';

export function useArtistsList() {
  const artists = ref([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const error = ref(null);
  const hasMore = ref(true);

  const filterLogic = useFilters();

  const fetchArtists = async (offset = 0) => {
    if (offset === 0) {
      loading.value = true;
      artists.value = [];
    } else {
      loadingMore.value = true;
    }

    error.value = null;

    try {
      const params = new URLSearchParams();

      if (filterLogic.filters.value.search) {
        params.set('search', filterLogic.filters.value.search);
      }

      params.set('limit', '20');
      params.set('offset', offset.toString());

      const response = await fetch(`/api/artists?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch artists');
      }

      const data = await response.json();

      if (offset === 0) {
        artists.value = data.items;
      } else {
        artists.value = [...artists.value, ...data.items];
      }

      hasMore.value = artists.value.length < data.total;
    } catch (err) {
      error.value = err.message;
      console.error('Error fetching artists:', err);
    } finally {
      loading.value = false;
      loadingMore.value = false;
    }
  };

  const loadMore = () => {
    if (!hasMore.value || loadingMore.value) return;
    fetchArtists(artists.value.length);
  };

  // Watch for filter changes
  watch(
    () => [filterLogic.filters.value.search, filterLogic.filters.value.searchType],
    ([search, searchType]) => {
      if (searchType === 'artists') {
        fetchArtists();
      }
    }
  );

  return {
    artists,
    loading,
    loadingMore,
    error,
    hasMore,
    fetchArtists,
    loadMore,
  };
}
