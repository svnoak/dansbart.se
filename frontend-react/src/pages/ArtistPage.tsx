import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getArtist, getArtistAlbums } from '@/api/generated/artists/artists';
import type { Artist } from '@/api/models/artist';
import type { Album } from '@/api/models/album';
import { AvatarPlaceholder, IconButton, SectionTitle } from '@/ui';
import { AlbumCard } from '@/components/AlbumCard';

export function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    Promise.all([getArtist(id), getArtistAlbums(id)])
      .then(([artistData, albumsData]) => {
        setArtist(artistData ?? null);
        setAlbums(albumsData ?? []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Kunde inte hamta artist');
        setArtist(null);
        setAlbums([]);
      })
      .finally(() => setLoading(false));
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
      <IconButton aria-label="Tillbaka" onClick={() => navigate('/')}>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
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
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {albums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
