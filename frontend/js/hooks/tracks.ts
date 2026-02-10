import { ref, watch, type Ref } from 'vue';
import { useFilters } from './filter';
import { showError } from './useToast';
import { getGetTracksUrl } from '../api/generated/tracks/tracks';
import { customFetch } from '../api/custom-fetch';
import type { TrackListDto, PageResponseTrackListDto, GetTracksParams } from '../api/models';

export type { TrackListDto };

/**
 * useTracks fetches the track list via the generated API client.
 * Response type is tied to the OpenAPI spec (TrackListDto[]); if the backend
 * changes the response shape, run `npm run api:generate` and fix type errors.
 */
export function useTracks() {
  const {
    filters,
    targetTempo,
    tempoEnabled,
    computedMin,
    computedMax,
    minBounciness,
    maxBounciness,
    bouncinessEnabled,
    minArticulation,
    maxArticulation,
    articulationEnabled,
  } = useFilters();

  const tracks: Ref<TrackListDto[]> = ref([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const hasMore = ref(true);
  const offset = ref(0);
  const limit = 20;

  const fetchTracks = async (append = false): Promise<void> => {
    if (append) {
      if (loadingMore.value) return;
      if (!hasMore.value) return;
      loadingMore.value = true;
    } else {
      loading.value = true;
      offset.value = 0;
    }

    try {
      const v = (x: number | null | undefined): number | undefined =>
        x == null ? undefined : x;
      const params: GetTracksParams = {
        mainStyle: filters.value.mainStyle || undefined,
        subStyle: filters.value.subStyle || undefined,
        search: filters.value.search || undefined,
        source: filters.value.source || undefined,
        vocals: filters.value.vocals || undefined,
        styleConfirmed: filters.value.styleConfirmed ?? undefined,
        musicGenre: filters.value.traditionalOnly ? 'traditional_folk' : undefined,
        minDuration: v(filters.value.minDuration ?? undefined),
        maxDuration: v(filters.value.maxDuration ?? undefined),
        minBpm: tempoEnabled.value ? v(computedMin.value) : undefined,
        maxBpm: tempoEnabled.value ? v(computedMax.value) : undefined,
        minBounciness: bouncinessEnabled.value ? v(minBounciness.value) : undefined,
        maxBounciness: bouncinessEnabled.value ? v(maxBounciness.value) : undefined,
        minArticulation: articulationEnabled.value ? v(minArticulation.value) : undefined,
        maxArticulation: articulationEnabled.value ? v(maxArticulation.value) : undefined,
        limit,
        offset: offset.value,
      };

      const page = await customFetch<PageResponseTrackListDto>(getGetTracksUrl(params));
      const newItems = page.items ?? [];

      if (append) {
        tracks.value = [...tracks.value, ...newItems];
      } else {
        tracks.value = newItems;
      }

      if (typeof page.total !== 'undefined') {
        hasMore.value = tracks.value.length < page.total;
      } else {
        hasMore.value = newItems.length >= limit;
      }

      offset.value += newItems.length;
    } catch {
      showError();
    } finally {
      loading.value = false;
      loadingMore.value = false;
    }
  };

  const loadMore = (): void => { void fetchTracks(true); };

  let timeout: ReturnType<typeof setTimeout> | undefined;
  watch(
    [
      () => targetTempo.value,
      () => tempoEnabled.value,
      () => filters.value.mainStyle,
      () => filters.value.subStyle,
      () => filters.value.search,
      () => filters.value.source,
      () => filters.value.vocals,
      () => filters.value.styleConfirmed,
      () => filters.value.traditionalOnly,
      () => filters.value.minDuration,
      () => filters.value.maxDuration,
      () => minBounciness.value,
      () => maxBounciness.value,
      () => bouncinessEnabled.value,
      () => minArticulation.value,
      () => maxArticulation.value,
      () => articulationEnabled.value,
      () => filters.value.searchType,
    ],
    () => {
      if (filters.value.searchType !== 'tracks') return;
      clearTimeout(timeout);
      timeout = setTimeout(() => fetchTracks(false), 400);
    },
  );

  return {
    tracks,
    loading,
    loadingMore,
    hasMore,
    fetchTracks,
    loadMore,
  };
}
