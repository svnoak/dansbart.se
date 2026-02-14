import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getArtist, getArtistTracks } from '@/api/generated/artists/artists';
import type { Artist } from '@/api/models/artist';
import type { Track } from '@/api/models/track';
import { AvatarPlaceholder, Card, SectionTitle } from '@/ui';
import { formatDurationMs } from '@/utils/formatDuration';

export function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    Promise.all([getArtist(id), getArtistTracks(id)])
      .then(([artistData, tracksData]) => {
        setArtist(artistData ?? null);
        setTracks(tracksData ?? []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Kunde inte hämta artist');
        setArtist(null);
        setTracks([]);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <p className="text-[rgb(var(--color-text-muted))]">Laddar…</p>;
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
      <div className="flex items-center gap-4">
        <AvatarPlaceholder size="lg" />
        <div>
          <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">
            {artist.name ?? 'Okänd artist'}
          </h1>
          {artist.isVerified && (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">Verifierad artist</p>
          )}
        </div>
      </div>

      <section aria-labelledby="tracks-heading">
        <SectionTitle id="tracks-heading">Låtar</SectionTitle>
        {tracks.length === 0 ? (
          <p className="mt-2 text-sm text-[rgb(var(--color-text-muted))]">
            Inga låtar hittades för denna artist.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {tracks.map((track) => (
              <li key={track.id}>
                <Card className="p-4">
                  <Link
                    to={`/track/${track.id ?? ''}`}
                    className="font-medium text-[rgb(var(--color-text))] hover:underline"
                  >
                    {track.title ?? 'Okänd låt'}
                  </Link>
                  {track.durationMs != null && (
                    <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">
                      {formatDurationMs(track.durationMs)}
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
