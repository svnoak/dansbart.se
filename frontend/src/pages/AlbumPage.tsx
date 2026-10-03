import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getAlbum } from '@/api/generated/albums/albums';
import type { AlbumDto } from '@/api/models/albumDto';
import { ArtworkPlaceholder, EmptyState, IconButton, PageHeader, SectionTitle } from '@/ui';
import { BackArrowIcon } from '@/icons';
import { TrackRow } from '@/components';

export function AlbumPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<AlbumDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prevId, setPrevId] = useState(id);

  if (prevId !== id) {
    setPrevId(id);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getAlbum(id)
      .then((data) => {
        if (!cancelled) setAlbum(data ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Kunde inte hämta album');
          setAlbum(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return <p className="text-[rgb(var(--color-text-muted))]">Laddar…</p>;
  }
  if (error || !album) {
    return (
      <p className="text-[rgb(var(--color-error))]" role="alert">
        {error ?? 'Album hittades inte.'}
      </p>
    );
  }

  const tracks = album.tracks ?? [];

  return (
    <div className="space-y-6">
      <IconButton aria-label="Tillbaka" onClick={() => navigate(-1)}>
        <BackArrowIcon className="h-5 w-5" aria-hidden />
      </IconButton>
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
        <ArtworkPlaceholder
          aspect="square"
          className="h-40 w-40 shrink-0 rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))]"
        />
        <PageHeader
          className="min-w-0 flex-1"
          title={album.title ?? 'Okänt album'}
          meta={album.releaseDate ? String(new Date(album.releaseDate).getFullYear()) : undefined}
          description={
            album.artist && (
              <Link
                to={`/artist/${album.artist.id ?? ''}`}
                className="font-semibold text-[rgb(var(--color-accent))] underline decoration-[rgb(var(--color-accent))]/40 underline-offset-4 hover:decoration-[rgb(var(--color-accent))]"
              >
                {album.artist.name ?? 'Okänd artist'}
              </Link>
            )
          }
        />
      </div>

      <section aria-labelledby="album-tracks-heading">
        <SectionTitle id="album-tracks-heading">Låtar</SectionTitle>
        {tracks.length === 0 ? (
          <EmptyState className="mt-3">Inga låtar i detta album.</EmptyState>
        ) : (
          <ul className="mt-3 space-y-0">
            {tracks.map((track) => (
              <li key={track.id ?? track.title}>
                <TrackRow track={track} contextTracks={tracks} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
