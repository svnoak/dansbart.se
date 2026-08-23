import { useState, useEffect, useRef, useCallback } from 'react';
import { useAnalyticsFlag } from '@/analytics/useAnalyticsFlag';
import type { TrackListDto } from '@/api/models/trackListDto';
import type { StyleNode } from '@/api/models/styleNode';
import { getStyleTree } from '@/api/generated/styles/styles';
import { submitFeedback } from '@/api/generated/tracks/tracks';
import { getClassifyQueue } from '@/api/manual/getClassifyQueue';
import { recordInteraction1 } from '@/api/generated/analytics/analytics';
import { usePlayer } from '@/player/usePlayer';
import { getVoterId } from '@/utils/voter';
import { getTempoLabel } from '@/utils/tempoLabel';
import { FlagTrackModal } from '@/components/FlagTrackModal';
import { FlagIcon, PlayIcon, PauseIcon } from '@/icons';

const TEMPO_BUTTONS = [
  { key: 'Slow', label: 'Långsamt' },
  { key: 'SlowMed', label: 'Lugnt' },
  { key: 'Medium', label: 'Lagom' },
  { key: 'Fast', label: 'Snabbt' },
  { key: 'Turbo', label: 'V. snabbt' },
];

const PINNED_STYLES = ['Polska', 'Schottis', 'Vals', 'Hambo', 'Polkett', 'Snoa'];
const QUEUE_LOW_WATERMARK = 5;
const QUEUE_FETCH_SIZE = 20;

interface HistoryEntry {
  track: TrackListDto;
}

/**
 * Fast bulk classification tool. Optimized for a contributor deliberately sitting down to
 * classify many tracks quickly (as opposed to SmartNudge, which is a passive in-context
 * nudge on every other page) — one tap per track for the common case, tempo correction
 * only as an exception path, no rank/streak/points.
 */
export function ClassifyPage() {
  useAnalyticsFlag('discovery');
  const player = usePlayer();

  const [tracks, setTracks] = useState<TrackListDto[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [awaitingTempo, setAwaitingTempo] = useState<string | null>(null); // style pending a tempo pick
  const [classifiedCount, setClassifiedCount] = useState(0);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [allStyles, setAllStyles] = useState<string[]>([]);
  const [queueExhausted, setQueueExhausted] = useState(false);

  const isFetchingRef = useRef(false);

  const activeTrack = tracks[0] ?? null;
  const isCurrentTrack = player.currentTrack?.id === activeTrack?.id;
  const hasBpm = (activeTrack?.effectiveBpm ?? 0) > 0;
  const aiTempoLabel = getTempoLabel(activeTrack?.effectiveBpm);

  const fetchStyles = useCallback(async () => {
    try {
      const nodes: StyleNode[] = await getStyleTree();
      const keys = nodes.map((n) => n.name).filter((n): n is string => !!n);
      keys.sort((a, b) => {
        const idxA = PINNED_STYLES.indexOf(a);
        const idxB = PINNED_STYLES.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      });
      setAllStyles(keys);
    } catch {
      setAllStyles(['Polska', 'Schottis', 'Vals']);
    }
  }, []);

  const fetchTracks = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading((prev) => (tracks.length === 0 ? true : prev));
    try {
      // No offset needed: already-voted-by-this-voter tracks are excluded server-side,
      // so a fresh fetch naturally returns new ground rather than repeats.
      const items = await getClassifyQueue(QUEUE_FETCH_SIZE);
      setTracks((prev) => {
        const currentIds = new Set(prev.map((t) => t.id));
        const newTracks = items.filter((t) => !currentIds.has(t.id));
        return newTracks.length > 0 ? [...prev, ...newTracks] : prev;
      });
      if (items.length === 0) setQueueExhausted(true);
      else setQueueExhausted(false);
    } catch {
      // silently fail — the empty-state UI covers the "nothing to show" case either way
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [tracks.length]);

  const advanceTo = useCallback(
    (remaining: TrackListDto[]) => {
      if (player.isPlaying && remaining.length > 0) {
        setTimeout(() => player.play(remaining[0]), 300);
      }
      if (remaining.length <= QUEUE_LOW_WATERMARK) {
        fetchTracks();
      }
      setTracks(remaining);
      setAwaitingTempo(null);
    },
    [player, fetchTracks],
  );

  const submitVote = useCallback(
    (style: string | null, tempoCorrection: string) => {
      if (!activeTrack?.id) return;
      const [current, ...rest] = tracks;
      if (!current?.id) return;

      setHistory((h) => [...h.slice(-9), { track: current }]); // keep last 10 for undo
      setClassifiedCount((c) => c + 1);

      submitFeedback(
        current.id,
        { suggestedStyle: style ?? undefined, tempoCorrection },
        { headers: { 'X-Voter-ID': getVoterId() } },
      ).catch(() => {});

      recordInteraction1({
        trackId: current.id,
        eventType: 'classify_vote',
        eventData: { style, tempo: tempoCorrection } as unknown as Record<string, Record<string, unknown>>,
        sessionId: getVoterId(),
      }).catch(() => {});

      advanceTo(rest);
    },
    [activeTrack?.id, tracks, advanceTo],
  );

  // Common case: track already has an ML tempo estimate, so one tap submits with the
  // default (unchanged) tempo and moves straight to the next track. Tempo correction is
  // reachable afterward via "Ångra" (undo) rather than gating every submission.
  const selectStyle = useCallback(
    (style: string) => {
      if (hasBpm) {
        submitVote(style, 'ok');
      } else {
        // Exception case: no BPM estimate exists at all, so a tempo pick is genuinely
        // needed for this vote to carry useful information.
        setAwaitingTempo(style);
      }
    },
    [hasBpm, submitVote],
  );

  const selectTempo = useCallback(
    (tempoKey: string) => {
      if (!awaitingTempo) return;
      submitVote(awaitingTempo, tempoKey);
    },
    [awaitingTempo, submitVote],
  );

  const skip = useCallback(() => {
    const [, ...rest] = tracks;
    advanceTo(rest);
  }, [tracks, advanceTo]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      setClassifiedCount((c) => Math.max(0, c - 1));
      setTracks((t) => [last.track, ...t]);
      setAwaitingTempo(null);
      return h.slice(0, -1);
    });
  }, []);

  const togglePlayback = useCallback(() => {
    if (!activeTrack?.id) return;
    if (isCurrentTrack && player.isPlaying) {
      player.togglePlayPause();
    } else {
      player.play(activeTrack);
    }
  }, [activeTrack, isCurrentTrack, player]);

  // Fetch styles and the initial queue on mount
  useEffect(() => {
    fetchStyles();
    fetchTracks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Analytics: session start and abandon (mirrors the previous page's events, minus the
  // rank/streak fields that no longer exist)
  const classifiedCountRef = useRef(0);
  useEffect(() => {
    classifiedCountRef.current = classifiedCount;
  }, [classifiedCount]);

  useEffect(() => {
    recordInteraction1({ eventType: 'classify_start', sessionId: getVoterId() }).catch(() => {});
    return () => {
      if (classifiedCountRef.current > 0) {
        recordInteraction1({
          eventType: 'classify_abandon',
          eventData: { votes: classifiedCountRef.current } as unknown as Record<string, Record<string, unknown>>,
          sessionId: getVoterId(),
        }).catch(() => {});
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts: desktop progressive enhancement only, never the primary
  // interaction (most contributors are expected to be on a phone).
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayback();
      } else if (e.code === 'ArrowRight') {
        skip();
      } else if (e.key.toLowerCase() === 'z') {
        undo();
      } else if (!awaitingTempo && /^[1-9]$/.test(e.key)) {
        const style = allStyles[Number(e.key) - 1];
        if (style) selectStyle(style);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [togglePlayback, skip, undo, allStyles, awaitingTempo, selectStyle]);

  return (
    <div className="max-w-2xl mx-auto pb-24 relative">
      {/* Header: plain progress acknowledgment, not a score/rank */}
      <div className="flex items-center justify-between mb-4 px-4 pt-4">
        <div>
          <h2 className="text-xl font-bold text-[rgb(var(--color-text))] leading-none">
            Snabbklassificering
          </h2>
          <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">
            {classifiedCount > 0
              ? `${classifiedCount} låtar klassificerade den här sessionen`
              : 'Varje val hjälper till direkt — inget granskas i efterhand'}
          </p>
        </div>
        {history.length > 0 && (
          <button
            onClick={undo}
            className="text-xs font-bold text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))] border-2 border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-accent))]/50 rounded-lg px-3 py-2 transition-colors"
            title="Ångra senaste (tangent: Z)"
          >
            Ångra
          </button>
        )}
      </div>

      {/* Loading spinner */}
      {loading && tracks.length === 0 && (
        <div className="h-48 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[rgb(var(--color-accent))]" />
        </div>
      )}

      {/* Track card */}
      {tracks.length > 0 && activeTrack && (
        <div className="bg-[rgb(var(--color-bg-elevated))] rounded-xl shadow-lg overflow-hidden mx-2 sm:mx-0 border border-[rgb(var(--color-border))]">
          {/* Dark header with play/pause */}
          <div className="bg-gray-900 p-3 flex items-center gap-4 shadow-md relative overflow-hidden">
            <div
              className="relative z-10 flex-shrink-0 group cursor-pointer"
              onClick={togglePlayback}
            >
              <div className="w-16 h-16 rounded-md shadow-lg bg-gray-800 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-colors group-hover:bg-black/50">
                  {player.isPlaying && isCurrentTrack ? (
                    <PauseIcon className="w-8 h-8 text-white" aria-hidden />
                  ) : (
                    <PlayIcon className="w-8 h-8 text-white ml-1" aria-hidden />
                  )}
                </div>
              </div>
            </div>

            <div className="relative z-10 flex-1 min-w-0 flex flex-col justify-center h-16">
              <h3 className="text-white text-base font-bold truncate leading-tight mb-1">
                {activeTrack.title}
              </h3>
              <p className="text-gray-300 text-xs font-medium truncate">
                {activeTrack.artistName || 'Okänd artist'}
              </p>
            </div>
          </div>

          {/* Content area */}
          <div className="p-4 bg-[rgb(var(--color-bg))]/50 flex flex-col relative">
            {!awaitingTempo ? (
              <div className="flex-1 flex flex-col">
                <h4 className="text-center text-xs font-bold text-[rgb(var(--color-text-muted))] mb-3 uppercase tracking-widest">
                  Vilken dansstil är det?
                </h4>
                {/* Large, thumb-friendly tap targets — mobile is the primary target, not
                    a keyboard-driven desktop layout. */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {allStyles.map((style) => (
                    <button
                      key={style}
                      onClick={() => selectStyle(style)}
                      className="py-6 px-2 rounded-xl font-bold text-sm shadow-sm transition-all border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] text-[rgb(var(--color-text))] hover:border-[rgb(var(--color-accent))]/50 hover:text-[rgb(var(--color-accent))] hover:shadow-md active:scale-95 break-words leading-tight"
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setAwaitingTempo(null)}
                    className="text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))] flex items-center text-xs font-medium"
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Tillbaka
                  </button>
                  <h4 className="text-xs font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest">
                    Tempo för <span className="text-[rgb(var(--color-accent))]">{awaitingTempo}</span>
                  </h4>
                  <div className="w-12" />
                </div>
                <div className="grid grid-cols-1 gap-3 max-w-sm mx-auto w-full">
                  {TEMPO_BUTTONS.map((tempo) => (
                    <button
                      key={tempo.key}
                      onClick={() => selectTempo(tempo.key)}
                      className="py-5 rounded-xl bg-[rgb(var(--color-bg-elevated))] border-2 border-[rgb(var(--color-border))] font-bold text-[rgb(var(--color-text))] hover:border-[rgb(var(--color-accent))]/50 hover:text-[rgb(var(--color-accent))] active:scale-95 transition-all"
                    >
                      {tempo.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Footer: flag + skip. Correcting the tempo on an already-BPM-tagged track
                happens via Ångra rather than a mandatory step here. */}
            {!awaitingTempo && (
              <div className="mt-6 pt-4 border-t border-[rgb(var(--color-border))] flex gap-3">
                <button
                  onClick={() => setShowFlagModal(true)}
                  className="p-3 rounded-lg border-2 border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-all active:scale-95"
                  title="Rapportera fel"
                >
                  <FlagIcon className="w-3 h-3" aria-hidden />
                </button>

                <button
                  onClick={skip}
                  className="flex-1 flex items-center justify-center py-3 rounded-lg border-2 border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] font-bold text-xs uppercase tracking-wider hover:bg-[rgb(var(--color-border))]/30 hover:text-[rgb(var(--color-text))] transition-all active:scale-95"
                >
                  Vet ej / hoppa över
                </button>
              </div>
            )}
            {hasBpm && !awaitingTempo && (
              <p className="mt-3 text-center text-[10px] text-[rgb(var(--color-text-muted))]">
                Redan uppmätt tempo: {aiTempoLabel.toLowerCase()}. Fel? Tryck Ångra efter att du valt stil.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Empty state — real-work framing, not a score screen */}
      {!loading && tracks.length === 0 && queueExhausted && (
        <div className="text-center py-12 px-4">
          <div className="bg-[rgb(var(--color-bg-elevated))] rounded-2xl shadow-sm p-8">
            <h3 className="text-lg font-bold text-[rgb(var(--color-text))] mb-2">
              Bra jobbat!
            </h3>
            <p className="text-sm text-[rgb(var(--color-text-muted))] mb-2">
              Du har gått igenom alla låtar som behöver klassificeras just nu.
            </p>
            {classifiedCount > 0 && (
              <p className="text-sm text-[rgb(var(--color-text-muted))]">
                Du klassificerade {classifiedCount} {classifiedCount === 1 ? 'låt' : 'låtar'} den här sessionen — tack, det används direkt.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Flag modal */}
      {activeTrack && (
        <FlagTrackModal
          open={showFlagModal}
          onClose={() => setShowFlagModal(false)}
          track={activeTrack}
          onRefresh={skip}
        />
      )}
    </div>
  );
}
