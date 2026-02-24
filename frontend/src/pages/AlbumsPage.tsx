import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getAlbums } from '@/api/generated/albums/albums';
import type { Album } from '@/api/models/album';
import { AlbumCard } from '@/components';
import { IconButton } from '@/ui';
import { BackArrowIcon } from '@/icons';

const PAGE_SIZE = 20;

export function AlbumsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const offset = Number(searchParams.get('offset') ?? '0');

  const [albums, setAlbums] = useState<Album[]>([]);
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

    getAlbums(params, { signal: controller.signal })
      .then((data) => {
        const items = data?.items ?? [];
        const totalCount = data?.total ?? items.length;
        setAlbums(
          offset === 0
            ? items
            : (prev) => {
                const seen = new Set(prev.map((a) => a.id));
                return [...prev, ...items.filter((a) => !seen.has(a.id))];
              },
        );
        setTotal(totalCount);
        setLastFetched(fetchKey);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setAlbums([]);
        setTotal(0);
        setLastFetched(fetchKey);
      })
      .finally(() => {
        isLoadingMoreRef.current = false;
      });

    return () => controller.abort();
  }, [q, offset, fetchKey]);

  const hasMore = albums.length < total;

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
      <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">
        Album
      </h1>

      <input
        type="text"
        defaultValue={q}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Sök album..."
        className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-4 py-2 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:border-[rgb(var(--color-primary))] focus:outline-none"
      />

      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        {total.toLocaleString('sv-SE')} album
      </p>

      {loading && albums.length === 0 && (
        <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>
      )}

      {!loading && albums.length === 0 && (
        <p className="text-[rgb(var(--color-text-muted))]">
          Inga album hittades.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {albums.map((album, i) => (
          <AlbumCard key={album.id ?? album.title ?? `album-${i}`} album={album} />
        ))}
      </div>

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
