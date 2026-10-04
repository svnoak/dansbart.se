import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAnalyticsFlag } from '@/analytics/useAnalyticsFlag';
import { getVoterId } from '@/utils/voter';
import { Link, useSearchParams } from 'react-router-dom';
import { getTracks } from '@/api/generated/tracks/tracks';
import { getPlaylist } from '@/api/generated/playlists/playlists';
import { searchArtists, getArtists } from '@/api/generated/artists/artists';
import { searchAlbums, getAlbums } from '@/api/generated/albums/albums';
import { getStyleOverview } from '@/api/generated/discovery/discovery';
import type { TrackListDto } from '@/api/models/trackListDto';
import type { Artist } from '@/api/models/artist';
import type { Album } from '@/api/models/album';
import type { PlaylistDto } from '@/api/models/playlistDto';
import type { StyleOverviewDto } from '@/api/models/styleOverviewDto';
import {
  useSearchParamsState,
  DEFAULT_FILTERS,
  type SearchFilters,
  type SearchType,
} from '@/hooks/useSearchParamsState';
import { SearchBar } from '@/components/SearchBar';
import { FilterBar } from '@/components/FilterBar';
import { TrackRow, ArtistCard, AlbumCard } from '@/components';
import { Button, EmptyState, LoadError, RowSkeleton } from '@/ui';
import { AlbumIcon, MusicNoteIcon, UserIcon } from '@/icons';
import { activeFilterWords } from '@/utils/searchFilters';
import { canEditPlaylist } from '@/utils/playlistPermissions';
import { useAuth } from '@/auth/useAuth';

const PAGE_SIZE = 20;

const NOUNS: Record<SearchType, { one: string; many: string }> = {
  tracks: { one: 'låt', many: 'låtar' },
  artists: { one: 'artist', many: 'artister' },
  albums: { one: 'album', many: 'album' },
};

interface Loaded {
  /** Identifies the request that produced this result. */
  key: string;
  /** Identifies the list the result belongs to (everything but the offset). */
  listKey: string;
  tracks: TrackListDto[];
  artists: Artist[];
  albums: Album[];
  total: number;
  error: string | null;
}

const NOTHING_LOADED: Loaded = {
  key: '',
  listKey: '',
  tracks: [],
  artists: [],
  albums: [],
  total: 0,
  error: null,
};

interface AddToState {
  id: string;
  playlist: PlaylistDto | null;
  error: boolean;
}

function merge<T extends { id?: string }>(prev: T[], items: T[]): T[] {
  const seen = new Set(prev.map((t) => t.id));
  return [...prev, ...items.filter((t) => !seen.has(t.id))];
}

function postSearchEvent(f: SearchFilters) {
  // Track filter shape — no text query stored
  const activeFilters = [
    f.style,
    f.subStyle,
    f.source,
    f.vocals,
    f.confirmed,
    f.tempoEnabled,
    f.bouncinessEnabled,
    f.articulationEnabled,
  ].filter(Boolean).length;
  fetch('/api/analytics/interaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType: 'search',
      sessionId: getVoterId(),
      eventData: {
        style: f.style || null,
        hasQuery: Boolean(f.q),
        hasTempoFilter: f.tempoEnabled ?? false,
        hasDurationFilter: f.minDuration != null || f.maxDuration != null,
        hasBouncinessFilter: f.bouncinessEnabled ?? false,
        hasArticulationFilter: f.articulationEnabled ?? false,
        filterCount: activeFilters,
      },
    }),
  }).catch(() => {});
}

export function SearchPage() {
  useAnalyticsFlag('search');
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { filters, setFilters, toTracksParams, hasActiveFilters } = useSearchParamsState();

  // The text query is a draft until Sök or Enter. Everything else acts at once.
  // The draft follows the URL whenever the applied query changes (Sök, back button).
  const [draft, setDraft] = useState({ value: filters.q, base: filters.q });
  if (draft.base !== filters.q) {
    setDraft({ value: filters.q, base: filters.q });
  }
  const draftQuery = draft.base !== filters.q ? filters.q : draft.value;
  const setDraftQuery = useCallback(
    (value: string) => setDraft((d) => ({ ...d, value })),
    [],
  );

  const applyChange = useCallback(
    (updates: Partial<SearchFilters>) => {
      const next = { ...filters, ...updates, q: draftQuery, offset: 0 };
      setFilters({ ...updates, q: draftQuery, offset: 0 });
      postSearchEvent(next);
    },
    [draftQuery, filters, setFilters],
  );

  const clearFilters = useCallback(() => {
    setFilters({
      ...DEFAULT_FILTERS,
      q: filters.q,
      limit: filters.limit,
      searchType: filters.searchType,
      sortBy: filters.sortBy,
      sortDirection: filters.sortDirection,
      offset: 0,
    });
  }, [filters.q, filters.limit, filters.searchType, filters.sortBy, filters.sortDirection, setFilters]);

  const [styleOverview, setStyleOverview] = useState<StyleOverviewDto[] | null>(null);
  const [loaded, setLoaded] = useState<Loaded>(NOTHING_LOADED);
  const [retryCount, setRetryCount] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const addToId = searchParams.get('addTo');
  const [addToState, setAddToState] = useState<AddToState | null>(null);
  const addToLoaded = addToId != null && addToState?.id === addToId ? addToState : null;
  const addToPlaylist = addToLoaded?.playlist ?? null;
  const addToError = addToLoaded?.error ?? false;
  const canAddToPlaylist = canEditPlaylist(addToPlaylist, user?.id);

  // Load the playlist that tracks get added to
  useEffect(() => {
    if (!addToId) return;
    const controller = new AbortController();
    getPlaylist(addToId, { signal: controller.signal })
      .then((pl) => setAddToState({ id: addToId, playlist: pl, error: false }))
      .catch(() => {
        if (controller.signal.aborted) return;
        setAddToState({ id: addToId, playlist: null, error: true });
      });
    return () => controller.abort();
  }, [addToId]);

  // Fetch style overview for the style chips
  useEffect(() => {
    getStyleOverview()
      .then((data) => setStyleOverview(data ?? null))
      .catch(() => setStyleOverview([]));
  }, []);

  // What is on screen is derived from the request keys, so a change of
  // filters shows the loading state at once without an extra render.
  const { searchType, q, limit, offset } = filters;
  const listKey = useMemo(
    // JSON.stringify drops the undefined offset, so a later page keeps the same list key.
    () => JSON.stringify([searchType, q, limit, { ...toTracksParams, offset: undefined }, retryCount]),
    [searchType, q, limit, toTracksParams, retryCount],
  );
  const requestKey = `${listKey}|${offset}`;
  const sameList = loaded.listKey === listKey;
  const stale = loaded.key !== requestKey;
  const loadingMore = stale && sameList && offset > 0;
  const loading = stale && !loadingMore;
  const tracks = sameList ? loaded.tracks : [];
  const artists = sameList ? loaded.artists : [];
  const albums = sameList ? loaded.albums : [];
  const total = sameList ? loaded.total : 0;
  const error = sameList && !stale ? loaded.error : null;

  // Fetch results based on searchType and filters
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const fail = (err: unknown, fallback: string) => {
      if (signal.aborted) return;
      setLoaded({
        ...NOTHING_LOADED,
        key: requestKey,
        listKey,
        error: err instanceof Error ? err.message : fallback,
      });
    };
    const keep = <T extends { id?: string }>(prev: T[], prevListKey: string, items: T[]) =>
      offset === 0 || prevListKey !== listKey ? items : merge(prev, items);

    if (searchType === 'tracks') {
      getTracks(toTracksParams, { signal })
        .then((data) => {
          const items = data?.items ?? [];
          setLoaded((prev) => ({
            ...NOTHING_LOADED,
            key: requestKey,
            listKey,
            tracks: keep(prev.tracks, prev.listKey, items),
            total: data?.total ?? items.length,
          }));
        })
        .catch((err) => fail(err, 'Kunde inte hämta låtar'));
    } else if (searchType === 'artists') {
      const params = { limit, offset, ...(q ? { search: q } : {}) };
      const promise = q
        ? searchArtists({ q, limit, offset }, { signal })
        : getArtists(params, { signal });
      promise
        .then((data) => {
          const items = data?.items ?? [];
          setLoaded((prev) => ({
            ...NOTHING_LOADED,
            key: requestKey,
            listKey,
            artists: keep(prev.artists, prev.listKey, items),
            total: data?.total ?? items.length,
          }));
        })
        .catch((err) => fail(err, 'Kunde inte hämta artister'));
    } else {
      const params = { limit, offset, ...(q ? { search: q } : {}) };
      const promise = q
        ? searchAlbums({ q, limit, offset }, { signal })
        : getAlbums(params, { signal });
      promise
        .then((data) => {
          const items = data?.items ?? [];
          setLoaded((prev) => ({
            ...NOTHING_LOADED,
            key: requestKey,
            listKey,
            albums: keep(prev.albums, prev.listKey, items),
            total: data?.total ?? items.length,
          }));
        })
        .catch((err) => fail(err, 'Kunde inte hämta album'));
    }

    return () => controller.abort();
  }, [searchType, q, limit, offset, toTracksParams, requestKey, listKey]);

  const loadMore = useCallback(() => {
    setFilters({ offset: filters.offset + PAGE_SIZE });
  }, [filters.offset, setFilters]);

  const hasMore =
    (searchType === 'tracks' && tracks.length < total) ||
    (searchType === 'artists' && artists.length < total) ||
    (searchType === 'albums' && albums.length < total);

  // Infinite scroll: observe sentinel element
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  const noun = NOUNS[searchType] ?? NOUNS.tracks;
  const summary = useMemo(() => {
    const count = `${total.toLocaleString('sv-SE')} ${total === 1 ? noun.one : noun.many}`;
    const words = filters.searchType === 'tracks' ? activeFilterWords(filters) : [];
    if (filters.q) words.unshift(`”${filters.q}”`);
    return [count, ...words].join(' · ');
  }, [filters, noun, total]);

  const isEmpty = tracks.length === 0 && artists.length === 0 && albums.length === 0;
  const showEmpty = !loading && !error && isEmpty;
  const EmptyIcon =
    searchType === 'artists' ? UserIcon : searchType === 'albums' ? AlbumIcon : MusicNoteIcon;
  const filtersNarrow = hasActiveFilters && searchType === 'tracks';
  const emptyDescription = q
    ? filtersNarrow
      ? 'Prova ett annat sökord eller ta bort ett filter.'
      : 'Prova ett annat sökord eller stava på ett annat sätt.'
    : filtersNarrow
      ? 'Prova att ta bort ett filter, så blir urvalet större.'
      : 'Det finns inget att visa här ännu.';

  return (
    <div className="space-y-6">
      <h1 className="text-[32px] font-bold tracking-tight text-[rgb(var(--color-text))]">Sök</h1>

      {addToId && (
        <div
          className={`flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border px-4 py-3 text-[15px] ${
            addToError || !canAddToPlaylist
              ? 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] text-[rgb(var(--color-text-muted))]'
              : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text))]'
          }`}
        >
          <p>
            {addToError
              ? 'Spellistan hittades inte.'
              : !canAddToPlaylist
              ? 'Du kan inte lägga till låtar i den här spellistan.'
              : `Du lägger till låtar i ${addToPlaylist?.name ?? ''}`}
          </p>
          <Link
            to={`/playlists/${addToId}`}
            className="inline-flex min-h-11 items-center font-semibold text-[rgb(var(--color-link))] underline"
          >
            Klar
          </Link>
        </div>
      )}

      <SearchBar
        query={draftQuery}
        searchType={searchType}
        onQueryChange={setDraftQuery}
        onSearchTypeChange={(t) => applyChange({ searchType: t })}
        onSearch={() => applyChange({})}
      />

      <FilterBar
        filters={filters}
        setFilters={applyChange}
        searchType={searchType}
        styleOverview={styleOverview}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 text-[15px] font-semibold text-[rgb(var(--color-text-muted))]">
          {loading ? `Söker ${noun.many}…` : summary}
        </h2>
        {searchType === 'tracks' && (
          <div className="flex items-center gap-2">
            <label htmlFor="search-sort" className="text-[13px] font-medium text-[rgb(var(--color-text-muted))]">
              Sortera
            </label>
            <select
              id="search-sort"
              value={filters.sortBy ? `${filters.sortBy}:${filters.sortDirection || 'asc'}` : ''}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  setFilters({ sortBy: '', sortDirection: '', offset: 0 });
                } else {
                  const [field, dir] = val.split(':');
                  setFilters({ sortBy: field, sortDirection: dir, offset: 0 });
                }
              }}
              className="min-h-11 rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]"
            >
              <option value="">Standard</option>
              <option value="tempoBpm:asc">Tempo (lägst först)</option>
              <option value="tempoBpm:desc">Tempo (högst först)</option>
              <option value="durationMs:asc">Längd (kortast först)</option>
              <option value="durationMs:desc">Längd (längst först)</option>
            </select>
          </div>
        )}
      </div>

      {error && <LoadError message={error} onRetry={() => setRetryCount((n) => n + 1)} />}

      {loading && <RowSkeleton rows={6} label={`Laddar ${noun.many}`} />}

      {!loading && searchType === 'tracks' && tracks.length > 0 && (
        <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]">
          {tracks.map((track, i) => (
            <li key={track.id ?? track.title ?? `track-${i}`}>
              <TrackRow
                track={track}
                contextTracks={tracks}
                addToPlaylistId={addToId && !addToError && canAddToPlaylist ? addToId : undefined}
              />
            </li>
          ))}
        </ul>
      )}

      {!loading && searchType === 'artists' && artists.length > 0 && (
        <ul className="space-y-3">
          {artists.map((artist, i) => (
            <li key={artist.id ?? artist.name ?? `artist-${i}`}>
              <ArtistCard artist={artist} />
            </li>
          ))}
        </ul>
      )}

      {!loading && searchType === 'albums' && albums.length > 0 && (
        <ul className="space-y-3">
          {albums.map((album, i) => (
            <li key={album.id ?? album.title ?? `album-${i}`}>
              <AlbumCard album={album} />
            </li>
          ))}
        </ul>
      )}

      {showEmpty && (
        <EmptyState
          icon={<EmptyIcon className="h-7 w-7" aria-hidden />}
          title={`Inga ${noun.many} matchar`}
          description={emptyDescription}
          action={
            filtersNarrow ? (
              <Button variant="secondary" onClick={clearFilters}>
                Rensa filter
              </Button>
            ) : undefined
          }
        />
      )}

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          <p className="text-center text-sm text-[rgb(var(--color-text-muted))]">
            {loadingMore ? `Laddar fler ${noun.many}…` : `Fler ${noun.many} laddas när du skrollar.`}
          </p>
        </div>
      )}
    </div>
  );
}
