import { ref, computed, type Ref } from 'vue';
import { showError } from './useToast';

export interface FilterState {
  mainStyle: string;
  subStyle: string;
  search: string;
  searchType: 'tracks' | 'artists' | 'albums';
  source: string;
  vocals: string;
  styleConfirmed: boolean;
  traditionalOnly: boolean;
  minDuration: number | null;
  maxDuration: number | null;
}

/** Main style name -> list of sub-style names */
const styleTree = ref<Record<string, string[]>>({});
const isLoaded = ref(false);
const isLoading = ref(false);

const filters = ref<FilterState>({
  mainStyle: '',
  subStyle: '',
  search: '',
  searchType: 'tracks',
  source: '',
  vocals: '',
  styleConfirmed: false,
  traditionalOnly: false,
  minDuration: null,
  maxDuration: null,
});

const targetTempo = ref(130);
const tempoEnabled = ref(false);
const tempoWindow = 10;

const minBounciness = ref<number | null>(null);
const maxBounciness = ref<number | null>(null);
const bouncinessEnabled = ref(false);
const minArticulation = ref<number | null>(null);
const maxArticulation = ref<number | null>(null);
const articulationEnabled = ref(false);

const fetchStyleTree = async (): Promise<void> => {
  if (isLoaded.value || isLoading.value) return;
  isLoading.value = true;
  try {
    const res = await fetch('/api/styles/tree');
    if (res.ok) {
      styleTree.value = (await res.json()) as Record<string, string[]>;
      isLoaded.value = true;
    }
  } catch {
    showError();
  }
};

export function useFilters() {
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

  const handleFilterStyle = (styleName: string): void => {
    const tree = styleTree.value as Record<string, string[]>;
    if (tree[styleName]) {
      filters.value.mainStyle = styleName;
      filters.value.subStyle = '';
      return;
    }
    let foundMain = '';
    for (const [main, subs] of Object.entries(tree)) {
      if (Array.isArray(subs) && subs.includes(styleName)) {
        foundMain = main;
        break;
      }
    }
    if (foundMain) {
      filters.value.mainStyle = foundMain;
      filters.value.subStyle = styleName;
    } else {
      filters.value.mainStyle = '';
      filters.value.subStyle = styleName;
    }
  };

  const filtersToQueryParams = (): URLSearchParams => {
    const params = new URLSearchParams();
    if (filters.value.mainStyle) params.set('style', filters.value.mainStyle);
    if (filters.value.subStyle) params.set('subStyle', filters.value.subStyle);
    if (filters.value.search) params.set('q', filters.value.search);
    if (filters.value.searchType && filters.value.searchType !== 'tracks') params.set('searchType', filters.value.searchType);
    if (filters.value.source) params.set('source', filters.value.source);
    if (filters.value.vocals) params.set('vocals', filters.value.vocals);
    if (filters.value.styleConfirmed) params.set('confirmed', '1');
    if (filters.value.traditionalOnly) params.set('traditional', '1');
    if (filters.value.minDuration) params.set('minDur', String(filters.value.minDuration));
    if (filters.value.maxDuration) params.set('maxDur', String(filters.value.maxDuration));
    if (tempoEnabled.value && targetTempo.value) params.set('tempo', String(targetTempo.value));
    if (bouncinessEnabled.value) {
      if (minBounciness.value !== null) params.set('minBounce', String(minBounciness.value));
      if (maxBounciness.value !== null) params.set('maxBounce', String(maxBounciness.value));
    }
    if (articulationEnabled.value) {
      if (minArticulation.value !== null) params.set('minArt', String(minArticulation.value));
      if (maxArticulation.value !== null) params.set('maxArt', String(maxArticulation.value));
    }
    return params;
  };

  const loadFiltersFromQueryParams = (params: URLSearchParams): void => {
    if (params.has('style')) filters.value.mainStyle = params.get('style') ?? '';
    if (params.has('subStyle')) filters.value.subStyle = params.get('subStyle') ?? '';
    if (params.has('q')) filters.value.search = params.get('q') ?? '';
    if (params.has('searchType')) filters.value.searchType = (params.get('searchType') as FilterState['searchType']) ?? 'tracks';
    if (params.has('source')) filters.value.source = params.get('source') ?? '';
    if (params.has('vocals')) filters.value.vocals = params.get('vocals') ?? '';
    if (params.has('confirmed')) filters.value.styleConfirmed = params.get('confirmed') === '1';
    if (params.has('traditional')) filters.value.traditionalOnly = params.get('traditional') === '1';
    if (params.has('minDur')) filters.value.minDuration = parseInt(params.get('minDur') ?? '0', 10) || null;
    if (params.has('maxDur')) filters.value.maxDuration = parseInt(params.get('maxDur') ?? '0', 10) || null;
    if (params.has('tempo')) {
      targetTempo.value = parseInt(params.get('tempo') ?? '130', 10);
      tempoEnabled.value = true;
    }
    if (params.has('minBounce')) {
      minBounciness.value = parseFloat(params.get('minBounce') ?? '0');
      bouncinessEnabled.value = true;
    }
    if (params.has('maxBounce')) {
      maxBounciness.value = parseFloat(params.get('maxBounce') ?? '0');
      bouncinessEnabled.value = true;
    }
    if (params.has('minArt')) {
      minArticulation.value = parseFloat(params.get('minArt') ?? '0');
      articulationEnabled.value = true;
    }
    if (params.has('maxArt')) {
      maxArticulation.value = parseFloat(params.get('maxArt') ?? '0');
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
    minBounciness,
    maxBounciness,
    bouncinessEnabled,
    minArticulation,
    maxArticulation,
    articulationEnabled,
    filtersToQueryParams,
    loadFiltersFromQueryParams,
  };
}
