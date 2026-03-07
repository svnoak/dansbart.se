import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getTracks } from '@/api/generated/tracks/tracks';
import { searchArtists, getArtists } from '@/api/generated/artists/artists';
import { searchAlbums, getAlbums } from '@/api/generated/albums/albums';
import { getStyleOverview } from '@/api/generated/discovery/discovery';
import type { TrackListDto } from '@/api/models/trackListDto';
import type { Artist } from '@/api/models/artist';
import type { Album } from '@/api/models/album';
import type { StyleOverviewDto } from '@/api/models/styleOverviewDto';
import {
  useSearchParamsState,
  DEFAULT_FILTERS,
  filtersEqual,
} from '@/hooks/useSearchParamsState';
import { SearchBar } from '@/components/SearchBar';
import { FilterBar } from '@/components/FilterBar';
import { TrackRow, ArtistCard, AlbumCard } from '@/components';

const PAGE_SIZE = 20;

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const { filters, setFilters, toTracksParams } = useSearchParamsState();

  const [draftFilters, setDraftFilters] = useState(filters);
  const hasUnsavedChanges = useMemo(
    () => !filtersEqual(draftFilters, filters),
    [draftFilters, filters]
  );
  const hasActiveFiltersDraft = useMemo(
    () =>
      draftFilters.style !== '' ||
      draftFilters.subStyle !== '' ||
      draftFilters.source !== '' ||
      draftFilters.vocals !== '' ||
      draftFilters.confirmed ||
      draftFilters.tempoEnabled ||
      draftFilters.minBpm != null ||
      draftFilters.maxBpm != null ||
      draftFilters.minDuration != null ||
      draftFilters.maxDuration != null ||
      draftFilters.bouncinessEnabled ||
      draftFilters.articulationEnabled,
    [draftFilters]
  );
  const applyDraft = useCallback(() => {
    setFilters({ ...draftFilters, offset: 0 });
  }, [draftFilters, setFilters]);

  const [styleOverview, setStyleOverview] = useState<StyleOverviewDto[] | null>(null);
  const [tracks, setTracks] = useState<TrackListDto[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isLoadingMoreRef = useRef(false);

  // Sync draft from URL when applied filters change (e.g. after Apply or browser back)
  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  // Sync filters from URL on mount / when search params change
  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    if (q !== filters.q) setFilters({ q, offset: 0 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- only on mount

  // Fetch style overview for filter dropdowns
  useEffect(() => {
    getStyleOverview()
      .then((data) => setStyleOverview(data ?? null))
      .catch(() => setStyleOverview([]));
  }, []);

  // Fetch results based on searchType and filters
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const isLoadingMore = filters.offset > 0;
    if (isLoadingMore) {
      setLoadingMore(true);
      isLoadingMoreRef.current = true;
    } else {
      setLoading(true);
    }
    setError(null);
    if (filters.searchType !== 'tracks' || filters.offset === 0) setTracks([]);
    if (filters.searchType !== 'artists' || filters.offset === 0) setArtists([]);
    if (filters.searchType !== 'albums' || filters.offset === 0) setAlbums([]);
    if (filters.offset === 0) setTotal(0);

    const limit = filters.limit;
    const offset = filters.offset;

    if (filters.searchType === 'tracks') {
      getTracks(toTracksParams, { signal })
        .then((data) => {
          const items = data?.items ?? [];
          const totalCount = data?.total ?? items.length;
          setTracks(offset === 0 ? items : (prev) => {
            const seen = new Set(prev.map((t) => t.id));
            return [...prev, ...items.filter((t) => !seen.has(t.id))];
          });
          setTotal(totalCount);
        })
        .catch((err) => {
          if (signal.aborted) return;
          setError(err instanceof Error ? err.message : 'Kunde inte hämta låtar');
          setTracks([]);
          setTotal(0);
        })
        .finally(() => {
          if (signal.aborted) return;
          setLoading(false);
          setLoadingMore(false);
          isLoadingMoreRef.current = false;
        });
    } else if (filters.searchType === 'artists') {
      const params = { limit, offset, ...(filters.q ? { search: filters.q } : {}) };
      const promise = filters.q
        ? searchArtists({ q: filters.q, limit, offset }, { signal })
        : getArtists(params, { signal });
      promise
        .then((data) => {
          const items = data?.items ?? [];
          const totalCount = data?.total ?? items.length;
          setArtists(offset === 0 ? items : (prev) => {
            const seen = new Set(prev.map((a) => a.id));
            return [...prev, ...items.filter((a) => !seen.has(a.id))];
          });
          setTotal(totalCount);
        })
        .catch((err) => {
          if (signal.aborted) return;
          setError(err instanceof Error ? err.message : 'Kunde inte hämta artister');
          setArtists([]);
          setTotal(0);
        })
        .finally(() => {
          if (signal.aborted) return;
          setLoading(false);
          setLoadingMore(false);
          isLoadingMoreRef.current = false;
        });
    } else {
      const params = { limit, offset, ...(filters.q ? { search: filters.q } : {}) };
      const promise = filters.q
        ? searchAlbums({ q: filters.q, limit, offset }, { signal })
        : getAlbums(params, { signal });
      promise
        .then((data) => {
          const items = data?.items ?? [];
          const totalCount = data?.total ?? items.length;
          setAlbums(offset === 0 ? items : (prev) => {
            const seen = new Set(prev.map((a) => a.id));
            return [...prev, ...items.filter((a) => !seen.has(a.id))];
          });
          setTotal(totalCount);
        })
        .catch((err) => {
          if (signal.aborted) return;
          setError(err instanceof Error ? err.message : 'Kunde inte hämta album');
          setAlbums([]);
          setTotal(0);
        })
        .finally(() => {
          if (signal.aborted) return;
          setLoading(false);
          setLoadingMore(false);
          isLoadingMoreRef.current = false;
        });
    }

    return () => controller.abort();
  }, [filters.searchType, filters.q, filters.offset, filters.limit, toTracksParams]);

  const loadMore = useCallback(() => {
    setFilters({ offset: filters.offset + PAGE_SIZE });
  }, [filters.offset, setFilters]);

  const hasMore =
    (filters.searchType === 'tracks' && tracks.length < total) ||
    (filters.searchType === 'artists' && artists.length < total) ||
    (filters.searchType === 'albums' && albums.length < total);

  // Infinite scroll: observe sentinel element
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isLoadingMoreRef.current) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">
        Sök
      </h1>

      <SearchBar
        query={draftFilters.q}
        searchType={draftFilters.searchType}
        onQueryChange={(q) => setDraftFilters((prev) => ({ ...prev, q, offset: 0 }))}
        onSearchTypeChange={(t) =>
          setDraftFilters((prev) => ({ ...prev, searchType: t, offset: 0 }))
        }
        onSearch={applyDraft}
      />

      <FilterBar
        filters={draftFilters}
        setFilters={(u) => setDraftFilters((prev) => ({ ...prev, ...u }))}
        searchType={draftFilters.searchType}
        styleOverview={styleOverview}
        onClearFilters={() =>
          setDraftFilters((prev) => ({
            ...DEFAULT_FILTERS,
            q: prev.q,
            limit: prev.limit,
            searchType: prev.searchType,
            offset: 0,
          }))
        }
        hasActiveFilters={hasActiveFiltersDraft}
        hasUnsavedChanges={hasUnsavedChanges}
        onApply={applyDraft}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
          Resultat ({total.toLocaleString('sv-SE')})
        </h2>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {loading && tracks.length === 0 && artists.length === 0 && albums.length === 0 && (
        <p className="text-[rgb(var(--color-text-muted))]">Laddar…</p>
      )}

      {!loading && filters.searchType === 'tracks' && (
        <ul className="space-y-0">
          {tracks.map((track, i) => (
            <li key={track.id ?? track.title ?? `track-${i}`}>
              <TrackRow
                track={track}
                contextTracks={tracks}
                onApplyStyleFilter={(style) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    style,
                    subStyle: '',
                    offset: 0,
                  }))
                }
              />
            </li>
          ))}
        </ul>
      )}

      {!loading && filters.searchType === 'artists' && (
        <ul className="space-y-3">
          {artists.map((artist, i) => (
            <li key={artist.id ?? artist.name ?? `artist-${i}`}>
              <ArtistCard artist={artist} />
            </li>
          ))}
        </ul>
      )}

      {!loading && filters.searchType === 'albums' && (
        <ul className="space-y-3">
          {albums.map((album, i) => (
            <li key={album.id ?? album.title ?? `album-${i}`}>
              <AlbumCard album={album} />
            </li>
          ))}
        </ul>
      )}

      {!loading &&
        tracks.length === 0 &&
        artists.length === 0 &&
        albums.length === 0 &&
        !error && (
          <p className="text-[rgb(var(--color-text-muted))]">
            Inga resultat. Prova att ändra sökord eller filter.
          </p>
        )}

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {loadingMore && (
            <p className="text-[rgb(var(--color-text-muted))]">Laddar fler…</p>
          )}
        </div>
      )}
    </div>
  );
}
