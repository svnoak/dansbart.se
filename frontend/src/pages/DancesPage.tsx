import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { httpClient } from '@/api/http-client';
import { getStyleOverview } from '@/api/generated/discovery/discovery';
import { getPrimaryTrack, getDanceTracks } from '@/api/generated/dances/dances';
import { EmptyState, InlineError, LoadError, RowSkeleton } from '@/ui';
import { ChevronRightIcon, PlayIcon, StarMarkIcon } from '@/icons';
import { StylePill } from '@/components/TrackRow/StylePill';
import { getStyleColor } from '@/styles/danceStyleColors';
import { useTheme } from '@/theme/useTheme';
import { usePlayer } from '@/player/usePlayer';

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

const PAGE_SIZE = 20;

function trackCountLabel(count: number | undefined): string {
  const n = count ?? 0;
  return n === 1 ? '1 låt' : `${n.toLocaleString('sv-SE')} låtar`;
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M14 5h5v5" />
      <path d="M19 5l-9 9" />
      <path d="M17 14v4a1 1 0 01-1 1H6a1 1 0 01-1-1V8a1 1 0 011-1h4" />
    </svg>
  );
}

export function DancesPage() {
  const { play } = usePlayer();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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

  function chipStyle(styleName: string, active: boolean): CSSProperties | undefined {
    if (!active) return undefined;
    const color = getStyleColor(styleName);
    return {
      backgroundColor: isDark ? color.bgDark : color.bg,
      color: isDark ? color.textDark : color.text,
    };
  }

  const chipBase =
    'inline-flex min-h-9 items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]';
  const chipInactive =
    'border border-[rgb(var(--color-border))] bg-transparent text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))]';
  const chipInk =
    'border border-transparent bg-[rgb(var(--color-accent))] text-[rgb(var(--color-accent-foreground))]';
  const chipStyled = 'border border-transparent';

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
          Danser
        </h1>
        <p className="text-[15px] leading-relaxed text-[rgb(var(--color-text-muted))]">
          Namngivna danser med dansbeskrivning. Varje dans hör till en dansstil och har de låtar
          som dansare kopplat till den.
        </p>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]">
          <SearchIcon className="h-5 w-5" />
        </span>
        <input
          type="search"
          defaultValue={q}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök dans…"
          aria-label="Sök dans"
          className="h-12 w-full rounded-full border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] pl-12 pr-5 text-[15px] text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]"
        />
      </div>

      <div role="group" aria-label="Filtrera på dansstil" className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={style === ''}
          onClick={() => setStyle('')}
          className={`${chipBase} ${style === '' ? chipInk : chipInactive}`}
        >
          Alla
        </button>
        {styles.map((s) => {
          const active = style === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => setStyle(s)}
              className={`${chipBase} ${active ? chipStyled : chipInactive}`}
              style={chipStyle(s, active)}
            >
              {s}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-[rgb(var(--color-text-muted))]">
          {total.toLocaleString('sv-SE')} danser
        </h2>
      </div>

      {error ? (
        <LoadError
          message="Det gick inte att hämta danserna."
          onRetry={() => setReloadToken((t) => t + 1)}
        />
      ) : (
        <>
          {loading && dances.length === 0 && <RowSkeleton rows={5} label="Laddar danser" />}

          {!loading && dances.length === 0 && (
            <EmptyState
              icon={<StarMarkIcon className="h-7 w-7" aria-hidden />}
              title="Inga danser hittades"
              description="Prova ett annat sökord eller en annan dansstil."
            />
          )}

          {dances.length > 0 && (
            <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]">
              {dances.map((dance) => {
                const color = getStyleColor(dance.danceType);
                const hasTracks = (dance.confirmedTrackCount ?? 0) > 0;
                const playStyle: CSSProperties = {
                  backgroundColor: isDark ? color.bgDark : color.bg,
                  color: isDark ? color.textDark : color.text,
                };
                const metaParts = [dance.danceType, dance.music].filter(
                  (p): p is string => typeof p === 'string' && p.length > 0,
                );
                return (
                  <li
                    key={dance.id}
                    className="border-b border-[rgb(var(--color-border))] last:border-b-0"
                  >
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] md:grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 px-2 py-2.5">
                      {/* Slot 1: play control in the style colour */}
                      <div className="row-span-2 md:row-span-1 flex items-center">
                        {hasTracks ? (
                          <button
                            type="button"
                            aria-label={`Spela ${dance.name}`}
                            disabled={playingId === dance.id}
                            onClick={() => dance.id && handlePlayDance(dance.id)}
                            style={playStyle}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))] disabled:opacity-50"
                          >
                            <PlayIcon className="ml-0.5 h-5 w-5" aria-hidden />
                          </button>
                        ) : (
                          <span
                            aria-hidden
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-[rgb(var(--color-border-strong))] text-[rgb(var(--color-text-muted))]"
                          >
                            <PlayIcon className="ml-0.5 h-5 w-5" aria-hidden />
                          </span>
                        )}
                      </div>

                      {/* Slot 2: name and meta line */}
                      <div className="col-start-2 min-w-0 flex flex-col">
                        <Link
                          to={`/dance/${dance.id}`}
                          className="truncate text-[15px] font-bold leading-snug text-[rgb(var(--color-text))] hover:underline"
                        >
                          {dance.name}
                        </Link>
                        <p className="flex min-w-0 flex-wrap items-center gap-x-1 text-[13px] text-[rgb(var(--color-text-muted))]">
                          {metaParts.map((part, i) => (
                            <span key={part} className="truncate">
                              {i > 0 && <span aria-hidden> · </span>}
                              {part}
                            </span>
                          ))}
                          {dance.danceDescriptionUrl && (
                            <>
                              {metaParts.length > 0 && <span aria-hidden> · </span>}
                              <a
                                href={dance.danceDescriptionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Dansbeskrivning, öppnas i ny flik"
                                className="inline-flex min-h-6 items-center gap-1 text-[rgb(var(--color-link))] hover:underline"
                              >
                                Dansbeskrivning
                                <ExternalLinkIcon className="h-3.5 w-3.5" />
                              </a>
                            </>
                          )}
                        </p>
                      </div>

                      {/* Slot 3: style pill and track count */}
                      <div className="col-start-2 row-start-2 md:col-start-3 md:row-start-1 flex items-center gap-2.5 min-w-0">
                        {dance.danceType && (
                          <StylePill style={dance.danceType} state="confirmed" />
                        )}
                        <span className="text-[13px] text-[rgb(var(--color-text-muted))] md:w-24 truncate">
                          {hasTracks ? trackCountLabel(dance.confirmedTrackCount) : 'Inga låtar ännu'}
                        </span>
                      </div>

                      {/* Slot 4: open */}
                      <div className="col-start-3 row-span-2 md:col-start-4 md:row-span-1 flex shrink-0 items-center">
                        <Link
                          to={`/dance/${dance.id}`}
                          aria-label={`Öppna ${dance.name}`}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-accent-muted))] hover:text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]"
                        >
                          <ChevronRightIcon className="h-5 w-5" aria-hidden />
                        </Link>
                      </div>
                    </div>
                    {playErrors[dance.id ?? ''] && (
                      <div className="px-4 pb-3">
                        <InlineError>{playErrors[dance.id ?? '']}</InlineError>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              {loadingMore && (
                <p className="text-[13px] text-[rgb(var(--color-text-muted))]">Laddar fler…</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
