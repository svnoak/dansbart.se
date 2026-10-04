import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { getFavoriteTracks } from '@/api/generated/favorites/favorites';
import type { TrackListDto } from '@/api/models/trackListDto';
import { TrackRow } from '@/components/TrackRow';
import { EmptyState, Pill, RowSkeleton } from '@/ui';
import { HeartIcon, SpotifyIcon, YouTubeIcon } from '@/icons';

type SortKey = 'added' | 'name' | 'duration' | 'tempo';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'added', label: 'Tillagd' },
  { key: 'name', label: 'Namn' },
  { key: 'duration', label: 'Längd' },
  { key: 'tempo', label: 'Tempo' },
];

const TEMPO_ORDER: Record<string, number> = {
  Slow: 0,
  SlowMed: 1,
  Medium: 2,
  Fast: 3,
  Turbo: 4,
};

const LIST_CLASS =
  'overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]';

function sortTracks(tracks: TrackListDto[], sort: SortKey): TrackListDto[] {
  const copy = [...tracks];
  switch (sort) {
    case 'name':
      return copy.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', 'sv'));
    case 'duration':
      return copy.sort((a, b) => (a.durationMs ?? 0) - (b.durationMs ?? 0));
    case 'tempo':
      return copy.sort(
        (a, b) =>
          (TEMPO_ORDER[a.tempoCategory ?? ''] ?? 99) -
          (TEMPO_ORDER[b.tempoCategory ?? ''] ?? 99),
      );
    default:
      return copy;
  }
}

function filterTracks(
  tracks: TrackListDto[],
  filterSpotify: boolean,
  filterYouTube: boolean,
): TrackListDto[] {
  return tracks.filter((t) => {
    const links = t.playbackLinks ?? [];
    if (filterSpotify && !links.some((l) => l.platform === 'SPOTIFY' && l.isWorking)) return false;
    if (filterYouTube && !links.some((l) => l.platform === 'YOUTUBE' && l.isWorking)) return false;
    return true;
  });
}

function countLabel(count: number) {
  return count === 1 ? '1 låt' : `${count} låtar`;
}

export function FavoritesPage() {
  const { isAuthenticated } = useAuth();
  const [tracks, setTracks] = useState<TrackListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>('added');
  const [filterSpotify, setFilterSpotify] = useState(false);
  const [filterYouTube, setFilterYouTube] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    getFavoriteTracks({ signal: controller.signal })
      .then(setTracks)
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [isAuthenticated]);

  const heading = (
    <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
      Favoriter
    </h1>
  );

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col gap-6">
        {heading}
        <EmptyState
          icon={<HeartIcon className="h-6 w-6" />}
          title="Spara dina favoritlåtar"
          description="Logga in för att spara låtar här och hitta dem igen på alla dina enheter."
          action={
            <Link
              to="/login"
              className="mt-1 inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] bg-[rgb(var(--color-accent))] px-5 py-2 text-sm font-semibold text-[rgb(var(--color-accent-foreground))] transition-colors hover:bg-[rgb(var(--color-accent-hover))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] focus-visible:ring-offset-2"
            >
              Logga in
            </Link>
          }
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        {heading}
        <RowSkeleton rows={5} label="Laddar favoriter" />
      </div>
    );
  }

  const sorted = sortTracks(tracks, sort);
  const displayed = filterTracks(sorted, filterSpotify, filterYouTube);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {heading}
        {tracks.length > 0 && (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">{countLabel(tracks.length)}</p>
        )}
      </div>

      {tracks.length === 0 ? (
        <EmptyState
          icon={<HeartIcon className="h-6 w-6" />}
          title="Inga favoriter ännu"
          description="Tryck på hjärtat på en låtrad för att spara låten här."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div role="group" aria-label="Sortera favoriter" className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-[rgb(var(--color-text-muted))]">Sortera</span>
              {SORT_OPTIONS.map(({ key, label }) => (
                <Pill
                  key={key}
                  active={sort === key}
                  aria-pressed={sort === key}
                  onClick={() => setSort(key)}
                >
                  {label}
                </Pill>
              ))}
            </div>
            <div role="group" aria-label="Filtrera på källa" className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-[rgb(var(--color-text-muted))]">Visa bara</span>
              <Pill
                active={filterSpotify}
                aria-pressed={filterSpotify}
                onClick={() => setFilterSpotify((s) => !s)}
                className="inline-flex items-center gap-1.5"
              >
                <SpotifyIcon className="h-3.5 w-3.5" aria-hidden />
                Spotify
              </Pill>
              <Pill
                active={filterYouTube}
                aria-pressed={filterYouTube}
                onClick={() => setFilterYouTube((s) => !s)}
                className="inline-flex items-center gap-1.5"
              >
                <YouTubeIcon className="h-3.5 w-3.5" aria-hidden />
                YouTube
              </Pill>
            </div>
          </div>

          {displayed.length === 0 ? (
            <p className="text-[15px] text-[rgb(var(--color-text-muted))]">Inga låtar matchar filtret.</p>
          ) : (
            <ul className={LIST_CLASS}>
              {displayed.map((track) => (
                <li key={track.id}>
                  <TrackRow track={track} contextTracks={displayed} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
