import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getArtist, getArtistAlbums } from '@/api/generated/artists/artists';
import type { Artist } from '@/api/models/artist';
import type { Album } from '@/api/models/album';
import { AvatarPlaceholder, Card, EmptyState, IconButton, LoadError, RowSkeleton, SectionTitle } from '@/ui';
import { AlbumIcon, BackArrowIcon, BadgeCheckIcon, FlagIcon } from '@/icons';
import { AlbumCard } from '@/components/AlbumCard';
import { FlagArtistModal } from '@/components/FlagArtistModal';

function albumCountLabel(count: number) {
  return count === 1 ? '1 album' : `${count} album`;
}

export function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prevId, setPrevId] = useState(id);
  const [attempt, setAttempt] = useState(0);
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
          setError(err instanceof Error ? err.message : 'Kunde inte hämta artisten.');
          setArtist(null);
          setAlbums([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, attempt]);

  function retry() {
    setLoading(true);
    setError(null);
    setAttempt((n) => n + 1);
  }

  const backButton = (
    <IconButton aria-label="Gå tillbaka" onClick={() => navigate(-1)}>
      <BackArrowIcon className="h-5 w-5" aria-hidden />
    </IconButton>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {backButton}
        <RowSkeleton rows={3} label="Laddar artist" />
      </div>
    );
  }
  if (error || !artist || !id) {
    return (
      <div className="space-y-6">
        {backButton}
        <LoadError message={error ?? 'Artisten hittades inte.'} onRetry={retry} />
      </div>
    );
  }

  const name = artist.name ?? 'Okänd artist';

  return (
    <div className="space-y-8">
      {backButton}

      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <AvatarPlaceholder size="xl" name={artist.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <h1 className="min-w-0 break-words text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
              {name}
            </h1>
            <IconButton aria-label="Rapportera artist" onClick={() => setFlagOpen(true)}>
              <FlagIcon className="h-5 w-5" aria-hidden />
            </IconButton>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[rgb(var(--color-text-muted))]">
            {artist.isVerified && (
              <span className="inline-flex items-center gap-1">
                <BadgeCheckIcon className="h-4 w-4" aria-hidden />
                Verifierad artist
              </span>
            )}
            {artist.isVerified && <span aria-hidden>·</span>}
            <span>{albumCountLabel(albums.length)}</span>
          </p>
        </div>
      </Card>
      <FlagArtistModal
        open={flagOpen}
        onClose={() => setFlagOpen(false)}
        artistId={id}
        artistName={name}
      />

      <section aria-labelledby="albums-heading">
        <SectionTitle id="albums-heading">Album</SectionTitle>
        {albums.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={<AlbumIcon className="h-6 w-6" />}
            title="Inga album ännu"
            description="Vi har inte hittat några album av den här artisten."
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
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
