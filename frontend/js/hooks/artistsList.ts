import { ref, watch, type Ref } from 'vue';
import { useFilters } from './filter';

export interface ArtistItem {
  id: string;
  [key: string]: string | number | boolean | null | undefined;
}

export function useArtistsList() {
  const artists: Ref<ArtistItem[]> = ref([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const error = ref<string | null>(null);
  const hasMore = ref(true);
  const filterLogic = useFilters();

  const fetchArtists = async (offset = 0): Promise<void> => {
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
      params.set('offset', String(offset));
      const response = await fetch(`/api/artists?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch artists');
      const data = (await response.json()) as { items?: ArtistItem[]; total?: number };
      const items = data.items ?? [];
      if (offset === 0) {
        artists.value = items;
      } else {
        artists.value = [...artists.value, ...items];
      }
      hasMore.value = artists.value.length < (data.total ?? 0);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error fetching artists:', err);
    } finally {
      loading.value = false;
      loadingMore.value = false;
    }
  };

  const loadMore = (): void => {
    if (!hasMore.value || loadingMore.value) return;
    fetchArtists(artists.value.length);
  };

  watch(
    () => [filterLogic.filters.value.search, filterLogic.filters.value.searchType],
    ([_search, searchType]) => {
      if (searchType === 'artists') fetchArtists();
    },
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
