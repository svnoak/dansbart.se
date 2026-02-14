import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { GetTracksParams } from '@/api/models/getTracksParams';

export type SearchType = 'tracks' | 'artists' | 'albums';

export interface SearchFilters {
  q: string;
  searchType: SearchType;
  style: string;
  subStyle: string;
  source: string;
  vocals: string;
  confirmed: boolean;
  tempoEnabled: boolean;
  minBpm: number | null;
  maxBpm: number | null;
  minDuration: number | null;
  maxDuration: number | null;
  limit: number;
  offset: number;
}

export const DEFAULT_FILTERS: SearchFilters = {
  q: '',
  searchType: 'tracks',
  style: '',
  subStyle: '',
  source: '',
  vocals: '',
  confirmed: false,
  tempoEnabled: false,
  minBpm: null,
  maxBpm: null,
  minDuration: null,
  maxDuration: null,
  limit: 20,
  offset: 0,
};

export function filtersEqual(a: SearchFilters, b: SearchFilters): boolean {
  return (
    a.q === b.q &&
    a.searchType === b.searchType &&
    a.style === b.style &&
    a.subStyle === b.subStyle &&
    a.source === b.source &&
    a.vocals === b.vocals &&
    a.confirmed === b.confirmed &&
    a.tempoEnabled === b.tempoEnabled &&
    a.minBpm === b.minBpm &&
    a.maxBpm === b.maxBpm &&
    a.minDuration === b.minDuration &&
    a.maxDuration === b.maxDuration &&
    a.limit === b.limit &&
    a.offset === b.offset
  );
}

function parseNum(s: string | null): number | null {
  if (s == null || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseBool(s: string | null): boolean {
  return s === 'true' || s === '1';
}

export function useSearchParamsState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo((): SearchFilters => {
    const get = (key: string) => searchParams.get(key);
    return {
      q: get('q') ?? DEFAULT_FILTERS.q,
      searchType: (get('searchType') as SearchType) ?? DEFAULT_FILTERS.searchType,
      style: get('style') ?? DEFAULT_FILTERS.style,
      subStyle: get('subStyle') ?? DEFAULT_FILTERS.subStyle,
      source: get('source') ?? DEFAULT_FILTERS.source,
      vocals: get('vocals') ?? DEFAULT_FILTERS.vocals,
      confirmed: parseBool(get('confirmed')),
      tempoEnabled: parseBool(get('tempo')),
      minBpm: parseNum(get('minBpm')),
      maxBpm: parseNum(get('maxBpm')),
      minDuration: parseNum(get('minDur')),
      maxDuration: parseNum(get('maxDur')),
      limit: parseNum(get('limit')) ?? DEFAULT_FILTERS.limit,
      offset: parseNum(get('offset')) ?? DEFAULT_FILTERS.offset,
    };
  }, [searchParams]);

  const setFilters = useCallback(
    (updates: Partial<SearchFilters>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const merged = { ...filters, ...updates };

        const set = (key: string, value: string | number | boolean | null | undefined) => {
          if (value === '' || value == null || value === false) {
            next.delete(key);
          } else {
            next.set(key, String(value));
          }
        };

        set('q', merged.q);
        set('searchType', merged.searchType);
        set('style', merged.style);
        set('subStyle', merged.subStyle);
        set('source', merged.source);
        set('vocals', merged.vocals);
        set('confirmed', merged.confirmed ? true : undefined);
        set('tempo', merged.tempoEnabled ? true : undefined);
        set('minBpm', merged.minBpm ?? undefined);
        set('maxBpm', merged.maxBpm ?? undefined);
        set('minDur', merged.minDuration ?? undefined);
        set('maxDur', merged.maxDuration ?? undefined);
        set('limit', merged.limit);
        set('offset', merged.offset);

        return next;
      });
    },
    [filters, setSearchParams]
  );

  const clearFilters = useCallback(
    (keepQuery = true) => {
      setFilters({
        ...DEFAULT_FILTERS,
        q: keepQuery ? filters.q : '',
        offset: 0,
      });
    },
    [filters.q, setFilters]
  );

  const toTracksParams = useMemo((): GetTracksParams => {
    const p: GetTracksParams = {
      search: filters.q || undefined,
      mainStyle: filters.style || undefined,
      subStyle: filters.subStyle || undefined,
      source: filters.source || undefined,
      vocals: filters.vocals || undefined,
      styleConfirmed: filters.confirmed ? true : undefined,
      limit: filters.limit,
      offset: filters.offset,
    };
    if (filters.tempoEnabled) {
      if (filters.minBpm != null) p.minBpm = filters.minBpm;
      if (filters.maxBpm != null) p.maxBpm = filters.maxBpm;
    }
    if (filters.minDuration != null) p.minDuration = filters.minDuration;
    if (filters.maxDuration != null) p.maxDuration = filters.maxDuration;
    return p;
  }, [filters]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.style !== '' ||
      filters.subStyle !== '' ||
      filters.source !== '' ||
      filters.vocals !== '' ||
      filters.confirmed ||
      filters.tempoEnabled ||
      filters.minBpm != null ||
      filters.maxBpm != null ||
      filters.minDuration != null ||
      filters.maxDuration != null
    );
  }, [filters]);

  return { filters, setFilters, clearFilters, toTracksParams, hasActiveFilters };
}
