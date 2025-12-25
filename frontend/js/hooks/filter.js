import { ref, computed } from 'vue';
import { showError } from './useToast.js';

// --- SHARED STATE (Singleton) ---
// These are defined outside the function so they are shared across the entire app
const styleTree = ref({});
const isLoaded = ref(false);
const isLoading = ref(false);

const filters = ref({
  mainStyle: '',
  subStyle: '',
  search: '',
  searchType: 'tracks', // 'tracks', 'artists', or 'albums'
  source: '',
  vocals: '',
  styleConfirmed: false,
  minDuration: null,
  maxDuration: null,
});

const targetTempo = ref(130);
const tempoEnabled = ref(false);
const tempoWindow = 10;

// Audio feature filters
const minBounciness = ref(null);
const maxBounciness = ref(null);
const bouncinessEnabled = ref(false);

const minArticulation = ref(null);
const maxArticulation = ref(null);
const articulationEnabled = ref(false);

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
  } catch {
    showError();
  }
};

// --- HOOK ---
export function useFilters() {
  // Trigger fetch on first use, but the guard inside prevents duplicates
  fetchStyleTree();

  const computedMin = computed(() => targetTempo.value - tempoWindow);
  const computedMax = computed(() => targetTempo.value + tempoWindow);

  const getRangeLeftPct = computed(() => {
    const min = 60,
      max = 200;
    return Math.max(0, ((computedMin.value - min) / (max - min)) * 100);
  });

  const getRangeWidthPct = computed(() => {
    const min = 60,
      max = 200;
    return ((tempoWindow * 2) / (max - min)) * 100;
  });

  // Helper to handle badge clicks from TrackCard
  const handleFilterStyle = styleName => {
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

  // Serialize filters to URL query parameters
  const filtersToQueryParams = () => {
    const params = new URLSearchParams();

    if (filters.value.mainStyle) params.set('style', filters.value.mainStyle);
    if (filters.value.subStyle) params.set('subStyle', filters.value.subStyle);
    if (filters.value.search) params.set('q', filters.value.search);
    if (filters.value.searchType && filters.value.searchType !== 'tracks') params.set('searchType', filters.value.searchType);
    if (filters.value.source) params.set('source', filters.value.source);
    if (filters.value.vocals) params.set('vocals', filters.value.vocals);
    if (filters.value.styleConfirmed) params.set('confirmed', '1');
    if (filters.value.minDuration) params.set('minDur', filters.value.minDuration);
    if (filters.value.maxDuration) params.set('maxDur', filters.value.maxDuration);

    if (tempoEnabled.value && targetTempo.value) {
      params.set('tempo', targetTempo.value);
    }

    if (bouncinessEnabled.value) {
      if (minBounciness.value !== null) params.set('minBounce', minBounciness.value);
      if (maxBounciness.value !== null) params.set('maxBounce', maxBounciness.value);
    }

    if (articulationEnabled.value) {
      if (minArticulation.value !== null) params.set('minArt', minArticulation.value);
      if (maxArticulation.value !== null) params.set('maxArt', maxArticulation.value);
    }

    return params;
  };

  // Load filters from URL query parameters
  const loadFiltersFromQueryParams = (params) => {
    if (params.has('style')) filters.value.mainStyle = params.get('style');
    if (params.has('subStyle')) filters.value.subStyle = params.get('subStyle');
    if (params.has('q')) filters.value.search = params.get('q');
    if (params.has('searchType')) filters.value.searchType = params.get('searchType');
    if (params.has('source')) filters.value.source = params.get('source');
    if (params.has('vocals')) filters.value.vocals = params.get('vocals');
    if (params.has('confirmed')) filters.value.styleConfirmed = params.get('confirmed') === '1';
    if (params.has('minDur')) filters.value.minDuration = parseInt(params.get('minDur'));
    if (params.has('maxDur')) filters.value.maxDuration = parseInt(params.get('maxDur'));

    if (params.has('tempo')) {
      targetTempo.value = parseInt(params.get('tempo'));
      tempoEnabled.value = true;
    }

    if (params.has('minBounce')) {
      minBounciness.value = parseFloat(params.get('minBounce'));
      bouncinessEnabled.value = true;
    }
    if (params.has('maxBounce')) {
      maxBounciness.value = parseFloat(params.get('maxBounce'));
      bouncinessEnabled.value = true;
    }

    if (params.has('minArt')) {
      minArticulation.value = parseFloat(params.get('minArt'));
      articulationEnabled.value = true;
    }
    if (params.has('maxArt')) {
      maxArticulation.value = parseFloat(params.get('maxArt'));
      articulationEnabled.value = true;
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
    handleFilterStyle,
    // Audio feature filters
    minBounciness,
    maxBounciness,
    bouncinessEnabled,
    minArticulation,
    maxArticulation,
    articulationEnabled,
    // URL sync functions
    filtersToQueryParams,
    loadFiltersFromQueryParams,
  };
}
