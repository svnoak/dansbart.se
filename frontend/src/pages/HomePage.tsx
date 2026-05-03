import { useEffect, useState } from 'react';
import { useAnalyticsFlag } from '@/analytics/useAnalyticsFlag';
import { getStyleOverview } from '@/api/generated/discovery/discovery';
import { getArtists } from '@/api/generated/artists/artists';
import { getAlbums } from '@/api/generated/albums/albums';
import { getStats } from '@/api/generated/stats/stats';
import type { StyleOverviewDto } from '@/api/models/styleOverviewDto';
import type { Artist } from '@/api/models/artist';
import type { Album } from '@/api/models/album';
import type { StatsDto } from '@/api/models/statsDto';
import { StyleShortcutCard } from '@/components/StyleShortcutCard';
import { ArtistCard, AlbumCard } from '@/components';
import { SectionTitle } from '@/ui';
import { MusicNoteIcon, BadgeCheckIcon, CalendarIcon } from '@/icons';

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
  useAnalyticsFlag('library');
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
    <div className="min-w-0 space-y-8">
      <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">
        Bibliotek
      </h1>

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
            <BadgeCheckIcon className="h-4 w-4 shrink-0 text-green-500" aria-hidden />
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
        <h2 id="style-shortcuts-heading" className="sr-only">
          Genrestöd
        </h2>
        {loadingStyles ? (
          <p className="text-[rgb(var(--color-text-muted))]">Laddar stilar…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {styles.map((s) => (
              <div key={s.style ?? ''} className="w-36">
                <StyleShortcutCard style={s} />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        {/* Trending / featured artists */}
        <section aria-labelledby="artists-heading" className="min-w-0">
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
        <section aria-labelledby="albums-heading" className="min-w-0">
          <SectionTitle id="albums-heading" linkTo="/albums">
            Rekommenderade album
          </SectionTitle>
          {loadingAlbums ? (
            <p className="text-[rgb(var(--color-text-muted))]">Laddar…</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {albums.map((album) => (
                <li key={album.id ?? album.title}>
                  <AlbumCard album={album} />
                </li>
              ))}
              {!loadingAlbums && albums.length === 0 && (
                <li className="text-sm text-[rgb(var(--color-text-muted))]">
                  Inga album att visa just nu.
                </li>
              )}
            </ul>
          )}
        </section>
      </div>

    </div>
  );
}
