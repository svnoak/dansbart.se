import { ref, computed, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

export function useTracks() {
    const tracks = ref([]);
    const loading = ref(false);
    const loadingMore = ref(false);
    const hasMore = ref(true);
    const offset = ref(0);
    const limit = 20;
    
    // State
    const filters = ref({ style: '' }); 
    const targetTempo = ref(130);
    const tempoEnabled = ref(false);
    const tempoWindow = 10;

    // Computed Logic
    const computedMin = computed(() => targetTempo.value - tempoWindow);
    const computedMax = computed(() => targetTempo.value + tempoWindow);

    // Visual Helpers
    const getRangeLeftPct = computed(() => {
        const min = 60, max = 200;
        return Math.max(0, ((computedMin.value - min) / (max - min)) * 100);
    });
    
    const getRangeWidthPct = computed(() => {
        const min = 60, max = 200;
        return ((tempoWindow * 2) / (max - min)) * 100;
    });

    // API Logic
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
            if (filters.value.style) params.append('style', filters.value.style);
            
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

    // Watchers: Re-fetch when Style, Tempo Value, OR Tempo Toggle changes
    let timeout;
    watch([() => targetTempo.value, () => tempoEnabled.value, () => filters.value.style], () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fetchTracks(false), 400);
    });

    return {
        tracks, loading, loadingMore, hasMore,
        filters, 
        targetTempo, tempoEnabled,
        computedMin, computedMax, 
        getRangeLeftPct, getRangeWidthPct, 
        fetchTracks, loadMore
    };
}