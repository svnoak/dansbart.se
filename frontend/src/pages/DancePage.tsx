import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { TrackListDto } from '@/api/models/trackListDto';
import { httpClient } from '@/api/http-client';
import {
  getPrimaryTrack,
  setPrimaryTrack,
  clearPrimaryTrack,
} from '@/api/generated/dances/dances';
import { getVoterId } from '@/utils/voter';
import { useAuth } from '@/auth/useAuth';
import { usePlayer } from '@/player/usePlayer';
import { useTheme } from '@/theme/useTheme';
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  InlineError,
  RowSkeleton,
  SectionTitle,
} from '@/ui';
import {
  ChevronLeftIcon,
  MusicNoteIcon,
  PlayIcon,
  PlusIcon,
  StarIcon,
  StarFilledIcon,
  StarMarkIcon,
} from '@/icons';
import { TrackRow } from '@/components/TrackRow';
import { StylePill } from '@/components/TrackRow/StylePill';
import { getStyleColor } from '@/styles/danceStyleColors';
import { SuggestTrackModal } from './dance/SuggestTrackModal';

type DanceDto = {
  id?: string;
  name?: string;
  slug?: string;
  danceDescriptionUrl?: string | null;
  danceType?: string | null;
  music?: string | null;
  confirmedTrackCount?: number;
};

function getDance(id: string): Promise<DanceDto> {
  return httpClient(`/api/dances/${id}`);
}
function getConfirmedTracks(id: string): Promise<TrackListDto[]> {
  return httpClient(`/api/dances/${id}/tracks`);
}
function getMatchingDanceTracks(id: string): Promise<TrackListDto[]> {
  return httpClient(`/api/dances/${id}/matching`);
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

const LIST_CLASS =
  'overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]';

function trackCountLabel(n: number): string {
  return n === 1 ? '1 låt' : `${n.toLocaleString('sv-SE')} låtar`;
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M14 5h5v5" />
      <path d="M19 5l-9 9" />
      <path d="M17 14v4a1 1 0 01-1 1H6a1 1 0 01-1-1V8a1 1 0 011-1h4" />
    </svg>
  );
}

function ThumbsUpIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M7 11v10H4a1 1 0 01-1-1v-8a1 1 0 011-1h3z" />
      <path d="M7 11l4.5-8a2.5 2.5 0 012.5 2.5V9h5a2 2 0 012 2.3l-1.2 7A2 2 0 0117.8 20H7" />
    </svg>
  );
}

function ThumbsDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M17 13V3h3a1 1 0 011 1v8a1 1 0 01-1 1h-3z" />
      <path d="M17 13l-4.5 8a2.5 2.5 0 01-2.5-2.5V15H5a2 2 0 01-2-2.3l1.2-7A2 2 0 016.2 4H17" />
    </svg>
  );
}

interface VoteButtonsProps {
  vote: 'up' | 'down' | undefined;
  voting: boolean;
  onVote: (vote: 'up' | 'down') => void;
}

/** The two vote buttons of a recommendation row: "Passar" and "Passar inte". */
function VoteButtons({ vote, voting, onVote }: VoteButtonsProps) {
  const base =
    'inline-flex h-10 items-center gap-1.5 rounded-[var(--radius)] border px-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))] disabled:opacity-50';
  const idle =
    'border-[rgb(var(--color-border-strong))] bg-transparent text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))]';
  const pressed =
    'border-[rgb(var(--color-selected))] bg-[rgb(var(--color-selected))]/10 text-[rgb(var(--color-selected))]';
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Rösta på förslaget">
      <button
        type="button"
        aria-pressed={vote === 'up'}
        aria-busy={voting}
        disabled={voting}
        onClick={() => onVote('up')}
        className={`${base} ${vote === 'up' ? pressed : idle}`}
      >
        <ThumbsUpIcon className="h-4 w-4" />
        Passar
      </button>
      <button
        type="button"
        aria-pressed={vote === 'down'}
        aria-busy={voting}
        disabled={voting}
        onClick={() => onVote('down')}
        className={`${base} ${vote === 'down' ? pressed : idle}`}
      >
        <ThumbsDownIcon className="h-4 w-4" />
        <span className="whitespace-nowrap">Passar inte</span>
      </button>
    </div>
  );
}

export function DancePage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const { play } = usePlayer();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

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
  const [voteErrors, setVoteErrors] = useState<Record<string, string>>({});
  const [votingTrackIds, setVotingTrackIds] = useState<Set<string>>(new Set());
  const [primaryTrackId, setPrimaryTrackId] = useState<string | null>(null);

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
    setPrimaryTrackId(null);
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    Promise.all([
      getDance(id),
      getConfirmedTracks(id),
      getMatchingDanceTracks(id),
      getRecommendations(id, { limit: REC_PAGE_SIZE, offset: 0 }),
      getPrimaryTrack(id).then((track) => track.id ?? null).catch(() => null),
    ])
      .then(([danceData, confirmedData, matchingData, recsData, primaryId]) => {
        if (!cancelled) {
          setDance(danceData ?? null);
          setConfirmedTracks(confirmedData ?? []);
          setMatchingTracks(matchingData ?? []);
          setRecommendations(recsData?.items ?? []);
          setRecTotal(recsData?.total ?? 0);
          setPrimaryTrackId(primaryId);
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
      const trackId = track.id;
      if (votingTrackIds.has(trackId)) return;
      const currentVote = votes[trackId];

      setVoteErrors((prev) => {
        const next = { ...prev };
        delete next[trackId];
        return next;
      });
      setVotingTrackIds((prev) => new Set(prev).add(trackId));
      const stopVoting = () => {
        setVotingTrackIds((prev) => {
          const next = new Set(prev);
          next.delete(trackId);
          return next;
        });
      };

      if (currentVote === newVote) {
        // Toggle off — move back from matching tracks to recommendations
        setVotes((prev) => { const n = { ...prev }; delete n[track.id!]; return n; });
        if (newVote === 'up') {
          setMatchingTracks((prev) => prev.filter((t) => t.id !== track.id));
          setRecommendations((prev) => [track, ...prev]);
        }
        deleteVote(dance.id!, track.id)
          .catch(() => {
            // Revert: the vote was not actually removed
            setVotes((prev) => ({ ...prev, [track.id!]: newVote }));
            if (newVote === 'up') {
              setRecommendations((prev) => prev.filter((t) => t.id !== track.id));
              setMatchingTracks((prev) => [track, ...prev]);
            }
            setVoteErrors((prev) => ({ ...prev, [trackId]: 'Kunde inte ta bort rösten, försök igen.' }));
          })
          .finally(stopVoting);
      } else {
        setVotes((prev) => ({ ...prev, [track.id!]: newVote }));
        postVote(dance.id!, track.id, newVote)
          .then(() => {
            if (newVote === 'up') {
              // Promote to matching dance tracks (shown in Låtar)
              setRecommendations((prev) => prev.filter((t) => t.id !== track.id));
              setMatchingTracks((prev) => [track, ...prev]);
            }
          })
          .catch(() => {
            // Revert: the vote was not actually saved
            setVotes((prev) => {
              const n = { ...prev };
              if (currentVote === undefined) delete n[track.id!];
              else n[track.id!] = currentVote;
              return n;
            });
            setVoteErrors((prev) => ({ ...prev, [trackId]: 'Kunde inte spara rösten, försök igen.' }));
          })
          .finally(stopVoting);
      }
    },
    [dance, votes, votingTrackIds],
  );

  async function handleSetPrimary(trackId: string) {
    if (!dance?.id) return;
    if (primaryTrackId === trackId) {
      setPrimaryTrackId(null);
      clearPrimaryTrack(dance.id).catch(() => {
        setPrimaryTrackId(trackId);
      });
    } else {
      const prev = primaryTrackId;
      setPrimaryTrackId(trackId);
      setPrimaryTrack(dance.id, { trackId }).catch(() => {
        setPrimaryTrackId(prev);
      });
    }
  }

  const handleSuggest = async (trackId: string) => {
    if (!id) return;
    await suggestTrack(id, trackId);
    setSuggestedIds((prev) => new Set([...prev, trackId]));
  };

  const backLink = (
    <Link
      to="/dances"
      className="inline-flex min-h-11 items-center gap-1 pr-2 text-[15px] font-medium text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))] rounded-[var(--radius)]"
    >
      <ChevronLeftIcon className="h-5 w-5" aria-hidden />
      Danser
    </Link>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {backLink}
        <RowSkeleton rows={4} label="Laddar dans" />
      </div>
    );
  }
  if (error || !dance) {
    return (
      <div className="space-y-6">
        {backLink}
        <p className="text-[15px] text-[rgb(var(--color-error))]" role="alert">
          {error ?? 'Dansen hittades inte.'}
        </p>
      </div>
    );
  }

  const allTracks = [...confirmedTracks, ...matchingTracks].sort((a, b) => {
    if (a.id === primaryTrackId) return -1;
    if (b.id === primaryTrackId) return 1;
    return 0;
  });
  const hasMoreRecs = recommendations.length < recTotal;
  const playableTrack =
    allTracks.find((t) => t.id === primaryTrackId) ?? allTracks[0] ?? null;

  const color = getStyleColor(dance.danceType);
  const tileStyle: CSSProperties = {
    backgroundColor: isDark ? color.bgDark : color.bg,
    color: isDark ? color.textDark : color.text,
  };

  const metaParts: { key: string; node: ReactNode }[] = [];
  if (dance.danceType) {
    metaParts.push({
      key: 'style',
      node: <StylePill style={dance.danceType} state="confirmed" />,
    });
  }
  if (dance.music) {
    metaParts.push({ key: 'music', node: <span>Musik: {dance.music}</span> });
  }
  metaParts.push({ key: 'count', node: <span>{trackCountLabel(allTracks.length)}</span> });
  if (dance.danceDescriptionUrl) {
    metaParts.push({
      key: 'acla',
      node: (
        <a
          href={dance.danceDescriptionUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Dansbeskrivning hos ACLA, öppnas i ny flik"
          className="inline-flex min-h-6 items-center gap-1 text-[rgb(var(--color-link))] hover:underline"
        >
          Dansbeskrivning hos ACLA
          <ExternalLinkIcon className="h-4 w-4" />
        </a>
      ),
    });
  }

  return (
    <div className="space-y-8">
      {backLink}

      <Card className="flex flex-col gap-6 p-7 sm:flex-row sm:items-start">
        <div
          className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[var(--radius-lg)]"
          style={tileStyle}
          aria-hidden
        >
          <StarMarkIcon className="h-[60px] w-[60px]" aria-hidden />
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-2">
            <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
              {dance.name}
            </h1>
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[15px] text-[rgb(var(--color-text-muted))]">
              {metaParts.map((part, i) => (
                <span key={part.key} className="inline-flex items-center gap-x-1.5">
                  {i > 0 && <span aria-hidden> · </span>}
                  {part.node}
                </span>
              ))}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              disabled={!playableTrack}
              onClick={() => playableTrack && play(playableTrack, allTracks)}
            >
              <PlayIcon className="h-4 w-4" aria-hidden />
              Spela
            </Button>
            {isAuthenticated && (
              <Button variant="secondary" onClick={() => setShowSuggest(true)}>
                <PlusIcon className="h-4 w-4" aria-hidden />
                Föreslå låt
              </Button>
            )}
          </div>
        </div>
      </Card>

      <section aria-labelledby="tracks-heading" className="space-y-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <SectionTitle id="tracks-heading">Låtar</SectionTitle>
            <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
              {trackCountLabel(allTracks.length)} · den primära spelas först
            </p>
          </div>
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            Låtar som dansare kopplat till dansen. Den primära låten är den som spelas från
            Danser-listan.
          </p>
        </div>
        {allTracks.length === 0 ? (
          <EmptyState
            icon={<MusicNoteIcon className="h-7 w-7" aria-hidden />}
            title="Inga låtar ännu"
            description={
              isAuthenticated
                ? 'Ingen har kopplat en låt till dansen ännu. Föreslå en låt, eller rösta Passar på ett förslag nedan.'
                : 'Ingen har kopplat en låt till dansen ännu. Rösta Passar på ett förslag nedan.'
            }
            action={
              isAuthenticated ? (
                <Button variant="secondary" onClick={() => setShowSuggest(true)}>
                  <PlusIcon className="h-4 w-4" aria-hidden />
                  Föreslå låt
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className={LIST_CLASS}>
            {allTracks.map((track) => {
              const isPrimary = primaryTrackId === track.id;
              const action = isAuthenticated ? (
                isPrimary ? (
                  <button
                    type="button"
                    aria-label="Ta bort som primär låt"
                    aria-pressed="true"
                    onClick={() => track.id && handleSetPrimary(track.id)}
                    className="-my-2 inline-flex min-h-11 items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]"
                  >
                    <span className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full bg-[rgb(var(--color-selected))]/10 px-2.5 text-[13px] font-semibold text-[rgb(var(--color-selected))]">
                      <StarFilledIcon className="h-3.5 w-3.5" aria-hidden />
                      Primär låt
                    </span>
                  </button>
                ) : (
                  <IconButton
                    aria-label="Sätt som primär låt"
                    onClick={() => track.id && handleSetPrimary(track.id)}
                  >
                    <StarIcon className="h-5 w-5 text-[rgb(var(--color-text-muted))]" aria-hidden />
                  </IconButton>
                )
              ) : undefined;
              return (
                <li key={track.id}>
                  <TrackRow track={track} contextTracks={allTracks} action={action} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {dance.danceType && (
        <section aria-labelledby="recommendations-heading" className="space-y-3">
          <div className="space-y-1">
            <SectionTitle id="recommendations-heading">Förslag på musik</SectionTitle>
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              Låtar i {dance.danceType} i passande tempo som ingen kopplat till dansen ännu. Rösta
              Passar så flyttas låten upp till listan ovan.
            </p>
          </div>

          {recommendations.length === 0 && !recLoading ? (
            <EmptyState
              icon={<MusicNoteIcon className="h-7 w-7" aria-hidden />}
              title="Inga förslag hittades"
              description={`Det finns inga fler låtar i ${dance.danceType} i passande tempo att föreslå just nu.`}
            />
          ) : (
            <>
              <ul className={LIST_CLASS}>
                {recommendations.map((track) => {
                  const trackId = track.id ?? '';
                  return (
                    <li key={track.id}>
                      <TrackRow
                        track={track}
                        contextTracks={recommendations}
                        action={
                          <VoteButtons
                            vote={votes[trackId]}
                            voting={votingTrackIds.has(trackId)}
                            onVote={(v) => handleVote(track, v)}
                          />
                        }
                      />
                      {voteErrors[trackId] && (
                        <div className="border-b border-[rgb(var(--color-border))] px-4 py-2">
                          <InlineError>{voteErrors[trackId]}</InlineError>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              {hasMoreRecs && (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={loadMoreRecs} disabled={recLoading}>
                    {recLoading ? 'Laddar…' : 'Visa fler förslag'}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {showSuggest && dance.id && (
        <SuggestTrackModal
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
