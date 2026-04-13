import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TrackListDto } from '@/api/models/trackListDto';
import type { StyleNode } from '@/api/models/styleNode';
import { getStyleTree } from '@/api/generated/styles/styles';
import { getTracks, submitFeedback } from '@/api/generated/tracks/tracks';
import { usePlayer } from '@/player/usePlayer';
import { getVoterId } from '@/utils/voter';
import { getTempoLabel } from '@/utils/tempoLabel';
import { FlagTrackModal } from '@/components/FlagTrackModal';
import { FlagIcon, PlayIcon, PauseIcon } from '@/icons';

const RANKS = [
  { limit: 0, title: 'Novis' },
  { limit: 5, title: 'Entusiast' },
  { limit: 15, title: 'Expert' },
  { limit: 30, title: 'Orakel' },
  { limit: 100, title: 'Gudomlig' },
];

const TEMPOS = [
  { label: 'långsam', value: 1 },
  { label: 'lagom', value: 3 },
  { label: 'snabb', value: 4 },
  { label: 'väldigt snabb', value: 5 },
];

const PINNED_STYLES = ['Polska', 'Schottis', 'Vals', 'Hambo', 'Polkett', 'Snoa'];

export function ClassifyPage() {
  const navigate = useNavigate();
  const player = usePlayer();

  const [view, setView] = useState<'game' | 'summary'>('game');
  const [tracks, setTracks] = useState<TrackListDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'style' | 'tempo'>('style');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [tappedBpm, setTappedBpm] = useState(0);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [allStyles, setAllStyles] = useState<string[]>([]);

  const tapTimesRef = useRef<number[]>([]);
  const lastTapTimeRef = useRef(0);
  const isFetchingRef = useRef(false);
  const offsetRef = useRef(0);

  const activeTrack = tracks[0] ?? null;
  const isCurrentTrack = player.currentTrack?.id === activeTrack?.id;
  const hasBpm = (activeTrack?.effectiveBpm ?? 0) > 0;
  const aiTempoLabel = getTempoLabel(activeTrack?.effectiveBpm);

  const currentRank = useMemo(
    () => [...RANKS].reverse().find((r) => sessionCount >= r.limit) ?? RANKS[0],
    [sessionCount],
  );

  const nextRank = useMemo(
    () => RANKS.find((r) => r.limit > sessionCount),
    [sessionCount],
  );

  const progressToNextRank = useMemo(() => {
    if (!nextRank) return 100;
    return Math.min(
      100,
      ((sessionCount - currentRank.limit) / (nextRank.limit - currentRank.limit)) * 100,
    );
  }, [sessionCount, currentRank, nextRank]);

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
      const data = await getTracks({
        styleConfirmed: false,
        limit: 20,
        offset: offsetRef.current,
        sortBy: 'confidence',
        sortDirection: 'asc',
      });
      const items = data.items ?? [];
      setTracks((prev) => {
        const currentIds = new Set(prev.map((t) => t.id));
        const newTracks = items.filter((t) => !currentIds.has(t.id));
        return newTracks.length > 0 ? [...prev, ...newTracks] : prev;
      });
      if (items.length > 0) {
        offsetRef.current += 20;
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [tracks.length]);

  const advance = useCallback(() => {
    setTracks((prev) => {
      const next = prev.slice(1);
      if (player.isPlaying && next.length > 0) {
        setTimeout(() => player.play(next[0]), 300);
      }
      if (next.length <= 5) {
        fetchTracks();
      }
      return next;
    });
    setStep('style');
    setSelectedStyle(null);
    setTappedBpm(0);
  }, [player, fetchTracks]);

  const selectStyle = useCallback((style: string) => {
    setSelectedStyle(style);
    setStep('tempo');
    setTappedBpm(0);
    tapTimesRef.current = [];
  }, []);

  const finishVote = useCallback(
    (correction: string = 'ok') => {
      if (!activeTrack?.id) return;

      setSessionCount((c) => c + 1);
      setStreak((s) => {
        const next = s + 1;
        setMaxStreak((m) => Math.max(m, next));
        return next;
      });

      submitFeedback(
        activeTrack.id,
        { suggestedStyle: selectedStyle ?? undefined, tempoCorrection: correction },
        { headers: { 'X-Voter-ID': getVoterId() } },
      ).catch(() => {});

      advance();
    },
    [activeTrack?.id, selectedStyle, advance],
  );

  const skip = useCallback(() => {
    setStreak(0);
    advance();
  }, [advance]);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapTimeRef.current > 2000) {
      tapTimesRef.current = [];
    }
    lastTapTimeRef.current = now;
    tapTimesRef.current.push(now);
    if (tapTimesRef.current.length > 1) {
      const intervals: number[] = [];
      for (let i = 1; i < tapTimesRef.current.length; i++) {
        intervals.push(tapTimesRef.current[i] - tapTimesRef.current[i - 1]);
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setTappedBpm(60000 / avg);
    }
  }, []);

  const togglePlayback = useCallback(() => {
    if (!activeTrack?.id) return;
    if (isCurrentTrack && player.isPlaying) {
      player.togglePlayPause();
    } else {
      player.play(activeTrack);
    }
  }, [activeTrack, isCurrentTrack, player]);

  const triggerSummary = useCallback(() => {
    if (player.isPlaying) player.togglePlayPause();
    setView('summary');
  }, [player]);

  const resetGame = useCallback(() => {
    setSessionCount(0);
    setStreak(0);
    setMaxStreak(0);
    setView('game');
    setTracks([]);
    offsetRef.current = 0;
    isFetchingRef.current = false;
    fetchTracks();
  }, [fetchTracks]);

  // Fetch styles and tracks on mount
  useEffect(() => {
    fetchStyles();
    fetchTracks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayback();
      }
      if (e.code === 'ArrowRight') skip();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [togglePlayback, skip]);

  return (
    <div className="max-w-2xl mx-auto pb-24 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 px-4 pt-4">
        <div>
          <h2 className="text-xl font-bold text-[rgb(var(--color-text))] leading-none">
            Musikdomaren
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[rgb(var(--color-accent))]/15 text-[rgb(var(--color-accent))] uppercase tracking-wide">
              {currentRank.title}
            </span>
            {streak > 2 && (
              <span className="text-xs font-bold text-orange-500 animate-pulse">
                {streak} i rad!
              </span>
            )}
          </div>
        </div>

        <button
          onClick={triggerSummary}
          disabled={sessionCount === 0}
          className="group bg-[rgb(var(--color-bg-elevated))] border-2 border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-accent))]/50 hover:bg-[rgb(var(--color-accent))]/5 transition-all rounded-xl px-4 py-2 flex flex-col items-center min-w-[80px] disabled:opacity-50"
          title="Avsluta session"
        >
          <span className="text-[rgb(var(--color-accent))] font-black text-2xl leading-none">
            {sessionCount}
          </span>
          <span className="text-[9px] uppercase font-bold text-[rgb(var(--color-text-muted))] group-hover:text-[rgb(var(--color-accent))]">
            Antal Låtar
          </span>
        </button>
      </div>

      {/* Progress bar */}
      <div className="mx-4 mb-6 h-1 bg-[rgb(var(--color-border))] rounded-full overflow-hidden">
        <div
          className="h-full bg-[rgb(var(--color-accent))] transition-all duration-500 ease-out"
          style={{ width: `${progressToNextRank}%` }}
        />
      </div>

      {/* Summary view */}
      {view === 'summary' && (
        <div className="mx-4 mt-8">
          <div className="bg-[rgb(var(--color-bg-elevated))] rounded-2xl shadow-xl overflow-hidden border border-[rgb(var(--color-border))]">
            <div className="bg-[rgb(var(--color-accent))] p-8 text-center text-white relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-2xl font-black uppercase tracking-wide">
                  Snyggt Jobbat!
                </h3>
                <p className="text-white/70 font-medium mt-1">Dagens insats</p>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="text-center p-4 bg-[rgb(var(--color-bg))]/50 rounded-xl">
                  <div className="text-3xl font-black text-[rgb(var(--color-text))]">
                    {sessionCount}
                  </div>
                  <div className="text-xs text-[rgb(var(--color-text-muted))] uppercase font-bold">
                    Kategoriserade latar
                  </div>
                </div>
                <div className="text-center p-4 bg-[rgb(var(--color-bg))]/50 rounded-xl">
                  <div className="text-3xl font-black text-orange-500">{maxStreak}</div>
                  <div className="text-xs text-[rgb(var(--color-text-muted))] uppercase font-bold">
                    Bästa Streak
                  </div>
                </div>
              </div>

              <div className="text-center space-y-3">
                <p className="text-[rgb(var(--color-text-muted))] text-sm">
                  Du nådde rangen{' '}
                  <strong className="text-[rgb(var(--color-accent))]">
                    {currentRank.title}
                  </strong>
                  .
                </p>

                <button
                  onClick={resetGame}
                  className="w-full py-3 bg-[rgb(var(--color-text))] text-[rgb(var(--color-bg))] rounded-xl font-bold shadow-lg hover:opacity-90 transform transition active:scale-95"
                >
                  Kör en omgång till
                </button>

                <button
                  onClick={() => navigate('/')}
                  className="text-xs text-[rgb(var(--color-text-muted))] font-bold uppercase hover:text-[rgb(var(--color-text))]"
                >
                  Gå tillbaka till sök
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading spinner */}
      {view === 'game' && loading && tracks.length === 0 && (
        <div className="h-48 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[rgb(var(--color-accent))]" />
        </div>
      )}

      {/* Track card */}
      {view === 'game' && tracks.length > 0 && activeTrack && (
        <div className="bg-[rgb(var(--color-bg-elevated))] rounded-xl shadow-lg overflow-hidden transition-all duration-300 transform mx-2 sm:mx-0 border border-[rgb(var(--color-border))]">
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
                {activeTrack.artistName || 'Okand artist'}
              </p>
            </div>
          </div>

          {/* Content area */}
          <div className="p-4 bg-[rgb(var(--color-bg))]/50 min-h-[300px] flex flex-col relative">
            {step === 'style' ? (
              <div className="flex-1 flex flex-col">
                <h4 className="text-center text-xs font-bold text-[rgb(var(--color-text-muted))] mb-3 uppercase tracking-widest">
                  Välj Dansstil
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {allStyles.map((style) => (
                    <button
                      key={style}
                      onClick={() => selectStyle(style)}
                      className={`py-3 px-1 rounded-lg font-bold text-xs shadow-sm transition-all border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] text-[rgb(var(--color-text))] hover:border-[rgb(var(--color-accent))]/50 hover:text-[rgb(var(--color-accent))] hover:shadow-md active:scale-95 break-words leading-tight ${
                        selectedStyle === style
                          ? 'ring-2 ring-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent))]/10 text-[rgb(var(--color-accent))]'
                          : ''
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                {/* Tempo step header */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setStep('style')}
                    className="text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))] flex items-center text-xs font-medium"
                  >
                    <svg
                      className="w-3 h-3 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                    Tillbaka
                  </button>
                  <h4 className="text-xs font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest">
                    Tempo för{' '}
                    <span className="text-[rgb(var(--color-accent))]">{selectedStyle}</span>
                  </h4>
                  <div className="w-12" />
                </div>

                {hasBpm ? (
                  <div className="flex flex-col gap-4">
                    <div className="text-center mb-2 px-4">
                      <h3 className="text-xl font-bold text-[rgb(var(--color-text))] leading-tight">
                        Är det en {' '}
                        <span className="text-[rgb(var(--color-accent))]">
                          {aiTempoLabel.toLowerCase()}{' '}
                        </span>
                        {selectedStyle?.toLowerCase()}
                        ?
                      </h3>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => finishVote('half')}
                        className="py-4 bg-[rgb(var(--color-bg-elevated))] border border-[rgb(var(--color-border))] rounded-xl text-xs font-bold text-[rgb(var(--color-text-muted))] hover:border-[rgb(var(--color-accent))]/50 hover:text-[rgb(var(--color-accent))] active:scale-95 transition-all"
                      >
                        Den är
                        <br />
                        långsammare
                      </button>
                      <button
                        onClick={() => finishVote('ok')}
                        className="py-4 bg-[rgb(var(--color-accent))] text-white rounded-xl text-sm font-bold shadow-md hover:opacity-90 active:scale-95 transition-all"
                      >
                        Ja, det är
                        <br />
                        rätt
                      </button>
                      <button
                        onClick={() => finishVote('double')}
                        className="py-4 bg-[rgb(var(--color-bg-elevated))] border border-[rgb(var(--color-border))] rounded-xl text-xs font-bold text-[rgb(var(--color-text-muted))] hover:border-[rgb(var(--color-accent))]/50 hover:text-[rgb(var(--color-accent))] active:scale-95 transition-all"
                      >
                        Den är
                        <br />
                        snabbare
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    {/* Tap tempo */}
                    <div
                      className={`mb-6 bg-[rgb(var(--color-border))]/30 rounded-xl p-1 flex gap-1 ring-2 transition-all duration-300 ${
                        tappedBpm > 0
                          ? 'ring-[rgb(var(--color-accent))]/50 bg-[rgb(var(--color-accent))]/5'
                          : 'ring-[rgb(var(--color-accent))]/15'
                      }`}
                    >
                      <button
                        onClick={handleTap}
                        className={`flex-1 py-4 rounded-lg bg-[rgb(var(--color-bg-elevated))] shadow-sm border-2 border-transparent font-bold text-[rgb(var(--color-text-muted))] active:scale-95 active:bg-[rgb(var(--color-accent))]/10 transition-all select-none ${
                          tappedBpm > 0
                            ? 'border-[rgb(var(--color-accent))]/50 text-[rgb(var(--color-accent))]'
                            : ''
                        }`}
                      >
                        {tappedBpm > 0 ? (
                          <span className="flex flex-col items-center leading-none">
                            <span className="text-2xl font-black">
                              {Math.round(tappedBpm)}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-[rgb(var(--color-text-muted))]">
                              BPM (Tryck har)
                            </span>
                          </span>
                        ) : (
                          <span className="flex flex-col items-center">
                            <span className="text-xl">Tryck</span>
                            <span className="text-xs uppercase font-bold mt-1">
                              Tryck i takten
                            </span>
                          </span>
                        )}
                      </button>

                      {tappedBpm > 0 && (
                        <button
                          onClick={() => finishVote('ok')}
                          className="px-6 bg-[rgb(var(--color-accent))] text-white rounded-lg font-bold text-sm shadow-md hover:opacity-90 transition-all"
                        >
                          Spara
                        </button>
                      )}
                    </div>

                    {tappedBpm === 0 ? (
                      <div className="grid grid-cols-1 gap-3 flex-1 content-start max-w-sm mx-auto w-full">
                        {TEMPOS.map((tempo) => (
                          <button
                            key={tempo.value}
                            onClick={() => finishVote('ok')}
                            className="flex items-center justify-between p-3 rounded-xl bg-[rgb(var(--color-bg-elevated))] border-2 border-transparent shadow-sm hover:border-[rgb(var(--color-accent))]/50 hover:shadow-md transition-all group active:scale-98"
                          >
                            <span className="font-bold text-[rgb(var(--color-text))] group-hover:text-[rgb(var(--color-accent))]">
                              {tempo.label}
                            </span>
                          </button>
                        ))}
                        <button
                          onClick={() => finishVote('ok')}
                          className="mt-2 text-xs text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))] underline text-center w-full py-2"
                        >
                          Vet ej tempo
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <button
                          onClick={() => {
                            setTappedBpm(0);
                            tapTimesRef.current = [];
                          }}
                          className="text-xs text-[rgb(var(--color-text-muted))] hover:text-red-500 underline"
                        >
                          Rensa / Välj kategori istället
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Footer: flag + skip */}
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
                Hoppa över
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {view === 'game' && !loading && tracks.length === 0 && (
        <div className="text-center py-12 px-4">
          <div className="bg-[rgb(var(--color-bg-elevated))] rounded-2xl shadow-sm p-8">
            <h3 className="text-lg font-bold text-[rgb(var(--color-text))] mb-2">
              Kön är tom!
            </h3>
            <p className="text-sm text-[rgb(var(--color-text-muted))] mb-6">
              Du har gått igenom alla tillgängliga låtar.
            </p>
            <button
              onClick={triggerSummary}
              className="px-6 py-2 bg-[rgb(var(--color-accent))] text-white rounded-full text-sm font-bold hover:opacity-90 transition-colors shadow-lg"
            >
              Se Resultat
            </button>
          </div>
        </div>
      )}

      {/* Flag modal */}
      {activeTrack && (
        <FlagTrackModal
          open={showFlagModal}
          onClose={() => setShowFlagModal(false)}
          track={activeTrack}
          onRefresh={advance}
        />
      )}
    </div>
  );
}
