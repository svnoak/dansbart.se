import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { httpClient } from '@/api/http-client';
import { getStyleOverview } from '@/api/generated/discovery/discovery';
import { getPrimaryTrack, getDanceTracks } from '@/api/generated/dances/dances';

type DanceDto = {
  id?: string;
  name?: string;
  slug?: string;
  danceDescriptionUrl?: string | null;
  danceType?: string | null;
  music?: string | null;
  confirmedTrackCount?: number;
};

function getDances(
  params: { limit: number; offset: number; search?: string; danceType?: string },
  opts?: RequestInit,
): Promise<{ items: DanceDto[]; total: number }> {
  const q = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
    ...(params.search ? { search: params.search } : {}),
    ...(params.danceType ? { danceType: params.danceType } : {}),
  });
  return httpClient(`/api/dances?${q}`, opts);
}
import { EmptyState, InlineError, ListRow, LoadError, PageHeader, SearchField, SelectField } from '@/ui';
import { usePlayer } from '@/player/usePlayer';

const PAGE_SIZE = 20;

export function DancesPage() {
  const { play } = usePlayer();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const style = searchParams.get('style') ?? '';
  const offset = Number(searchParams.get('offset') ?? '0');

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playErrors, setPlayErrors] = useState<Record<string, string>>({});
  const [dances, setDances] = useState<DanceDto[]>([]);
  const [total, setTotal] = useState(0);
  const [styles, setStyles] = useState<string[]>([]);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isLoadingMoreRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchKey = `${q}|${style}|${offset}`;
  const loading = lastFetched === null || (offset === 0 && lastFetched !== fetchKey);
  const loadingMore = offset > 0 && lastFetched !== fetchKey;

  useEffect(() => {
    getStyleOverview().then((data) => {
      setStyles(data.map((s) => s.style ?? '').filter(Boolean));
    }).catch(() => {});
  }, []);

  const setQuery = useCallback(
    (value: string) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          if (value) {
            next.set('q', value);
          } else {
            next.delete('q');
          }
          next.delete('offset');
          return next;
        });
      }, 300);
    },
    [setSearchParams],
  );

  const setStyle = useCallback(
    (value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) {
          next.set('style', value);
        } else {
          next.delete('style');
        }
        next.delete('offset');
        return next;
      });
    },
    [setSearchParams],
  );

  useEffect(() => {
    const controller = new AbortController();
    isLoadingMoreRef.current = offset > 0;

    getDances(
      {
        limit: PAGE_SIZE,
        offset,
        ...(q ? { search: q } : {}),
        ...(style ? { danceType: style } : {}),
      },
      { signal: controller.signal },
    )
      .then((data) => {
        const items = data?.items ?? [];
        const totalCount = data?.total ?? items.length;
        setDances(
          offset === 0
            ? items
            : (prev) => {
                const seen = new Set(prev.map((d) => d.id));
                return [...prev, ...items.filter((d) => !seen.has(d.id))];
              },
        );
        setTotal(totalCount);
        setLastFetched(fetchKey);
        setError(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setDances([]);
        setTotal(0);
        setLastFetched(fetchKey);
        if (offset === 0) setError(true);
      })
      .finally(() => {
        isLoadingMoreRef.current = false;
      });

    return () => controller.abort();
  }, [q, style, offset, fetchKey, reloadToken]);

  const hasMore = dances.length < total;

  const loadMore = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('offset', String(offset + PAGE_SIZE));
      return next;
    });
  }, [offset, setSearchParams]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isLoadingMoreRef.current) {
          loadMore();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  async function handlePlayDance(danceId: string) {
    if (playingId === danceId) return;
    setPlayingId(danceId);
    setPlayErrors((prev) => {
      const next = { ...prev };
      delete next[danceId];
      return next;
    });
    try {
      try {
        const track = await getPrimaryTrack(danceId);
        play(track);
        return;
      } catch {
        // No primary track set — fall back to first confirmed track
      }
      const tracks = await getDanceTracks(danceId);
      if (tracks.length > 0) {
        play(tracks[0]);
      } else {
        setPlayErrors((prev) => ({ ...prev, [danceId]: 'Inga låtar länkade till denna dans' }));
      }
    } catch {
      setPlayErrors((prev) => ({ ...prev, [danceId]: 'Kunde inte spela' }));
    } finally {
      setPlayingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Danser" meta={`${total.toLocaleString('sv-SE')} danser`} />

      <div className="grid gap-3 sm:grid-cols-[1fr_minmax(12rem,16rem)] sm:items-end">
        <SearchField
          label="Sök danser"
          defaultValue={q}
          onChange={setQuery}
          placeholder="Sök dans…"
        />
        <SelectField id="dance-style-filter" label="Dansstil" value={style} onChange={setStyle}>
          <option value="">Alla dansstilar</option>
          {styles.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </SelectField>
      </div>

      {error ? (
        <LoadError
          message="Det gick inte att hämta danserna."
          onRetry={() => setReloadToken((t) => t + 1)}
        />
      ) : (
        <>
          {loading && dances.length === 0 && (
            <p className="text-[rgb(var(--color-text-muted))]">Laddar…</p>
          )}

          {!loading && dances.length === 0 && (
            <EmptyState>Inga danser hittades.</EmptyState>
          )}

          <ul className="space-y-2">
            {dances.map((dance) => (
              <li key={dance.id} className="space-y-1">
                <ListRow
                  to={`/dance/${dance.id}`}
                  title={dance.name}
                  play={{
                    label: `Spela ${dance.name}`,
                    disabled: playingId === dance.id,
                    onPlay: () => dance.id && handlePlayDance(dance.id),
                  }}
                  trailing={
                    <>
                      <span>
                        {dance.confirmedTrackCount === 1
                          ? '1 låt'
                          : `${dance.confirmedTrackCount ?? 0} låtar`}
                      </span>
                      {dance.danceDescriptionUrl && (
                        <a
                          href={dance.danceDescriptionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[rgb(var(--color-accent))] underline decoration-[rgb(var(--color-accent))]/40 underline-offset-4 hover:decoration-[rgb(var(--color-accent))]"
                        >
                          Dansbeskrivning
                        </a>
                      )}
                    </>
                  }
                />
                <InlineError>{playErrors[dance.id ?? '']}</InlineError>
              </li>
            ))}
          </ul>

          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              {loadingMore && (
                <p className="text-[rgb(var(--color-text-muted))]">Laddar fler…</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
