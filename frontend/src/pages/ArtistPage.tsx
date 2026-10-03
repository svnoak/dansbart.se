import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getArtist, getArtistAlbums } from '@/api/generated/artists/artists';
import type { Artist } from '@/api/models/artist';
import type { Album } from '@/api/models/album';
import { AvatarPlaceholder, EmptyState, IconButton, PageHeader, SectionTitle } from '@/ui';
import { BackArrowIcon, FlagIcon } from '@/icons';
import { AlbumCard } from '@/components/AlbumCard';
import { FlagArtistModal } from '@/components/FlagArtistModal';

export function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prevId, setPrevId] = useState(id);
  const [flagOpen, setFlagOpen] = useState(false);

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
          setError(err instanceof Error ? err.message : 'Kunde inte hämta artist');
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
  if (error || !artist || !id) {
    return (
      <p className="text-[rgb(var(--color-error))]" role="alert">
        {error ?? 'Artist hittades inte.'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <IconButton aria-label="Tillbaka" onClick={() => navigate(-1)}>
        <BackArrowIcon className="h-5 w-5" aria-hidden />
      </IconButton>
      <div className="flex items-start gap-4">
        <AvatarPlaceholder size="lg" />
        <PageHeader
          className="min-w-0 flex-1"
          title={artist.name ?? 'Okänd artist'}
          description={artist.isVerified ? 'Verifierad artist' : undefined}
          action={
            <IconButton aria-label="Rapportera artist" onClick={() => setFlagOpen(true)}>
              <FlagIcon className="h-5 w-5" aria-hidden />
            </IconButton>
          }
        />
      </div>
      <FlagArtistModal
        open={flagOpen}
        onClose={() => setFlagOpen(false)}
        artistId={id}
        artistName={artist.name ?? 'Okänd artist'}
      />

      <section aria-labelledby="albums-heading">
        <SectionTitle id="albums-heading">Album</SectionTitle>
        {albums.length === 0 ? (
          <EmptyState className="mt-3">Inga album hittades för denna artist.</EmptyState>
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
