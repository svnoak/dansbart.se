import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { SectionTitle, Button, LoadError } from '@/ui';
import { MusicNoteIcon, BadgeCheckIcon, CalendarIcon } from '@/icons';

function formatLastAdded(iso?: string) {
  if (!iso) return '–';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return '–';
  }
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
    <div className="min-w-0 space-y-8">
      <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">
        Bibliotek
      </h1>

      <div className="space-y-3">
        <p className="text-[rgb(var(--color-text-muted))]">
          Hej! Här hittar du låtar att dansa till, sorterade efter dansstil, artist och spellista.
          {stats && (
            <> Volontärer har redan bekräftat {stats.coveragePercent ?? 0}% av låtarna.</>
          )}
        </p>
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sök låtnamn, artist…"
              className="min-h-11 w-full rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] py-2.5 pl-11 pr-5 text-base text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus-visible:border-[rgb(var(--color-accent))] focus-visible:ring-1 focus-visible:ring-[rgb(var(--color-accent))]"
              aria-label="Sök låtar, artister eller album"
            />
          </div>
          <Button type="submit" variant="primary">
            Sök
          </Button>
        </form>
      </div>

      {stats && (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-sm">
            <MusicNoteIcon className="h-4 w-4 shrink-0 text-[rgb(var(--color-accent))]" aria-hidden />
            <span className="font-medium text-[rgb(var(--color-text))]">
              {(stats.totalTracks ?? 0).toLocaleString('sv-SE')}
            </span>
            <span className="text-[rgb(var(--color-text-muted))]">låtar</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-sm">
            <BadgeCheckIcon className="h-4 w-4 shrink-0 text-[rgb(var(--color-success))]" aria-hidden />
            <span className="font-medium text-[rgb(var(--color-text))]">
              {stats.coveragePercent ?? 0}%
            </span>
            <span className="text-[rgb(var(--color-text-muted))]">kategoriserade</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-sm">
            <CalendarIcon className="h-4 w-4 shrink-0 text-[rgb(var(--color-text-muted))]" aria-hidden />
            <span className="text-[rgb(var(--color-text-muted))]">Senast tillagd</span>
            <span className="font-medium text-[rgb(var(--color-text))]">
              {formatLastAdded(stats.lastAdded)}
            </span>
          </span>
        </div>
      )}

      {/* Style shortcuts */}
      <section aria-labelledby="style-shortcuts-heading">
        <SectionTitle id="style-shortcuts-heading">
          Dansstilar
        </SectionTitle>
        {stylesError ? (
          <div className="mt-3">
            <LoadError message={stylesError} onRetry={fetchStyles} />
          </div>
        ) : loadingStyles ? (
          <p className="mt-3 text-[rgb(var(--color-text-muted))]">Laddar stilar…</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-3">
            {styles.map((s) => (
              <div key={s.style ?? ''} className="w-36 shrink-0">
                <StyleShortcutCard style={s} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Featured artists */}
      <section aria-labelledby="artists-heading">
        <SectionTitle id="artists-heading" linkTo="/artists">
          Utvalda artister
        </SectionTitle>
        {artistsError ? (
          <div className="mt-3">
            <LoadError message={artistsError} onRetry={fetchArtists} />
          </div>
        ) : loadingArtists ? (
          <p className="mt-3 text-[rgb(var(--color-text-muted))]">Laddar…</p>
        ) : artists.length === 0 ? (
          <p className="mt-3 text-[rgb(var(--color-text-muted))]">Inga artister att visa just nu.</p>
        ) : (
          <div className="mt-3 flex gap-3 overflow-x-auto scrollbar-hide pb-1">
            {artists.map((artist) => (
              <div key={artist.id ?? artist.name} className="w-36 shrink-0">
                <ArtistCard artist={artist} layout="tile" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Playlists */}
      <section aria-labelledby="playlists-heading">
        <SectionTitle id="playlists-heading" linkTo="/playlists">
          Spellistor
        </SectionTitle>
        {playlistsError ? (
          <div className="mt-3">
            <LoadError message={playlistsError} onRetry={fetchPlaylists} />
          </div>
        ) : loadingPlaylists ? (
          <p className="mt-3 text-[rgb(var(--color-text-muted))]">Laddar…</p>
        ) : playlists.length === 0 ? (
          <p className="mt-3 text-[rgb(var(--color-text-muted))]">Inga offentliga spellistor ännu.</p>
        ) : (
          <div className="mt-3 flex gap-3 overflow-x-auto scrollbar-hide pb-1">
            {playlists.map((playlist) => (
              <div key={playlist.id} className="w-36 shrink-0">
                <PlaylistShortcutCard playlist={playlist} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
