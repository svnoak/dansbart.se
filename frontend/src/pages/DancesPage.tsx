import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { httpClient } from '@/api/http-client';
import { getStyleOverview } from '@/api/generated/discovery/discovery';

type DanceDto = {
  id?: string;
  name?: string;
  slug?: string;
  danceDescriptionUrl?: string | null;
  danstyp?: string | null;
  musik?: string | null;
  confirmedTrackCount?: number;
};

function getDances(
  params: { limit: number; offset: number; search?: string; danstyp?: string },
  opts?: RequestInit,
): Promise<{ items: DanceDto[]; total: number }> {
  const q = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
    ...(params.search ? { search: params.search } : {}),
    ...(params.danstyp ? { danstyp: params.danstyp } : {}),
  });
  return httpClient(`/api/dances?${q}`, opts);
}
import { IconButton } from '@/ui';
import { BackArrowIcon } from '@/icons';

const PAGE_SIZE = 20;

export function DancesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const style = searchParams.get('style') ?? '';
  const offset = Number(searchParams.get('offset') ?? '0');

  const [dances, setDances] = useState<DanceDto[]>([]);
  const [total, setTotal] = useState(0);
  const [styles, setStyles] = useState<string[]>([]);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
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
        ...(style ? { danstyp: style } : {}),
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
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setDances([]);
        setTotal(0);
        setLastFetched(fetchKey);
      })
      .finally(() => {
        isLoadingMoreRef.current = false;
      });

    return () => controller.abort();
  }, [q, style, offset, fetchKey]);

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

  return (
    <div className="space-y-6">
      <IconButton aria-label="Tillbaka" onClick={() => navigate('/')}>
        <BackArrowIcon className="h-5 w-5" aria-hidden />
      </IconButton>
      <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">Danser</h1>

      <input
        type="text"
        defaultValue={q}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Sök dans..."
        className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-4 py-2 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:border-[rgb(var(--color-primary))] focus:outline-none"
      />

      <div className="min-w-[160px]">
        <label htmlFor="dance-style-filter" className="text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1 block">
          Dansstil
        </label>
        <select
          id="dance-style-filter"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:border-[rgb(var(--color-accent))]"
          aria-label="Filtrera på dansstil"
        >
          <option value="">Alla dansstilar</option>
          {styles.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        {total.toLocaleString('sv-SE')} danser
      </p>

      {loading && dances.length === 0 && (
        <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>
      )}

      {!loading && dances.length === 0 && (
        <p className="text-[rgb(var(--color-text-muted))]">Inga danser hittades.</p>
      )}

      <ul className="space-y-1">
        {dances.map((dance) => (
          <li key={dance.id}>
            <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-[rgb(var(--color-border))]/30 transition-colors">
              <Link
                to={`/dance/${dance.id}`}
                className="flex-1 text-sm font-medium text-[rgb(var(--color-text))] hover:text-[rgb(var(--color-accent))]"
              >
                {dance.name}
              </Link>
              <span className="shrink-0 text-xs text-[rgb(var(--color-text-muted))]">
                {dance.confirmedTrackCount === 1
                  ? '1 låt'
                  : `${dance.confirmedTrackCount ?? 0} låtar`}
              </span>
              {dance.danceDescriptionUrl && (
                <a
                  href={dance.danceDescriptionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))] underline underline-offset-2"
                >
                  ACLA
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {loadingMore && (
            <p className="text-[rgb(var(--color-text-muted))]">Laddar fler...</p>
          )}
        </div>
      )}
    </div>
  );
}
