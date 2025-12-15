import { ref, watch } from 'vue';
import { useFilters } from './filter.js';

export function useTracks() {
    const { filters, targetTempo, tempoEnabled, computedMin, computedMax } = useFilters();

    const tracks = ref([]);
    const loading = ref(false);
    const loadingMore = ref(false);
    const hasMore = ref(true);
    const offset = ref(0);
    const limit = 20;

    const fetchTracks = async (append = false) => {
        if (append) {
            if (loadingMore.value) return;
            if (!hasMore.value) return; 
            loadingMore.value = true;
        } else {
            loading.value = true;
            offset.value = 0;
            // Note: We don't empty tracks here immediately to avoid flickering
            // We replace them after the fetch returns
        }

        try {
            const params = new URLSearchParams();
            
            // Append filters
            if (filters.value.mainStyle) params.append('main_style', filters.value.mainStyle);
            if (filters.value.subStyle) params.append('sub_style', filters.value.subStyle);
            if (filters.value.search) params.append('search', filters.value.search);
            if (filters.value.source) params.append('source', filters.value.source);
            if (filters.value.vocals) params.append('vocals', filters.value.vocals);
            if (filters.value.styleConfirmed) params.append('style_confirmed', filters.value.styleConfirmed);
            if (filters.value.minDuration) params.append('min_duration', filters.value.minDuration);
            if (filters.value.maxDuration) params.append('max_duration', filters.value.maxDuration);

            if (tempoEnabled.value) {
                params.append('min_bpm', computedMin.value);
                params.append('max_bpm', computedMax.value);
            }

            params.append('limit', limit);
            params.append('offset', offset.value);

            // Fetch
            const response = await fetch(`/api/tracks?${params.toString()}`);
            if (!response.ok) throw new Error('Network error');
            
            const data = await response.json();
            const newItems = data.items || [];

            // Update List
            if (append) {
                tracks.value = [...tracks.value, ...newItems];
            } else {
                tracks.value = newItems;
            }

            // --- THE FIX IS HERE ---
            // Calculate hasMore based on total vs loaded count
            if (typeof data.total !== 'undefined') {
                // If the server tells us the total, compare current length to total
                hasMore.value = tracks.value.length < data.total;
            } else {
                // Fallback: If we got a full page (20 items), assume there might be more
                hasMore.value = newItems.length >= limit;
            }

            console.log(`Loaded ${tracks.value.length} of ${data.total || '?'} tracks. HasMore: ${hasMore.value}`);

            // Update offset for next batch
            offset.value += newItems.length;

        } catch (error) {
            console.error("Error fetching tracks:", error);
            // On error, we might want to reset loading states
        } finally {
            loading.value = false;
            loadingMore.value = false;
        }
    };

    const loadMore = () => fetchTracks(true);

    // Watchers for filters
    let timeout;
    watch([
        () => targetTempo.value,
        () => tempoEnabled.value,
        () => filters.value.mainStyle,
        () => filters.value.subStyle,
        () => filters.value.search,
        () => filters.value.source,
        () => filters.value.vocals,
        () => filters.value.styleConfirmed,
        () => filters.value.minDuration,
        () => filters.value.maxDuration
    ], () => {
        // Debounce filter changes
        clearTimeout(timeout);
        timeout = setTimeout(() => fetchTracks(false), 400);
    });

    return {
        tracks, loading, loadingMore, hasMore,
        fetchTracks, loadMore
    };
}