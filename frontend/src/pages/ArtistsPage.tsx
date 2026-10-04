import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getArtists } from '@/api/generated/artists/artists';
import type { Artist } from '@/api/models/artist';
import { ArtistCard } from '@/components/ArtistCard';
import { EmptyState, IconButton, RowSkeleton } from '@/ui';
import { BackArrowIcon, UserIcon } from '@/icons';

const PAGE_SIZE = 20;

export function ArtistsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const offset = Number(searchParams.get('offset') ?? '0');

  const [items, setItems] = useState<Artist[]>([]);
  const [total, setTotal] = useState(0);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isLoadingMoreRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchKey = `${q}|${offset}`;
  const loading = lastFetched === null || (offset === 0 && lastFetched !== fetchKey);
  const loadingMore = offset > 0 && lastFetched !== fetchKey;

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

  useEffect(() => {
    const controller = new AbortController();
    isLoadingMoreRef.current = offset > 0;

    const params = {
      limit: PAGE_SIZE,
      offset,
      ...(q ? { search: q } : {}),
    };

    getArtists(params, { signal: controller.signal })
      .then((data) => {
        const page = data?.items ?? [];
        const totalCount = data?.total ?? page.length;
        setItems(
          offset === 0
            ? page
            : (prev) => {
                const seen = new Set(prev.map((item) => item.id));
                return [...prev, ...page.filter((item) => !seen.has(item.id))];
              },
        );
        setTotal(totalCount);
        setLastFetched(fetchKey);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setItems([]);
        setTotal(0);
        setLastFetched(fetchKey);
      })
      .finally(() => {
        isLoadingMoreRef.current = false;
      });

    return () => controller.abort();
  }, [q, offset, fetchKey]);

  const hasMore = items.length < total;

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
      <IconButton aria-label="Gå till startsidan" onClick={() => navigate('/')}>
        <BackArrowIcon className="h-5 w-5" aria-hidden />
      </IconButton>

      <div className="space-y-1">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
          Artister
        </h1>
        <p className="text-sm text-[rgb(var(--color-text-muted))]">
          {total.toLocaleString('sv-SE')} artister
        </p>
      </div>

      <div>
        <label htmlFor="artists-search" className="sr-only">
          Sök artister
        </label>
        <input
          id="artists-search"
          type="search"
          defaultValue={q}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök artister"
          className="h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-4 text-[15px] text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus-visible:border-[rgb(var(--color-focus))] focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] focus-visible:ring-offset-2"
        />
      </div>

      {loading && items.length === 0 ? (
        <RowSkeleton rows={5} label="Laddar artister" />
      ) : !loading && items.length === 0 ? (
        <EmptyState
          icon={<UserIcon className="h-6 w-6" />}
          title="Inga artister hittades"
          description={q ? 'Prova ett annat sökord.' : 'Det finns inga artister i katalogen än.'}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item, i) => (
            <li key={item.id ?? `item-${i}`}>
              <ArtistCard artist={item} />
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-4" aria-live="polite">
          {loadingMore && (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">Laddar fler…</p>
          )}
        </div>
      )}
    </div>
  );
}
