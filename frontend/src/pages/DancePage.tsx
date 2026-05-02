import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { TrackListDto } from '@/api/models/trackListDto';
import { httpClient } from '@/api/http-client';
import { getVoterId } from '@/utils/voter';
import { useAuth } from '@/auth/useAuth';
import { usePlayer } from '@/player/usePlayer';
import { IconButton, SectionTitle, Button } from '@/ui';
import { BackArrowIcon } from '@/icons';
import { TrackRow } from '@/components/TrackRow';
import { PlayButton } from '@/components/TrackRow/PlayButton';
import { getStyleColor } from '@/styles/danceStyleColors';
import { SuggestTrackModal } from './dance/SuggestTrackModal';

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
function getConfirmedTracks(id: string): Promise<TrackListDto[]> {
  return httpClient(`/api/dances/${id}/tracks`);
}
function getMatchingDanceTracks(id: string): Promise<TrackListDto[]> {
  return httpClient(`/api/dances/${id}/passande`);
}
function getRecommendations(
  danceId: string,
  params: { limit: number; offset: number },
): Promise<{ items: TrackListDto[]; total: number }> {
  const q = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) });
  return httpClient(`/api/dances/${danceId}/recommendations?${q}`);
}
function suggestTrack(danceId: string, trackId: string): Promise<unknown> {
  return httpClient(`/api/dances/${danceId}/tracks/${trackId}`, { method: 'POST' });
}
function postVote(danceId: string, trackId: string, vote: 'up' | 'down'): Promise<unknown> {
  return httpClient(`/api/dances/${danceId}/tracks/${trackId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Voter-ID': getVoterId() },
    body: JSON.stringify({ vote }),
  });
}
function deleteVote(danceId: string, trackId: string): Promise<unknown> {
  return httpClient(`/api/dances/${danceId}/tracks/${trackId}/vote`, {
    method: 'DELETE',
    headers: { 'X-Voter-ID': getVoterId() },
  });
}

const REC_PAGE_SIZE = 5;

export function DancePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { play, currentTrack, isPlaying } = usePlayer();

  const [dance, setDance] = useState<DanceDto | null>(null);
  const [confirmedTracks, setConfirmedTracks] = useState<TrackListDto[]>([]);
  const [matchingTracks, setMatchingTracks] = useState<TrackListDto[]>([]);
  const [recommendations, setRecommendations] = useState<TrackListDto[]>([]);
  const [recTotal, setRecTotal] = useState(0);
  const [recOffset, setRecOffset] = useState(0);
  const [recLoading, setRecLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prevId, setPrevId] = useState(id);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestedIds, setSuggestedIds] = useState<Set<string>>(new Set());
  const [votes, setVotes] = useState<Record<string, 'up' | 'down'>>({});

  if (prevId !== id) {
    setPrevId(id);
    setLoading(true);
    setError(null);
    setConfirmedTracks([]);
    setMatchingTracks([]);
    setRecommendations([]);
    setRecTotal(0);
    setRecOffset(0);
    setVotes({});
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    Promise.all([
      getDance(id),
      getConfirmedTracks(id),
      getMatchingDanceTracks(id),
      getRecommendations(id, { limit: REC_PAGE_SIZE, offset: 0 }),
    ])
      .then(([danceData, confirmedData, matchingData, recsData]) => {
        if (!cancelled) {
          setDance(danceData ?? null);
          setConfirmedTracks(confirmedData ?? []);
          setMatchingTracks(matchingData ?? []);
          setRecommendations(recsData?.items ?? []);
          setRecTotal(recsData?.total ?? 0);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Kunde inte hämta dans');
          setDance(null);
          setConfirmedTracks([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id]);

  const loadMoreRecs = useCallback(() => {
    if (!id || recLoading) return;
    const nextOffset = recOffset + REC_PAGE_SIZE;
    setRecLoading(true);
    getRecommendations(id, { limit: REC_PAGE_SIZE, offset: nextOffset })
      .then((data) => {
        setRecommendations((prev) => [...prev, ...(data?.items ?? [])]);
        setRecTotal(data?.total ?? 0);
        setRecOffset(nextOffset);
      })
      .catch(() => {})
      .finally(() => setRecLoading(false));
  }, [id, recOffset, recLoading]);

  const handleVote = useCallback(
    (track: TrackListDto, newVote: 'up' | 'down') => {
      if (!dance?.id || !track.id) return;
      const currentVote = votes[track.id];

      if (currentVote === newVote) {
        // Toggle off — move back from matching tracks to recommendations
        setVotes((prev) => { const n = { ...prev }; delete n[track.id!]; return n; });
        if (newVote === 'up') {
          setMatchingTracks((prev) => prev.filter((t) => t.id !== track.id));
          setRecommendations((prev) => [track, ...prev]);
        }
        deleteVote(dance.id!, track.id).catch(() => {});
      } else {
        setVotes((prev) => ({ ...prev, [track.id!]: newVote }));
        if (newVote === 'up') {
          // Promote to matching dance tracks (shown in Låtar)
          setRecommendations((prev) => prev.filter((t) => t.id !== track.id));
          setMatchingTracks((prev) => [track, ...prev]);
        }
        postVote(dance.id!, track.id, newVote).catch(() => {});
      }
    },
    [dance?.id, votes],
  );

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

  const allTracks = [...confirmedTracks, ...matchingTracks];
  const hasMoreRecs = recommendations.length < recTotal;

  return (
    <div className="space-y-6">
      <IconButton aria-label="Tillbaka" onClick={() => navigate(-1)}>
        <BackArrowIcon className="h-5 w-5" aria-hidden />
      </IconButton>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">{dance.name}</h1>
            {dance.danceDescriptionUrl && (
              <a
                href={dance.danceDescriptionUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Dansbeskrivning (ACLA)"
                className="text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" />
                </svg>
              </a>
            )}
          </div>
          {dance.danstyp && (
            <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">{dance.danstyp}</p>
          )}
          {dance.musik && (
            <p className="mt-0.5 text-xs text-[rgb(var(--color-text-muted))]">Musik: {dance.musik}</p>
          )}
        </div>

        {isAuthenticated && (
          <Button variant="secondary" size="sm" onClick={() => setShowSuggest(true)}>
            Föreslå låt
          </Button>
        )}
      </div>

      <section aria-labelledby="tracks-heading">
        <SectionTitle id="tracks-heading">Låtar ({allTracks.length})</SectionTitle>
        {allTracks.length === 0 ? (
          <p className="mt-2 text-sm text-[rgb(var(--color-text-muted))]">
            Inga låtar länkade till denna dans ännu.
            {isAuthenticated && ' Föreslå en låt ovan!'}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-[rgb(var(--color-border))]">
            {allTracks.map((track) => (
              <li key={track.id}>
                <TrackRow track={track} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {dance.danstyp && (
        <section aria-labelledby="recommendations-heading">
          <SectionTitle id="recommendations-heading">Förslag på musik</SectionTitle>

          {recommendations.length === 0 && !recLoading ? (
            <p className="mt-2 text-sm text-[rgb(var(--color-text-muted))]">Inga förslag hittades.</p>
          ) : (
            <>
              <ul className="mt-2 divide-y divide-[rgb(var(--color-border))]">
                {recommendations.map((track) => (
                  <RecommendationRow
                    key={track.id}
                    track={track}
                    vote={votes[track.id ?? '']}
                    currentTrackId={currentTrack?.id}
                    isPlaying={isPlaying}
                    contextTracks={recommendations}
                    onPlay={play}
                    onVote={handleVote}
                  />
                ))}
              </ul>

              {hasMoreRecs && (
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={loadMoreRecs}
                    disabled={recLoading}
                    className="text-sm text-[rgb(var(--color-accent))] hover:underline disabled:opacity-50"
                  >
                    {recLoading ? 'Laddar...' : 'Visa fler'}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {showSuggest && dance.id && (
        <SuggestTrackModal
          danceId={dance.id}
          danceName={dance.name ?? ''}
          alreadySuggestedTrackIds={new Set([
            ...allTracks.map((t) => t.id ?? '').filter(Boolean),
            ...suggestedIds,
          ])}
          onSuggest={handleSuggest}
          onClose={() => setShowSuggest(false)}
        />
      )}
    </div>
  );
}

interface RecommendationRowProps {
  track: TrackListDto;
  vote: 'up' | 'down' | undefined;
  currentTrackId: string | undefined;
  isPlaying: boolean;
  contextTracks: TrackListDto[];
  onPlay: (track: TrackListDto, context?: TrackListDto[]) => void;
  onVote: (track: TrackListDto, vote: 'up' | 'down') => void;
}

function RecommendationRow({
  track,
  vote,
  currentTrackId,
  isPlaying,
  contextTracks,
  onPlay,
  onVote,
}: RecommendationRowProps) {
  const styleColor = getStyleColor(track.danceStyle);
  const isCurrent = currentTrackId === track.id;

  return (
    <li className="flex items-center gap-2 px-2 py-2.5">
      <PlayButton
        track={track}
        isCurrent={isCurrent}
        isPlaying={isPlaying}
        styleColor={styleColor}
        onPlay={() => onPlay(track, contextTracks)}
      />
      <div className="min-w-0 flex-1 flex flex-col">
        <p className="truncate text-sm font-bold text-[rgb(var(--color-text))]">
          {track.title ?? 'Okänd låt'}
        </p>
        <p className="truncate text-xs text-[rgb(var(--color-text-muted))]">
          {track.artistName ?? 'Okänd artist'}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          aria-label="Bra förslag"
          onClick={() => onVote(track, 'up')}
          className={`rounded p-1 transition-colors hover:bg-[rgb(var(--color-border))]/40 ${vote === 'up' ? 'text-green-500' : 'text-[rgb(var(--color-text-muted))]'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
            <path d="M1 8.25a1.25 1.25 0 112.5 0v7.5a1.25 1.25 0 11-2.5 0v-7.5zM11 3V1.7c0-.268.14-.526.395-.607A2 2 0 0114 3c0 .995-.182 1.948-.514 2.826-.204.54.166 1.174.744 1.174h2.52c1.243 0 2.261 1.01 2.146 2.247a23.864 23.864 0 01-1.341 5.974C17.153 16.323 16.07 17 14.9 17h-3.192a3 3 0 01-1.341-.317l-2.734-1.366A3 3 0 006.292 15H5V8h.963c.685 0 1.258-.483 1.612-1.068a4.011 4.011 0 012.166-1.73c.432-.143.853-.386 1.011-.814.16-.432.248-.9.248-1.388z" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Dåligt förslag"
          onClick={() => onVote(track, 'down')}
          className={`rounded p-1 transition-colors hover:bg-[rgb(var(--color-border))]/40 ${vote === 'down' ? 'text-red-500' : 'text-[rgb(var(--color-text-muted))]'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
            <path d="M18.905 12.75a1.25 1.25 0 11-2.5 0v-7.5a1.25 1.25 0 012.5 0v7.5zM8.905 17v1.3c0 .268-.14.526-.395.607A2 2 0 015.905 17c0-.995.182-1.948.514-2.826.204-.54-.166-1.174-.744-1.174h-2.52c-1.243 0-2.261-1.01-2.146-2.247.193-2.016.76-3.957 1.341-5.974C2.752 3.678 3.835 3 5.005 3h3.192a3 3 0 011.341.317l2.734 1.366A3 3 0 0013.613 5h1.292v7h-.963c-.685 0-1.258.483-1.612 1.068a4.011 4.011 0 01-2.166 1.73c-.432.143-.853.386-1.011.814-.16.432-.248.9-.248 1.388z" />
          </svg>
        </button>
      </div>
    </li>
  );
}
