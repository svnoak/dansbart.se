import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { getFavoriteTracks } from '@/api/generated/favorites/favorites';
import type { TrackListDto } from '@/api/models/trackListDto';
import { TrackCard } from '@/components/TrackCard';
import { HeartFilledIcon, SpotifyIcon, YouTubeIcon } from '@/icons';

type SortKey = 'added' | 'name' | 'duration' | 'tempo';

const TEMPO_ORDER: Record<string, number> = {
  Slow: 0,
  SlowMed: 1,
  Medium: 2,
  Fast: 3,
  Turbo: 4,
};

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

export function FavoritesPage() {
  const { isAuthenticated } = useAuth();
  const [tracks, setTracks] = useState<TrackListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>('added');
  const [filterSpotify, setFilterSpotify] = useState(false);
  const [filterYouTube, setFilterYouTube] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    getFavoriteTracks({ signal: controller.signal })
      .then(setTracks)
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <HeartFilledIcon className="h-12 w-12 text-[rgb(var(--color-text-muted))]" aria-hidden />
        <h1 className="text-xl font-semibold text-[rgb(var(--color-text))]">Favoriter</h1>
        <p className="max-w-xs text-sm text-[rgb(var(--color-text-muted))]">
          Skapa ett konto eller logga in för att spara dina favoritlåtar och lyssna på dem igen.
        </p>
        <Link
          to="/login"
          className="mt-2 rounded-lg bg-[rgb(var(--color-accent))] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Logga in
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-[rgb(var(--color-text-muted))]">
        Laddar favoriter...
      </div>
    );
  }

  const sorted = sortTracks(tracks, sort);
  const displayed = filterTracks(sorted, filterSpotify, filterYouTube);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <HeartFilledIcon className="h-6 w-6 text-red-500" aria-hidden />
        <h1 className="text-xl font-semibold text-[rgb(var(--color-text))]">Favoriter</h1>
        <span className="text-sm text-[rgb(var(--color-text-muted))]">({tracks.length})</span>
      </div>

      {tracks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-[rgb(var(--color-border))] text-xs">
            {(
              [
                { key: 'added', label: 'Tillagd' },
                { key: 'name', label: 'Namn' },
                { key: 'duration', label: 'Längd' },
                { key: 'tempo', label: 'Tempo' },
              ] as { key: SortKey; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                className={`px-3 py-1.5 transition-colors ${
                  sort === key
                    ? 'bg-[rgb(var(--color-accent))] text-white'
                    : 'text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50 hover:text-[rgb(var(--color-text))]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Filtrera Spotify"
              title="Visa endast låtar med Spotify"
              onClick={() => setFilterSpotify((s) => !s)}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                filterSpotify
                  ? 'border-[#1DB954] bg-[#1DB954]/10 text-[#1DB954]'
                  : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50'
              }`}
            >
              <SpotifyIcon className="h-3.5 w-3.5" aria-hidden />
              Spotify
            </button>
            <button
              type="button"
              aria-label="Filtrera YouTube"
              title="Visa endast låtar med YouTube"
              onClick={() => setFilterYouTube((s) => !s)}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                filterYouTube
                  ? 'border-[#FF0000] bg-[#FF0000]/10 text-[#FF0000]'
                  : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50'
              }`}
            >
              <YouTubeIcon className="h-3.5 w-3.5" aria-hidden />
              YouTube
            </button>
          </div>
        </div>
      )}

      {tracks.length === 0 && (
        <p className="text-sm text-[rgb(var(--color-text-muted))]">
          Inga favoriter än. Tryck på hjärtat på ett spår för att spara det här.
        </p>
      )}

      {displayed.length === 0 && tracks.length > 0 && (
        <p className="text-sm text-[rgb(var(--color-text-muted))]">Inga låtar matchar filtret.</p>
      )}

      <ul className="flex flex-col gap-2">
        {displayed.map((track) => (
          <li key={track.id}>
            <TrackCard track={track} contextTracks={displayed} />
          </li>
        ))}
      </ul>
    </div>
  );
}
