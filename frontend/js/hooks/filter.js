import { ref, computed } from 'vue';

// --- SHARED STATE (Singleton) ---
// These are defined outside the function so they are shared across the entire app
const styleTree = ref({});
const isLoaded = ref(false);
const isLoading = ref(false);

const filters = ref({
    mainStyle: '',
    subStyle: '',
    search: '',
    source: '',
    vocals: '',
    styleConfirmed: false,
    minDuration: null,
    maxDuration: null
});

const targetTempo = ref(130);
const tempoEnabled = ref(false);
const tempoWindow = 10;

// --- ACTIONS ---
const fetchStyleTree = async () => {
    if (isLoaded.value || isLoading.value) return;
    isLoading.value = true;
    
    try {
        const res = await fetch('/api/styles/tree');
        if (res.ok) {
            styleTree.value = await res.json();
            isLoaded.value = true;
        }
    } catch (e) {
        console.error("Failed to load style tree", e);
    }
};

// --- HOOK ---
export function useFilters() {
    // Trigger fetch on first use, but the guard inside prevents duplicates
    fetchStyleTree();

    const computedMin = computed(() => targetTempo.value - tempoWindow);
    const computedMax = computed(() => targetTempo.value + tempoWindow);

    const getRangeLeftPct = computed(() => {
        const min = 60, max = 200;
        return Math.max(0, ((computedMin.value - min) / (max - min)) * 100);
    });
    
    const getRangeWidthPct = computed(() => {
        const min = 60, max = 200;
        return ((tempoWindow * 2) / (max - min)) * 100;
    });

    // Helper to handle badge clicks from TrackCard
    const handleFilterStyle = (styleName) => {
        // 1. Check if it matches a Main Category directly
        if (styleTree.value[styleName]) {
            filters.value.mainStyle = styleName;
            filters.value.subStyle = '';
            return;
        }

        // 2. Otherwise, find which Main Category contains this Sub-style
        let foundMain = '';
        for (const [main, subs] of Object.entries(styleTree.value)) {
            if (subs.includes(styleName)) {
                foundMain = main;
                break;
            }
        }

        if (foundMain) {
            filters.value.mainStyle = foundMain;
            filters.value.subStyle = styleName;
        } else {
            // Fallback (rare)
            filters.value.mainStyle = '';
            filters.value.subStyle = styleName;
        }
    };

    return {
        filters,
        styleTree,
        targetTempo,
        tempoEnabled,
        computedMin,
        computedMax,
        getRangeLeftPct,
        getRangeWidthPct,
        handleFilterStyle
    };
}