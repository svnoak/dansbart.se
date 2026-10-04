import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAnalyticsFlag } from '@/analytics/useAnalyticsFlag';
import { getStyleOverview } from '@/api/generated/discovery/discovery';
import { getArtists } from '@/api/generated/artists/artists';
import { getPublicPlaylists } from '@/api/generated/playlists/playlists';
import { getStats } from '@/api/generated/stats/stats';
import type { StyleOverviewDto } from '@/api/models/styleOverviewDto';
import type { Artist } from '@/api/models/artist';
import type { PlaylistListItemDto } from '@/api/models/playlistListItemDto';
import type { StatsDto } from '@/api/models/statsDto';
import { StyleShortcutCard } from '@/components/StyleShortcutCard';
import { ArtistCard, PlaylistShortcutCard } from '@/components';
import { SectionTitle, Button, Card, LoadError, RowSkeleton } from '@/ui';
import { MusicNoteIcon, StarMarkIcon } from '@/icons';

/** A check inside a circle, 1.5 px stroke like the other Iconoir icons. */
function CircleCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function StatPill({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <span className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] pl-3 pr-3.5 text-sm">
      <span className="shrink-0 text-[rgb(var(--color-text))]" aria-hidden>
        {icon}
      </span>
      <span className="font-semibold tabular-nums text-[rgb(var(--color-text))]">{value}</span>
      <span className="text-[rgb(var(--color-text-muted))]">{label}</span>
    </span>
  );
}

export function HomePage() {
  useAnalyticsFlag('library');
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [styles, setStyles] = useState<StyleOverviewDto[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistListItemDto[]>([]);
  const [loadingStyles, setLoadingStyles] = useState(true);
  const [loadingArtists, setLoadingArtists] = useState(true);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [stylesError, setStylesError] = useState<string | null>(null);
  const [artistsError, setArtistsError] = useState<string | null>(null);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsDto | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await getStats();
      setStats(data ?? null);
    } catch {
      setStats(null);
    }
  }, []);

  const fetchStyles = useCallback(async () => {
    setLoadingStyles(true);
    setStylesError(null);
    try {
      const data = await getStyleOverview();
      setStyles(data ?? []);
    } catch {
      setStylesError('Kunde inte hämta dansstilarna.');
    } finally {
      setLoadingStyles(false);
    }
  }, []);

  const fetchArtists = useCallback(async () => {
    setLoadingArtists(true);
    setArtistsError(null);
    try {
      const data = await getArtists({ limit: 10, sort: 'random' });
      setArtists(data?.items ?? []);
    } catch {
      setArtistsError('Kunde inte hämta artisterna.');
    } finally {
      setLoadingArtists(false);
    }
  }, []);

  const fetchPlaylists = useCallback(async () => {
    setLoadingPlaylists(true);
    setPlaylistsError(null);
    try {
      const data = await getPublicPlaylists({ size: 8 });
      setPlaylists(data?.items ?? []);
    } catch {
      setPlaylistsError('Kunde inte hämta spellistorna.');
    } finally {
      setLoadingPlaylists(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchStyles();
  }, [fetchStyles]);

  useEffect(() => {
    fetchArtists();
  }, [fetchArtists]);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    navigate(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
  }

  return (
    <div className="min-w-0 space-y-10">
      <div className="space-y-5">
        <div className="space-y-3">
          <h1 className="text-[36px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
            Musik att dansa till
          </h1>
          {stats && (
            <div className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-hide">
              <StatPill
                icon={<MusicNoteIcon className="h-4 w-4" />}
                value={(stats.totalTracks ?? 0).toLocaleString('sv-SE')}
                label="låtar"
              />
              <StatPill
                icon={<CircleCheckIcon className="h-4 w-4" />}
                value={`${stats.coveragePercent ?? 0} %`}
                label="bekräftade"
              />
            </div>
          )}
        </div>

        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]">
              <SearchIcon className="h-5 w-5" />
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sök låt, artist eller album"
              className="h-13 w-full rounded-full border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] pl-12 pr-5 text-base text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus-visible:border-[rgb(var(--color-focus))] focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] focus-visible:ring-offset-2"
              aria-label="Sök låtar, artister eller album"
            />
          </div>
          <Button type="submit" variant="primary" size="lg" className="h-13 rounded-full px-7">
            Sök
          </Button>
        </form>
      </div>

      {/* Dance styles */}
      <section id="dansstilar" aria-labelledby="style-shortcuts-heading" className="scroll-mt-6">
        <SectionTitle id="style-shortcuts-heading" aside="Elva stilar. Välj en för att se låtarna.">
          Dansstilar
        </SectionTitle>
        {stylesError ? (
          <div className="mt-4">
            <LoadError message={stylesError} onRetry={fetchStyles} />
          </div>
        ) : loadingStyles ? (
          <RowSkeleton rows={3} label="Laddar dansstilar" className="mt-4" />
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {styles.map((s) => (
              <li key={s.style ?? 'okand-stil'} className="min-w-0">
                <StyleShortcutCard style={s} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Featured artists */}
      <section aria-labelledby="artists-heading">
        <SectionTitle id="artists-heading" linkTo="/artists">
          Utvalda artister
        </SectionTitle>
        {artistsError ? (
          <div className="mt-4">
            <LoadError message={artistsError} onRetry={fetchArtists} />
          </div>
        ) : loadingArtists ? (
          <RowSkeleton rows={2} label="Laddar artister" className="mt-4" />
        ) : artists.length === 0 ? (
          <p className="mt-4 text-[15px] text-[rgb(var(--color-text-muted))]">Inga artister att visa just nu.</p>
        ) : (
          <ul className="scrollbar-hide -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {artists.map((artist) => (
              <li key={artist.id ?? artist.name} className="shrink-0">
                <ArtistCard artist={artist} layout="tile" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Public playlists */}
      <section aria-labelledby="playlists-heading">
        <SectionTitle id="playlists-heading" linkTo="/playlists">
          Offentliga spellistor
        </SectionTitle>
        {playlistsError ? (
          <div className="mt-4">
            <LoadError message={playlistsError} onRetry={fetchPlaylists} />
          </div>
        ) : loadingPlaylists ? (
          <RowSkeleton rows={2} label="Laddar spellistor" className="mt-4" />
        ) : playlists.length === 0 ? (
          <p className="mt-4 text-[15px] text-[rgb(var(--color-text-muted))]">Inga offentliga spellistor ännu.</p>
        ) : (
          <ul className="scrollbar-hide -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {playlists.map((playlist) => (
              <li key={playlist.id} className="w-[150px] shrink-0">
                <PlaylistShortcutCard playlist={playlist} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Community */}
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5">
        <StarMarkIcon className="h-9 w-9 shrink-0 text-[rgb(var(--color-link))]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-[rgb(var(--color-text))]">Tack till alla som bekräftar</p>
          <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">
            Du kan rösta utan konto, direkt på en låtrad eller när du lyssnar.
          </p>
        </div>
        <Link
          to="/search"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[var(--radius)] bg-[rgb(var(--color-accent-muted))] px-4 py-2 text-sm font-semibold text-[rgb(var(--color-text))] transition-colors hover:bg-[rgb(var(--color-border))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] focus-visible:ring-offset-2"
        >
          Låtar utan stil
        </Link>
      </Card>
    </div>
  );
}
