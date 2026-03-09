import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getArtist, getArtistAlbums } from '@/api/generated/artists/artists';
import type { Artist } from '@/api/models/artist';
import type { Album } from '@/api/models/album';
import { AvatarPlaceholder, IconButton, SectionTitle } from '@/ui';
import { BackArrowIcon } from '@/icons';
import { AlbumCard } from '@/components/AlbumCard';

export function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
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
    Promise.all([getArtist(id), getArtistAlbums(id)])
      .then(([artistData, albumsData]) => {
        if (!cancelled) {
          setArtist(artistData ?? null);
          setAlbums(albumsData ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Kunde inte hamta artist');
          setArtist(null);
          setAlbums([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>;
  }
  if (error || !artist) {
    return (
      <p className="text-red-600" role="alert">
        {error ?? 'Artist hittades inte.'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <IconButton aria-label="Tillbaka" onClick={() => navigate(-1)}>
        <BackArrowIcon className="h-5 w-5" aria-hidden />
      </IconButton>
      <div className="flex items-center gap-4">
        <AvatarPlaceholder size="lg" />
        <div>
          <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">
            {artist.name ?? 'Okand artist'}
          </h1>
          {artist.isVerified && (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">Verifierad artist</p>
          )}
        </div>
      </div>

      <section aria-labelledby="albums-heading">
        <SectionTitle id="albums-heading">Album</SectionTitle>
        {albums.length === 0 ? (
          <p className="mt-2 text-sm text-[rgb(var(--color-text-muted))]">
            Inga album hittades for denna artist.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {albums.map((album) => (
              <li key={album.id}>
                <AlbumCard album={album} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
