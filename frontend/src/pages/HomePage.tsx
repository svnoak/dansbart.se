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
import { SectionTitle, Button, LoadError, PageHeader, SearchField } from '@/ui';
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
    <div className="min-w-0 space-y-10">
      <div className="space-y-4">
        <PageHeader
          title="Bibliotek"
          description={
            <>
              Hej! Här hittar du låtar att dansa till, sorterade efter dansstil, artist och spellista.
              {stats && (
                <> Volontärer har redan bekräftat {stats.coveragePercent ?? 0}% av låtarna.</>
              )}
            </>
          }
        />
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchField
            label="Sök låtar, artister eller album"
            size="lg"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Sök låtnamn, artist…"
            className="flex-1"
          />
          <Button type="submit" variant="primary" size="lg" className="min-h-12">
            Sök
          </Button>
        </form>
      </div>

      {stats && (
        <dl className="grid grid-cols-1 overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] shadow-[var(--color-card-shadow)] sm:grid-cols-3">
          <div className="flex items-center gap-3 border-b border-[rgb(var(--color-border))] px-4 py-3 sm:border-b-0 sm:border-r">
            <MusicNoteIcon className="h-5 w-5 shrink-0 text-[rgb(var(--color-accent))]" aria-hidden />
            <div>
              <dd className="font-display text-2xl font-semibold leading-none text-[rgb(var(--color-text))]">
                {(stats.totalTracks ?? 0).toLocaleString('sv-SE')}
              </dd>
              <dt className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">låtar i biblioteket</dt>
            </div>
          </div>
          <div className="flex items-center gap-3 border-b border-[rgb(var(--color-border))] px-4 py-3 sm:border-b-0 sm:border-r">
            <BadgeCheckIcon className="h-5 w-5 shrink-0 text-[rgb(var(--color-selected))]" aria-hidden />
            <div>
              <dd className="font-display text-2xl font-semibold leading-none text-[rgb(var(--color-text))]">
                {stats.coveragePercent ?? 0} %
              </dd>
              <dt className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">bekräftade av volontärer</dt>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <CalendarIcon className="h-5 w-5 shrink-0 text-[rgb(var(--color-now-playing))]" aria-hidden />
            <div>
              <dd className="font-display text-2xl font-semibold leading-none text-[rgb(var(--color-text))]">
                {formatLastAdded(stats.lastAdded)}
              </dd>
              <dt className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">senast tillagd</dt>
            </div>
          </div>
        </dl>
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
