import { useEffect, useState } from 'react';
import { getStyleOverview } from '@/api/generated/discovery/discovery';
import { getArtists } from '@/api/generated/artists/artists';
import { getAlbums } from '@/api/generated/albums/albums';
import { getStats } from '@/api/generated/stats/stats';
import type { StyleOverviewDto } from '@/api/models/styleOverviewDto';
import type { Artist } from '@/api/models/artist';
import type { Album } from '@/api/models/album';
import type { StatsDto } from '@/api/models/statsDto';
import { StyleShortcutCard } from '@/components/StyleShortcutCard';
import { WeeklyChallengeCard } from '@/components/WeeklyChallengeCard';
import { ArtistCard, AlbumCard } from '@/components';
import { SectionTitle } from '@/ui';
import { PlaylistIcon, CheckIcon, ClockIcon } from '@/icons';

function formatLastAdded(iso?: string) {
  if (!iso) return '\u2013';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return '\u2013';
  }
}

export function HomePage() {
  const [styles, setStyles] = useState<StyleOverviewDto[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loadingStyles, setLoadingStyles] = useState(true);
  const [loadingArtists, setLoadingArtists] = useState(true);
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [stats, setStats] = useState<StatsDto | null>(null);

  useEffect(() => {
    getStats()
      .then((data) => setStats(data ?? null))
      .catch(() => setStats(null));
  }, []);

  useEffect(() => {
    getStyleOverview()
      .then((data) => setStyles(data ?? []))
      .catch(() => setStyles([]))
      .finally(() => setLoadingStyles(false));
  }, []);

  useEffect(() => {
    getArtists({ limit: 10, sort: 'random' })
      .then((data) => setArtists(data?.items ?? []))
      .catch(() => setArtists([]))
      .finally(() => setLoadingArtists(false));
  }, []);

  useEffect(() => {
    getAlbums({ limit: 8, sort: 'random' })
      .then((data) => setAlbums(data?.items ?? []))
      .catch(() => setAlbums([]))
      .finally(() => setLoadingAlbums(false));
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">
        Bibliotek
      </h1>

      {stats && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--color-border))]/50 px-2.5 py-1 text-xs text-[rgb(var(--color-text-muted))]">
            <PlaylistIcon className="h-4 w-4" aria-hidden />
            {(stats.totalTracks ?? 0).toLocaleString('sv-SE')} låtar
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--color-border))]/50 px-2.5 py-1 text-xs text-[rgb(var(--color-text-muted))]">
            <CheckIcon className="h-4 w-4 text-green-600" aria-hidden />
            {stats.coveragePercent ?? 0}% kategoriserade
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--color-border))]/50 px-2.5 py-1 text-xs text-[rgb(var(--color-text-muted))]">
            <ClockIcon className="h-4 w-4" aria-hidden />
            Tillagd: {formatLastAdded(stats.lastAdded)}
          </span>
        </div>
      )}

      {/* Style shortcuts */}
      <section aria-labelledby="style-shortcuts-heading">
        <h2 id="style-shortcuts-heading" className="sr-only">
          Genrestöd
        </h2>
        {loadingStyles ? (
          <p className="text-[rgb(var(--color-text-muted))]">Laddar stilar…</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin lg:flex-wrap lg:overflow-visible">
            {styles.slice(0, 8).map((s) => (
              <div
                key={s.style ?? ''}
                className="min-w-[140px] shrink-0 lg:min-w-0 lg:flex-1"
              >
                <StyleShortcutCard style={s} />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        {/* Trending / featured artists */}
        <section aria-labelledby="artists-heading">
          <SectionTitle
            id="artists-heading"
            linkTo="/artists"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
              </svg>
            }
          >
            Utvalda artister
          </SectionTitle>
          {loadingArtists ? (
            <p className="text-[rgb(var(--color-text-muted))]">Laddar…</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {artists.map((artist) => (
                <li key={artist.id ?? artist.name}>
                  <ArtistCard artist={artist} />
                </li>
              ))}
              {!loadingArtists && artists.length === 0 && (
                <li className="text-sm text-[rgb(var(--color-text-muted))]">
                  Inga artister att visa just nu.
                </li>
              )}
            </ul>
          )}
        </section>

        {/* Recommended albums */}
        <section aria-labelledby="albums-heading">
          <SectionTitle id="albums-heading" linkTo="/albums">
            Rekommenderade album
          </SectionTitle>
          {loadingAlbums ? (
            <p className="text-[rgb(var(--color-text-muted))]">Laddar…</p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {albums.map((album) => (
                <AlbumCard key={album.id ?? album.title} album={album} />
              ))}
              {!loadingAlbums && albums.length === 0 && (
                <p className="col-span-full text-sm text-[rgb(var(--color-text-muted))]">
                  Inga album att visa just nu.
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Sidebar-style block: Weekly challenge - visible on desktop in sidebar, so we show it here on discovery as well for mobile */}
      <section className="lg:hidden" aria-labelledby="weekly-challenge-heading">
        <h2 id="weekly-challenge-heading" className="sr-only">
          Veckans utmaning
        </h2>
        <WeeklyChallengeCard />
      </section>
    </div>
  );
}
