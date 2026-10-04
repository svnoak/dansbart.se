import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getAlbum } from '@/api/generated/albums/albums';
import type { AlbumDto } from '@/api/models/albumDto';
import { Card, EmptyState, IconButton, LoadError, RowSkeleton, SectionTitle } from '@/ui';
import { AlbumIcon, BackArrowIcon, MusicNoteIcon } from '@/icons';
import { TrackRow } from '@/components/TrackRow';

function trackCountLabel(count: number) {
  return count === 1 ? '1 låt' : `${count} låtar`;
}

export function AlbumPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<AlbumDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prevId, setPrevId] = useState(id);
  const [attempt, setAttempt] = useState(0);

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
          setError(err instanceof Error ? err.message : 'Kunde inte hämta albumet.');
          setAlbum(null);
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
        <RowSkeleton rows={4} label="Laddar album" />
      </div>
    );
  }
  if (error || !album) {
    return (
      <div className="space-y-6">
        {backButton}
        <LoadError message={error ?? 'Albumet hittades inte.'} onRetry={retry} />
      </div>
    );
  }

  const tracks = album.tracks ?? [];
  const year = album.releaseDate ? new Date(album.releaseDate).getFullYear() : null;

  return (
    <div className="space-y-8">
      {backButton}

      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <div
          className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text))]"
          aria-hidden
        >
          <AlbumIcon className="h-12 w-12" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
            {album.title ?? 'Okänt album'}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[rgb(var(--color-text-muted))]">
            {album.artist && (
              <>
                <Link
                  to={`/artist/${album.artist.id ?? ''}`}
                  className="font-semibold text-[rgb(var(--color-link))] hover:underline"
                >
                  {album.artist.name ?? 'Okänd artist'}
                </Link>
                <span aria-hidden>·</span>
              </>
            )}
            {year != null && (
              <>
                <span>{year}</span>
                <span aria-hidden>·</span>
              </>
            )}
            <span>{trackCountLabel(tracks.length)}</span>
          </p>
        </div>
      </Card>

      <section aria-labelledby="album-tracks-heading">
        <SectionTitle id="album-tracks-heading">Låtar</SectionTitle>
        {tracks.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={<MusicNoteIcon className="h-6 w-6" />}
            title="Inga låtar ännu"
            description="Det här albumet har inga låtar i katalogen än."
          />
        ) : (
          <ul className="mt-4 overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]">
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
