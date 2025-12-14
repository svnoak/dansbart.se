import { ref, watch } from 'vue';
import { useFilters } from './filter.js';

export function useTracks() {
    // Import shared state
    const { filters, targetTempo, tempoEnabled, computedMin, computedMax } = useFilters();

    const tracks = ref([]);
    const loading = ref(false);
    const loadingMore = ref(false);
    const hasMore = ref(true);
    const offset = ref(0);
    const limit = 20;

    // --- Fetch Tracks ---
    const fetchTracks = async (append = false) => {
        if (append) {
            if (loadingMore.value || !hasMore.value) return;
            loadingMore.value = true;
        } else {
            loading.value = true;
            offset.value = 0;
            tracks.value = [];
        }

        try {
            const params = new URLSearchParams();
            
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

            const response = await fetch(`/api/tracks?${params.toString()}`);
            if (!response.ok) throw new Error('Network error');
            
            const data = await response.json();
            
            if (append) {
                tracks.value = [...tracks.value, ...data.items];
            } else {
                tracks.value = data.items;
            }
            
            hasMore.value = data.has_more;
            offset.value += data.items.length;
        } catch (error) {
            console.error("Error fetching tracks:", error);
        } finally {
            loading.value = false;
            loadingMore.value = false;
        }
    };

    const loadMore = () => fetchTracks(true);

    // Watchers: Re-fetch when shared filter state changes
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
        clearTimeout(timeout);
        timeout = setTimeout(() => fetchTracks(false), 400);
    });

    return {
        tracks, loading, loadingMore, hasMore,
        fetchTracks, loadMore
    };
}