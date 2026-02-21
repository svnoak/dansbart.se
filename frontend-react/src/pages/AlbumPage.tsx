import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getAlbum } from '@/api/generated/albums/albums';
import type { AlbumDto } from '@/api/models/albumDto';
import { ArtworkPlaceholder, IconButton, SectionTitle } from '@/ui';
import { BackArrowIcon } from '@/icons';
import { TrackCard } from '@/components';

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
      <p className="text-red-600" role="alert">
        {error ?? 'Album hittades inte.'}
      </p>
    );
  }

  const tracks = album.tracks ?? [];

  return (
    <div className="space-y-6">
      <IconButton aria-label="Tillbaka" onClick={() => navigate(album.artist?.id ? `/artist/${album.artist.id}` : '/')}>
        <BackArrowIcon className="h-5 w-5" aria-hidden />
      </IconButton>
      <div className="flex gap-6">
        <ArtworkPlaceholder
          aspect="square"
          className="h-40 w-40 shrink-0 rounded-[var(--radius-lg)]"
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">
            {album.title ?? 'Okänt album'}
          </h1>
          {album.artist && (
            <Link
              to={`/artist/${album.artist.id ?? ''}`}
              className="mt-1 block text-[rgb(var(--color-accent))] hover:underline"
            >
              {album.artist.name ?? 'Okänd artist'}
            </Link>
          )}
          {album.releaseDate && (
            <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">
              {new Date(album.releaseDate).getFullYear()}
            </p>
          )}
        </div>
      </div>

      <section aria-labelledby="album-tracks-heading">
        <SectionTitle id="album-tracks-heading">Låtar</SectionTitle>
        {tracks.length === 0 ? (
          <p className="mt-2 text-sm text-[rgb(var(--color-text-muted))]">
            Inga låtar i detta album.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {tracks.map((track) => (
              <li key={track.id ?? track.title}>
                <TrackCard track={track} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
