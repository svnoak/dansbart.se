import { ref, computed, watch } from 'vue';

export function useTracks() {
    const tracks = ref([]);
    const loading = ref(false);
    const loadingMore = ref(false);
    const hasMore = ref(true);
    const offset = ref(0);
    const limit = 20;
    
    // State
    const filters = ref({ 
        style: '',
        search: '',
        source: '',      // '', 'spotify', 'youtube'
        vocals: '',      // '', 'instrumental', 'vocals'
        minDuration: null,
        maxDuration: null
    }); 
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
            if (filters.value.search) params.append('search', filters.value.search);
            if (filters.value.source) params.append('source', filters.value.source);
            if (filters.value.vocals) params.append('vocals', filters.value.vocals);
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

    // Available dance styles (Swedish folk dance styles)
    const availableStyles = ref([
        'Polska', 'Vals', 'Schottis', 'Hambo', 'Mazurka', 
        'Slängpolska', 'Engelska', 'Polka', 'Gånglåt', 'Brudmarsch'
    ]);

    // Watchers: Re-fetch when any filter changes
    let timeout;
    watch([
        () => targetTempo.value, 
        () => tempoEnabled.value, 
        () => filters.value.style,
        () => filters.value.search,
        () => filters.value.source,
        () => filters.value.vocals,
        () => filters.value.minDuration,
        () => filters.value.maxDuration
    ], () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fetchTracks(false), 400);
    });

    return {
        tracks, loading, loadingMore, hasMore,
        filters, 
        targetTempo, tempoEnabled,
        computedMin, computedMax, 
        getRangeLeftPct, getRangeWidthPct, 
        availableStyles,
        fetchTracks, loadMore
    };
}