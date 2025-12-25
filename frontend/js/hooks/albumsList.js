import { ref, watch } from 'vue';
import { useFilters } from './filter.js';

export function useAlbumsList() {
  const albums = ref([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const error = ref(null);
  const hasMore = ref(true);

  const filterLogic = useFilters();

  const fetchAlbums = async (offset = 0) => {
    if (offset === 0) {
      loading.value = true;
      albums.value = [];
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

      const response = await fetch(`/api/albums?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch albums');
      }

      const data = await response.json();

      if (offset === 0) {
        albums.value = data.items;
      } else {
        albums.value = [...albums.value, ...data.items];
      }

      hasMore.value = albums.value.length < data.total;
    } catch (err) {
      error.value = err.message;
      console.error('Error fetching albums:', err);
    } finally {
      loading.value = false;
      loadingMore.value = false;
    }
  };

  const loadMore = () => {
    if (!hasMore.value || loadingMore.value) return;
    fetchAlbums(albums.value.length);
  };

  // Watch for filter changes
  watch(
    () => [filterLogic.filters.value.search, filterLogic.filters.value.searchType],
    ([search, searchType]) => {
      if (searchType === 'albums') {
        fetchAlbums();
      }
    }
  );

  return {
    albums,
    loading,
    loadingMore,
    error,
    hasMore,
    fetchAlbums,
    loadMore,
  };
}
