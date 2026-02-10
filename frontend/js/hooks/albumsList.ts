import { ref, watch, type Ref } from 'vue';
import { useFilters } from './filter';

export interface AlbumItem {
  id: string;
  [key: string]: string | number | boolean | null | undefined;
}

export function useAlbumsList() {
  const albums: Ref<AlbumItem[]> = ref([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const error = ref<string | null>(null);
  const hasMore = ref(true);
  const filterLogic = useFilters();

  const fetchAlbums = async (offset = 0): Promise<void> => {
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
      params.set('offset', String(offset));
      const response = await fetch(`/api/albums?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch albums');
      const data = (await response.json()) as { items?: AlbumItem[]; total?: number };
      const items = data.items ?? [];
      if (offset === 0) {
        albums.value = items;
      } else {
        albums.value = [...albums.value, ...items];
      }
      hasMore.value = albums.value.length < (data.total ?? 0);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error fetching albums:', err);
    } finally {
      loading.value = false;
      loadingMore.value = false;
    }
  };

  const loadMore = (): void => {
    if (!hasMore.value || loadingMore.value) return;
    fetchAlbums(albums.value.length);
  };

  watch(
    () => [filterLogic.filters.value.search, filterLogic.filters.value.searchType],
    ([search, searchType]) => {
      if (searchType === 'albums') fetchAlbums();
    },
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
