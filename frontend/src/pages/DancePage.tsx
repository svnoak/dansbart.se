import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// Generated after `npm run api:update` — helpers defined inline until then
import type { TrackListDto } from '@/api/models/trackListDto';
import { httpClient } from '@/api/http-client';

type DanceDto = {
  id?: string;
  name?: string;
  slug?: string;
  danceDescriptionUrl?: string | null;
  danstyp?: string | null;
  musik?: string | null;
  confirmedTrackCount?: number;
};

function getDance(id: string): Promise<DanceDto> {
  return httpClient(`/api/dances/${id}`);
}
function getDanceTracks(id: string): Promise<TrackListDto[]> {
  return httpClient(`/api/dances/${id}/tracks`);
}
function suggestTrack(danceId: string, trackId: string): Promise<unknown> {
  return httpClient(`/api/dances/${danceId}/tracks/${trackId}`, { method: 'POST' });
}
import { useAuth } from '@/auth/useAuth';
import { IconButton, SectionTitle, Button } from '@/ui';
import { BackArrowIcon } from '@/icons';
import { TrackRow } from '@/components/TrackRow';
import { SuggestTrackModal } from './dance/SuggestTrackModal';

export function DancePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [dance, setDance] = useState<DanceDto | null>(null);
  const [tracks, setTracks] = useState<TrackListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prevId, setPrevId] = useState(id);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestedIds, setSuggestedIds] = useState<Set<string>>(new Set());

  if (prevId !== id) {
    setPrevId(id);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    Promise.all([getDance(id), getDanceTracks(id)])
      .then(([danceData, tracksData]) => {
        if (!cancelled) {
          setDance(danceData ?? null);
          setTracks(tracksData ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Kunde inte hämta dans');
          setDance(null);
          setTracks([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSuggest = async (trackId: string) => {
    if (!id) return;
    await suggestTrack(id, trackId);
    setSuggestedIds((prev) => new Set([...prev, trackId]));
  };

  if (loading) {
    return <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>;
  }
  if (error || !dance) {
    return (
      <p className="text-red-600" role="alert">
        {error ?? 'Dansen hittades inte.'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <IconButton aria-label="Tillbaka" onClick={() => navigate(-1)}>
        <BackArrowIcon className="h-5 w-5" aria-hidden />
      </IconButton>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">
              {dance.name}
            </h1>
            {dance.danceDescriptionUrl && (
              <a
                href={dance.danceDescriptionUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Dansbeskrivning (ACLA)"
                className="text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z"
                    clipRule="evenodd"
                  />
                  <path
                    fillRule="evenodd"
                    d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            )}
          </div>
          {dance.danstyp && (
            <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">
              {dance.danstyp}
            </p>
          )}
          {dance.musik && (
            <p className="mt-0.5 text-xs text-[rgb(var(--color-text-muted))]">
              Musik: {dance.musik}
            </p>
          )}
        </div>

        {isAuthenticated && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowSuggest(true)}
          >
            Föreslå låt
          </Button>
        )}
      </div>

      <section aria-labelledby="tracks-heading">
        <SectionTitle id="tracks-heading">
          Låtar ({tracks.length})
        </SectionTitle>

        {tracks.length === 0 ? (
          <p className="mt-2 text-sm text-[rgb(var(--color-text-muted))]">
            Inga låtar länkade till denna dans ännu.
            {isAuthenticated && ' Föreslå en låt ovan!'}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-[rgb(var(--color-border))]">
            {tracks.map((track) => (
              <li key={track.id}>
                <TrackRow track={track} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {showSuggest && dance.id && (
        <SuggestTrackModal
          danceId={dance.id}
          danceName={dance.name ?? ''}
          alreadySuggestedTrackIds={new Set([
            ...tracks.map((t) => t.id ?? '').filter(Boolean),
            ...suggestedIds,
          ])}
          onSuggest={handleSuggest}
          onClose={() => setShowSuggest(false)}
        />
      )}
    </div>
  );
}
