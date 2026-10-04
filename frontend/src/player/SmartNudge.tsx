import { useState, useEffect, useRef, useCallback } from 'react';
import type { DanceStyleDto } from '@/api/models/danceStyleDto';
import type { TrackListDto } from '@/api/models/trackListDto';
import {
  confirmSecondaryStyle,
  getSecondaryStyles,
} from '@/api/generated/tracks/tracks';
import { recordInteraction1 } from '@/api/generated/analytics/analytics';
import { getVoterId } from '@/utils/voter';
import { getTempoLabel } from '@/utils/tempoLabel';
import { useStyleVote } from '@/hooks/useStyleVote';
import { StylePicker } from '@/components/StylePicker';
import { TempoPicker } from '@/components/TempoPicker';

type Step =
  | 'hidden'
  | 'verify'
  | 'verify-style-only'
  | 'ask-main'
  | 'ask-sub'
  | 'ask-tempo'
  | 'fix-main'
  | 'fix-sub'
  | 'fix-tempo'
  | 'menu'
  | 'confirm-secondary'
  | 'bonus'
  | 'success';

type Mode = 'correction' | 'addition';

interface SmartNudgeProps {
  track: TrackListDto | null;
  isPlaying: boolean;
  bottomOffset?: number;
  inline?: boolean;
  mobilePlayerOpen?: boolean;
}

// A track already classified with at least this much confidence isn't worth nudging
// about — verifying something the model is already confident in wastes an interaction
// for no real gain. Unclassified tracks (no confidence yet) always remain eligible.
const HIGH_CONFIDENCE_THRESHOLD = 0.8;

function trackAnalytics(eventType: string, trackId?: string, eventData?: Record<string, unknown>) {
  recordInteraction1({
    trackId,
    sessionId: getVoterId(),
    eventType,
    eventData: eventData as Record<string, Record<string, unknown>> | undefined,
  }).catch(() => {});
}

export function SmartNudge({ track, isPlaying, bottomOffset, inline, mobilePlayerOpen }: SmartNudgeProps) {
  const [step, setStep] = useState<Step>('hidden');
  const [mode, setMode] = useState<Mode>('correction');
  const [correction, setCorrection] = useState({ main: '', style: '', tempo: 'ok' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [showFirstTimeHint, setShowFirstTimeHint] = useState(false);
  const [pendingSecondary, setPendingSecondary] = useState<{
    danceStyle: string;
    subStyle?: string;
    tempoCategory?: string;
  } | null>(null);

  const showDelayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackStartTime = useRef<number | null>(null);
  const stepRef = useRef(step);
  stepRef.current = step;
  const prevStepRef = useRef<Step>('hidden');

  const styleVote = useStyleVote(track?.id);
  const currentSubStyles = styleVote.subStylesFor(correction.main);

  const tempoLabel = getTempoLabel(track?.effectiveBpm);

  // Records a passive dismissal (no feedback submitted) so this track isn't re-nudged for
  // 24h, without permanently suppressing it the way an actual submission does (`fb_<id>`).
  const markSeen = (trackId: string) => {
    localStorage.setItem(`fb_seen_${trackId}`, String(Date.now()));
  };

  // --- Timer helpers ---
  const clearTimers = useCallback(() => {
    if (showDelayTimer.current) {
      clearTimeout(showDelayTimer.current);
      showDelayTimer.current = null;
    }
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
      autoDismissTimer.current = null;
    }
  }, []);

  // --- Reset on track change ---
  const prevTrackId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (track?.id !== prevTrackId.current) {
      prevTrackId.current = track?.id;
      clearTimers();
      setStep('hidden');
      playbackStartTime.current = null;
      setMode('correction');
      setCorrection({ main: '', style: track?.danceStyle ?? '', tempo: 'ok' });
      // Only ever attached to the one appearance that set it — a later track's nudge
      // shouldn't inherit it just because this instance stays mounted across tracks.
      setShowFirstTimeHint(false);
    }
  }, [track?.id, track?.danceStyle, clearTimers]);

  // --- Playback timer logic ---
  useEffect(() => {
    if (!track) return;

    const currentStep = stepRef.current;
    if (currentStep !== 'hidden' && currentStep !== 'verify' && currentStep !== 'verify-style-only') {
      return;
    }

    const hasFeedback = localStorage.getItem(`fb_${track.id}`);
    if (hasFeedback) {
      if (currentStep !== 'hidden') setStep('hidden');
      return;
    }

    const seenAt = localStorage.getItem(`fb_seen_${track.id}`);
    if (seenAt && Date.now() - Number(seenAt) < 24 * 60 * 60 * 1000) {
      if (currentStep !== 'hidden') setStep('hidden');
      return;
    }

    if (isPlaying && !playbackStartTime.current) {
      playbackStartTime.current = Date.now();
      clearTimers();

      const trackIdAtStart = track.id;
      showDelayTimer.current = setTimeout(() => {
        if (track?.id !== trackIdAtStart || !isPlaying) return;

        const trackHasStyle =
          !!track?.danceStyle &&
          track.danceStyle !== 'Unknown' &&
          track.danceStyle !== 'Unclassified';
        const trackHasTempo =
          trackHasStyle && !!track?.effectiveBpm && track.effectiveBpm > 0;

        // A track the model is already confident about isn't worth verifying again.
        if (trackHasStyle && (track?.confidence ?? 0) >= HIGH_CONFIDENCE_THRESHOLD) {
          return;
        }

        trackAnalytics('nudge_shown', track?.id, {
          has_style: trackHasStyle,
          has_tempo: trackHasTempo,
          mobilePlayerOpen: mobilePlayerOpen ?? false,
        });

        // One-time explainer, marked seen immediately so it only ever shows once per
        // browser regardless of how quickly this first appearance gets dismissed.
        if (!localStorage.getItem('smartnudge_explainer_seen')) {
          localStorage.setItem('smartnudge_explainer_seen', 'true');
          setShowFirstTimeHint(true);
        }

        if (!trackHasStyle && !trackHasTempo) {
          setMode('correction');
          setStep('ask-main');
        } else if (trackHasStyle && !trackHasTempo) {
          setStep('verify-style-only');
        } else {
          setStep('verify');
        }

        // Auto-dismiss after 20s
        autoDismissTimer.current = setTimeout(() => {
          const s = stepRef.current;
          if (s === 'verify' || s === 'verify-style-only') {
            trackAnalytics('nudge_dismissed', track?.id, { reason: 'auto_timeout', step: s, mobilePlayerOpen: mobilePlayerOpen ?? false });
            if (track?.id) markSeen(track.id);
            setStep('hidden');
          }
        }, 20000);
      }, 7000);
    } else if (!isPlaying && currentStep === 'hidden') {
      clearTimers();
      playbackStartTime.current = null;
    }

    return () => {
      clearTimers();
      playbackStartTime.current = null;
    };
  }, [isPlaying, track, clearTimers]);

  // Dismiss verify nudge after a few seconds when paused
  useEffect(() => {
    if (!isPlaying && (step === 'verify' || step === 'verify-style-only')) {
      const timer = setTimeout(() => {
        setStep('hidden');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isPlaying, step]);

  // Cleanup on unmount
  useEffect(() => clearTimers, [clearTimers]);

  // --- Submit feedback ---
  const submit = useCallback(
    async (
      suggestedStyle: string,
      tempoCorrection: string,
      nextStep: 'success' | 'bonus' | null = null,
    ): Promise<boolean> => {
      if (!track?.id) return false;
      clearTimers();
      setIsSubmitting(true);
      try {
        const { success, styleJustConfirmed } = await styleVote.submit(suggestedStyle, tempoCorrection);
        localStorage.setItem(`fb_${track.id}`, 'true');
        if (success) {
          if (nextStep === 'bonus') {
            setStep('bonus');
          } else if (nextStep === 'success') {
            trackAnalytics('nudge_completed', track.id, { step: stepRef.current, mobilePlayerOpen: mobilePlayerOpen ?? false });
            setJustConfirmed(styleJustConfirmed);
            setStep('success');
            setTimeout(() => setStep('hidden'), 2500);
          }
          return true;
        }
        // Treat as confirmed even if API fails - avoid hiding the nudge
        if (nextStep === 'success') {
          setJustConfirmed(false);
          setStep('success');
          setTimeout(() => setStep('hidden'), 2500);
        }
        return nextStep !== null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [track?.id, clearTimers, styleVote],
  );

  // --- Secondary style helpers ---
  const showSecondaryConfirm = async () => {
    if (!track?.id) {
      setStep('bonus');
      return;
    }
    let styles: DanceStyleDto[] = [];
    try {
      const result = await getSecondaryStyles(track.id);
      styles = Array.isArray(result) ? result : [];
    } catch {
      // fall through to bonus
    }
    const first = styles.find((s) => !!s.danceStyle);
    if (first?.danceStyle) {
      setPendingSecondary({
        danceStyle: first.danceStyle,
        subStyle: first.subStyle,
        tempoCategory: first.tempoCategory,
      });
      setStep('confirm-secondary');
    } else {
      setStep('bonus');
    }
  };

  const confirmSecondaryHandler = async () => {
    if (!track?.id || !pendingSecondary) return;
    setIsSubmitting(true);
    try {
      await confirmSecondaryStyle(
        track.id,
        { style: pendingSecondary.danceStyle },
        { headers: { 'X-Voter-ID': getVoterId() } },
      );
      trackAnalytics('nudge_completed', track.id, { step: 'confirm-secondary', mobilePlayerOpen: mobilePlayerOpen ?? false });
      // Secondary-style confirmation is a separate mechanic (confirmationCount), never the
      // "just confirmed, now searchable" message, whatever justConfirmed was last set to.
      setJustConfirmed(false);
      setStep('success');
      setTimeout(() => setStep('hidden'), 2500);
    } catch {
      setStep('bonus');
    } finally {
      setIsSubmitting(false);
    }
  };

  const rejectSecondary = () => {
    trackAnalytics('nudge_dismissed', track?.id, { reason: 'secondary_no', step: 'confirm-secondary', mobilePlayerOpen: mobilePlayerOpen ?? false });
    setPendingSecondary(null);
    setStep('bonus');
  };

  // --- Actions ---
  const confirmVerify = async () => {
    const specificStyle = track?.subStyle || track?.danceStyle || '';
    const ok = await submit(specificStyle, 'ok', null);
    if (ok) {
      // nextStep=null above skips submit()'s own success-analytics branch, since this
      // continues into the secondary-style ask rather than ending the flow — but the
      // confirmation itself still happened and should be counted.
      trackAnalytics('nudge_completed', track?.id, { step: 'verify', mobilePlayerOpen: mobilePlayerOpen ?? false });
      try {
        await showSecondaryConfirm();
      } catch {
        setStep('bonus');
      }
    } else {
      setJustConfirmed(false);
      setStep('success');
      setTimeout(() => setStep('hidden'), 2500);
    }
  };

  const confirmStyleOnly = () => {
    clearTimers();
    prevStepRef.current = 'verify-style-only';
    setCorrection((c) => ({
      ...c,
      main: track?.danceStyle ?? '',
      style: track?.subStyle || (track?.danceStyle ?? ''),
    }));
    setStep('ask-tempo');
  };

  const rejectStyleOnly = () => {
    clearTimers();
    setMode('correction');
    setCorrection((c) => ({ ...c, style: '', main: '' }));
    setStep('ask-main');
  };

  const selectMain = (mainStyle: string) => {
    const subs = styleVote.subStylesFor(mainStyle);

    if (subs.length === 0) {
      setCorrection((c) => ({ ...c, main: mainStyle, style: mainStyle }));
      setStep((prev) =>
        mode === 'addition' || prev.startsWith('fix') ? 'fix-tempo' : 'ask-tempo',
      );
    } else {
      setCorrection((c) => ({ ...c, main: mainStyle }));
      setStep((prev) =>
        mode === 'addition' || prev.startsWith('fix') ? 'fix-sub' : 'ask-sub',
      );
    }
  };

  const selectSub = (subStyle: string) => {
    setCorrection((c) => ({ ...c, style: subStyle }));
    setStep((prev) =>
      mode === 'addition' || prev.startsWith('fix') ? 'fix-tempo' : 'ask-tempo',
    );
  };

  const startCorrection = () => {
    clearTimers();
    setMode('correction');
    setStep('fix-main');
  };

  const startAddition = () => {
    clearTimers();
    setMode('addition');
    setCorrection((c) => ({ ...c, main: '', style: '' }));
    setStep('fix-main');
  };

  const submitFix = (tempoOverride?: string) => {
    const tempo = tempoOverride ?? correction.tempo;
    const style = correction.style;
    const mainStyle = correction.main || correction.style;
    submit(style || mainStyle, tempo, 'success');
  };

  const submitTempoSelection = (tempoCategory: string) => {
    const style = correction.style;
    const mainStyle = correction.main || correction.style;
    submit(style || mainStyle, tempoCategory, 'success');
  };

  // --- Color classes by mode ---
  // --- Compact style/tempo picker (native <select>, reusable) ---
  const renderStylePicker = (
    placeholder: string,
    items: { label: string; value: string; bold?: boolean }[],
    compactClassName: string,
    ariaLabel: string,
  ) => (
    <div className="mb-3">
      <StylePicker
        presentation="compact"
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        options={items.map((i) => ({ value: i.value, label: i.label, bold: i.bold }))}
        onSelect={(value) => {
          if (step === 'ask-main' || step === 'fix-main') selectMain(value);
          else selectSub(value);
        }}
        compactClassName={compactClassName}
      />
    </div>
  );

  if (step === 'hidden') return null;

  return (
    <div className={inline ? 'w-full' : 'fixed right-0 z-[130] px-4 pointer-events-none'} style={inline ? undefined : { bottom: `${bottomOffset ?? 96}px` }}>
      <div className={inline ? 'w-full' : 'max-w-2xl min-w-[320px] md:min-w-[360px] ml-auto pointer-events-auto'}>
        <div className="w-full relative z-0 mb-2 shadow-[var(--color-card-shadow)] rounded-[var(--radius-lg)] animate-in fade-in duration-200">
          {/* VERIFY: style + tempo */}
          {step === 'verify' && (
            <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4 text-[rgb(var(--color-text))] flex justify-between items-center gap-4">
              <div className="text-sm leading-snug">
                <p className="text-[13px] text-[rgb(var(--color-text-muted))]">Stämmer detta?</p>
                <p className="font-bold text-[15px]">
                  {track?.danceStyle}
                  {track?.subStyle && track.subStyle !== track.danceStyle && (
                    <span className="font-normal text-[rgb(var(--color-text-muted))]"> ({track.subStyle})</span>
                  )}
                  {' '}&bull; {tempoLabel}
                </p>
                {showFirstTimeHint && (
                  <p className="text-[13px] text-[rgb(var(--color-text-muted))] mt-1">
                    Din bekräftelse hjälper andra hitta låten.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={startCorrection}
                  className="min-h-11 rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-transparent px-4 text-sm font-semibold text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))] transition-colors"
                >
                  Nej, ändra
                </button>
                <button
                  onClick={confirmVerify}
                  disabled={isSubmitting}
                  className="min-h-11 rounded-[var(--radius)] bg-[rgb(var(--color-accent))] px-4 text-sm font-semibold text-[rgb(var(--color-accent-foreground))] hover:bg-[rgb(var(--color-accent-hover))] transition-colors disabled:opacity-50"
                >
                  Ja, stämmer
                </button>
              </div>
            </div>
          )}

          {/* VERIFY: style only (no tempo) */}
          {step === 'verify-style-only' && (
            <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4 text-[rgb(var(--color-text))] flex justify-between items-center gap-4">
              <div className="text-sm leading-snug">
                <p className="text-[13px] text-[rgb(var(--color-text-muted))]">Är detta en</p>
                <p className="font-bold text-[15px]">
                  {track?.danceStyle}
                  {track?.subStyle && track.subStyle !== track.danceStyle && (
                    <span className="font-normal text-[rgb(var(--color-text-muted))]"> ({track.subStyle})</span>
                  )}
                  ?
                </p>
                {showFirstTimeHint && (
                  <p className="text-[13px] text-[rgb(var(--color-text-muted))] mt-1">
                    Din bekräftelse hjälper andra hitta låten.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={rejectStyleOnly}
                  className="min-h-11 rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-transparent px-4 text-sm font-semibold text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))] transition-colors"
                >
                  Nej, ändra
                </button>
                <button
                  onClick={confirmStyleOnly}
                  disabled={isSubmitting}
                  className="min-h-11 rounded-[var(--radius)] bg-[rgb(var(--color-accent))] px-4 text-sm font-semibold text-[rgb(var(--color-accent-foreground))] hover:bg-[rgb(var(--color-accent-hover))] transition-colors disabled:opacity-50"
                >
                  Ja, stämmer
                </button>
              </div>
            </div>
          )}

          {/* CONFIRM SECONDARY */}
          {step === 'confirm-secondary' && pendingSecondary && (
            <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4 text-[rgb(var(--color-text))] flex justify-between items-center gap-4">
              <div className="text-sm leading-snug">
                <p className="text-[13px] text-[rgb(var(--color-text-muted))]">Kan man även dansa</p>
                <p className="font-bold text-[15px]">
                  {pendingSecondary.danceStyle}
                  {pendingSecondary.subStyle &&
                    pendingSecondary.subStyle !== pendingSecondary.danceStyle && (
                      <span className="font-normal text-[rgb(var(--color-text-muted))]">
                        {' '}({pendingSecondary.subStyle})
                      </span>
                    )}
                  ?
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={rejectSecondary}
                  className="min-h-11 rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-transparent px-4 text-sm font-semibold text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))] transition-colors"
                >
                  Nej
                </button>
                <button
                  onClick={confirmSecondaryHandler}
                  disabled={isSubmitting}
                  className="min-h-11 rounded-[var(--radius)] bg-[rgb(var(--color-accent))] px-4 text-sm font-semibold text-[rgb(var(--color-accent-foreground))] hover:bg-[rgb(var(--color-accent-hover))] transition-colors disabled:opacity-50"
                >
                  Ja
                </button>
              </div>
            </div>
          )}

          {/* ASK MAIN: no style at all */}
          {step === 'ask-main' && (
            <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4 text-[rgb(var(--color-text))]">
              <p className="text-sm font-semibold mb-3">
                Vad kan man dansa?
              </p>
              {showFirstTimeHint && (
                <p className="text-[13px] text-[rgb(var(--color-text-muted))] -mt-2 mb-3">
                  Din bekräftelse hjälper andra hitta låten.
                </p>
              )}
              {renderStylePicker(
                correction.main || 'Välj kategori...',
                styleVote.mainCategories.map((c) => ({ label: c, value: c })),
                'bg-[rgb(var(--color-bg-elevated))] border-[rgb(var(--color-border-strong))] text-[rgb(var(--color-text))]',
                'Välj dansstil',
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    trackAnalytics('nudge_dismissed', track?.id, { reason: 'vet_ej', step: stepRef.current, mobilePlayerOpen: mobilePlayerOpen ?? false });
                    if (track?.id) markSeen(track.id);
                    setStep('hidden');
                  }}
                  className="min-h-11 rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-transparent px-4 text-sm font-semibold text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))] transition-colors"
                >
                  Vet ej
                </button>
              </div>
            </div>
          )}

          {/* ASK SUB */}
          {step === 'ask-sub' && (
            <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4 text-[rgb(var(--color-text))]">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-semibold">
                  Vilken typ av {correction.main}?
                </p>
                <button
                  onClick={() => {
                    setStep('ask-main');
                    setCorrection((c) => ({ ...c, main: '' }));
                  }}
                  className="min-h-11 px-2 text-sm font-semibold text-[rgb(var(--color-link))] hover:underline"
                >
                  &larr; Ändra
                </button>
              </div>
              {renderStylePicker(
                'Välj variant...',
                [
                  {
                    label: `Vet ej / Allmän ${correction.main}`,
                    value: correction.main,
                    bold: true,
                  },
                  ...currentSubStyles.map((s) => ({ label: s, value: s })),
                ],
                'bg-[rgb(var(--color-bg-elevated))] border-[rgb(var(--color-border-strong))] text-[rgb(var(--color-text))]',
                `Välj variant av ${correction.main}`,
              )}
            </div>
          )}

          {/* ASK TEMPO */}
          {step === 'ask-tempo' && (
            <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4 text-[rgb(var(--color-text))]">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-semibold">
                  Hur snabb är {correction.style}n?
                </p>
                <button
                  onClick={() => {
                    if (prevStepRef.current === 'verify-style-only') {
                      prevStepRef.current = 'hidden';
                      setStep('verify-style-only');
                    } else {
                      setStep(currentSubStyles.length ? 'ask-sub' : 'ask-main');
                    }
                  }}
                  className="min-h-11 px-2 text-sm font-semibold text-[rgb(var(--color-link))] hover:underline"
                >
                  &larr; Tillbaka
                </button>
              </div>
              <TempoPicker
                presentation="compact"
                onSelect={(key) => submitTempoSelection(key)}
                compactClassName="bg-[rgb(var(--color-bg-elevated))] border-[rgb(var(--color-border-strong))] text-[rgb(var(--color-text))]"
              />
            </div>
          )}

          {/* FIX MAIN */}
          {step === 'fix-main' && (
            <div
              className={`rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4 text-[rgb(var(--color-text))] relative`}
            >
              <button
                onClick={() => setStep('menu')}
                className="absolute top-1 right-2 min-h-11 px-2 text-sm font-semibold text-[rgb(var(--color-link))] hover:underline"
              >
                &larr; Tillbaka
              </button>
              <p className="text-sm font-semibold mb-3">
                {mode === 'addition' ? 'Lägg till stil' : 'Korrekt dansstil'}
              </p>
              {renderStylePicker(
                correction.main || 'Välj kategori...',
                styleVote.mainCategories.map((c) => ({ label: c, value: c })),
                'bg-[rgb(var(--color-bg-elevated))] border-[rgb(var(--color-border-strong))] text-[rgb(var(--color-text))]',
                'Välj dansstil',
              )}
            </div>
          )}

          {/* FIX SUB */}
          {step === 'fix-sub' && (
            <div
              className={`rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4 text-[rgb(var(--color-text))] relative`}
            >
              <button
                onClick={() => setStep('fix-main')}
                className="absolute top-1 right-2 min-h-11 px-2 text-sm font-semibold text-[rgb(var(--color-link))] hover:underline"
              >
                &larr; Tillbaka
              </button>
              <p className="text-sm font-semibold mb-3">
                Vilken typ av {correction.main}?
              </p>
              {renderStylePicker(
                'Välj variant...',
                [
                  {
                    label: `Vet ej / Allmän ${correction.main}`,
                    value: correction.main,
                    bold: true,
                  },
                  ...currentSubStyles.map((s) => ({ label: s, value: s })),
                ],
                'bg-[rgb(var(--color-bg-elevated))] border-[rgb(var(--color-border-strong))] text-[rgb(var(--color-text))]',
                `Välj variant av ${correction.main}`,
              )}
            </div>
          )}

          {/* FIX TEMPO */}
          {step === 'fix-tempo' && (
            <div
              className={`rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4 text-[rgb(var(--color-text))]`}
            >
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-semibold">
                  Är {correction.style || 'dansen'} {tempoLabel}?
                </p>
                <button
                  onClick={() =>
                    setStep(currentSubStyles.length ? 'fix-sub' : 'fix-main')
                  }
                  className="min-h-11 px-2 text-sm font-semibold text-[rgb(var(--color-link))] hover:underline"
                >
                  &larr; Tillbaka
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => submitFix('half')}
                  className={`min-h-11 rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-transparent px-4 text-sm font-semibold text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))] transition-colors py-2 px-2 leading-tight`}
                >
                  Den är <br />
                  långsammare
                </button>
                <button
                  onClick={() => submitFix('ok')}
                  className={`min-h-11 rounded-[var(--radius)] bg-[rgb(var(--color-accent))] px-4 text-sm font-semibold text-[rgb(var(--color-accent-foreground))] hover:bg-[rgb(var(--color-accent-hover))] transition-colors disabled:opacity-50 py-2 px-2 leading-tight`}
                >
                  Ja, det är
                  <br />
                  rätt
                </button>
                <button
                  onClick={() => submitFix('double')}
                  className={`min-h-11 rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-transparent px-4 text-sm font-semibold text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))] transition-colors py-2 px-2 leading-tight`}
                >
                  Den är
                  <br />
                  snabbare
                </button>
              </div>
            </div>
          )}

          {/* MENU */}
          {step === 'menu' && (
            <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4 text-[rgb(var(--color-text))]">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-semibold">Ändra</p>
                <button
                  onClick={() => { trackAnalytics('nudge_dismissed', track?.id, { reason: 'close', step: stepRef.current, mobilePlayerOpen: mobilePlayerOpen ?? false }); if (track?.id) markSeen(track.id); setStep('hidden'); }}
                  className="min-h-11 px-2 text-sm font-semibold text-[rgb(var(--color-link))] hover:underline"
                >
                  Stäng
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 md:gap-2">
                <button
                  onClick={startCorrection}
                  className="min-h-11 rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-transparent px-4 text-sm font-semibold text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))] transition-colors py-2 flex flex-col items-center"
                >
                  <span>Rätta dansstilen</span>
                  <span className="text-[13px] font-normal text-[rgb(var(--color-text-muted))]">
                    Den här stämmer inte
                  </span>
                </button>
                <button
                  onClick={startAddition}
                  className="min-h-11 rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-transparent px-4 text-sm font-semibold text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))] transition-colors py-2 flex flex-col items-center"
                >
                  <span>Lägg till en stil</span>
                  <span className="text-[13px] font-normal text-[rgb(var(--color-text-muted))]">
                    Den går också att dansa
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* SUCCESS */}
          {step === 'success' && (
            <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4 text-[rgb(var(--color-text))] flex items-center gap-3">
              <div className="text-[15px] font-bold flex items-center gap-2">
                <svg
                  className="w-6 h-6 text-[rgb(var(--color-success))]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {justConfirmed ? 'Låten är nu bekräftad och syns i sökningar!' : 'Tack för hjälpen!'}
              </div>
            </div>
          )}

          {/* BONUS */}
          {step === 'bonus' && (
            <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4 text-[rgb(var(--color-text))] flex justify-between items-center gap-4">
              <div className="text-sm leading-snug">
                <p className="font-bold">
                  Tack! Går det att
                  <br />
                  dansa något annat?
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { trackAnalytics('nudge_dismissed', track?.id, { reason: 'nej', step: stepRef.current, mobilePlayerOpen: mobilePlayerOpen ?? false }); setStep('hidden'); }}
                  className="min-h-11 rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-transparent px-4 text-sm font-semibold text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))] transition-colors"
                >
                  Nej
                </button>
                <button
                  onClick={startAddition}
                  className="min-h-11 rounded-[var(--radius)] bg-[rgb(var(--color-accent))] px-4 text-sm font-semibold text-[rgb(var(--color-accent-foreground))] hover:bg-[rgb(var(--color-accent-hover))] transition-colors disabled:opacity-50"
                >
                  + Lägg till
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
