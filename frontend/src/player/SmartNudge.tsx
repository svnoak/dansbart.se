import { useState, useEffect, useRef, useCallback } from 'react';
import type { DanceStyleDto } from '@/api/models/danceStyleDto';
import type { TrackListDto } from '@/api/models/trackListDto';
import type { StyleNode } from '@/api/models/styleNode';
import { getStyleTree } from '@/api/generated/styles/styles';
import {
  submitFeedback,
  confirmSecondaryStyle,
  getSecondaryStyles,
} from '@/api/generated/tracks/tracks';
import { recordInteraction1 } from '@/api/generated/analytics/analytics';
import { getVoterId } from '@/utils/voter';
import { getTempoLabel } from '@/utils/tempoLabel';

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

type StyleTree = Record<string, string[]>;

interface SmartNudgeProps {
  track: TrackListDto | null;
  isPlaying: boolean;
}

function trackAnalytics(eventType: string, trackId?: string, eventData?: Record<string, unknown>) {
  recordInteraction1({
    trackId,
    eventType,
    eventData: eventData as Record<string, Record<string, unknown>> | undefined,
  }).catch(() => {});
}

export function SmartNudge({ track, isPlaying }: SmartNudgeProps) {
  const [step, setStep] = useState<Step>('hidden');
  const [mode, setMode] = useState<Mode>('correction');
  const [correction, setCorrection] = useState({ main: '', style: '', tempo: 'ok' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [styleTree, setStyleTree] = useState<StyleTree>({});
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

  const mainCategories = Object.keys(styleTree).sort();
  const currentSubStyles = correction.main ? styleTree[correction.main] ?? [] : [];

  const tempoLabel = getTempoLabel(track?.effectiveBpm);

  // --- Load styles on mount ---
  useEffect(() => {
    getStyleTree()
      .then((nodes: StyleNode[]) => {
        const tree: StyleTree = {};
        for (const node of nodes) {
          if (node.name) tree[node.name] = node.subStyles ?? [];
        }
        setStyleTree(tree);
      })
      .catch(() => {});
  }, []);

  // --- Close dropdown on outside click ---
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownOpen && !(e.target as Element).closest('.smart-nudge-dropdown')) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [dropdownOpen]);

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
      setDropdownOpen(false);
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

        trackAnalytics('nudge_shown', track?.id, {
          has_style: trackHasStyle,
          has_tempo: trackHasTempo,
        });

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
            trackAnalytics('nudge_dismissed', track?.id, { reason: 'auto_timeout' });
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
        await submitFeedback(
          track.id,
          { suggestedStyle, tempoCorrection },
          { headers: { 'X-Voter-ID': getVoterId() } },
        );
        localStorage.setItem(`fb_${track.id}`, 'true');
        if (nextStep === 'bonus') {
          setStep('bonus');
        } else if (nextStep === 'success') {
          setStep('success');
          setTimeout(() => setStep('hidden'), 2500);
        }
        return true;
      } catch {
        // Treat as confirmed even if API fails - avoid hiding the nudge
        localStorage.setItem(`fb_${track.id}`, 'true');
        if (nextStep === 'success') {
          setStep('success');
          setTimeout(() => setStep('hidden'), 2500);
        }
        return nextStep !== null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [track?.id, clearTimers],
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
      await confirmSecondaryStyle(track.id, { style: pendingSecondary.danceStyle });
      setStep('success');
      setTimeout(() => setStep('hidden'), 2500);
    } catch {
      setStep('bonus');
    } finally {
      setIsSubmitting(false);
    }
  };

  const rejectSecondary = () => {
    setPendingSecondary(null);
    setStep('bonus');
  };

  // --- Actions ---
  const confirmVerify = async () => {
    const specificStyle = track?.subStyle || track?.danceStyle || '';
    const ok = await submit(specificStyle, 'ok', null);
    if (ok) {
      try {
        await showSecondaryConfirm();
      } catch {
        setStep('bonus');
      }
    } else {
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
    setDropdownOpen(false);
    const subs = styleTree[mainStyle];

    if (!subs || subs.length === 0) {
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
    setDropdownOpen(false);
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
  const colorClasses =
    mode === 'addition'
      ? {
          bg: 'bg-teal-600',
          bgDark: 'bg-teal-700',
          btn: 'bg-teal-800 hover:bg-teal-900',
          text: 'text-teal-700',
          textLight: 'text-teal-200',
        }
      : {
          bg: 'bg-indigo-600',
          bgDark: 'bg-indigo-700',
          btn: 'bg-indigo-800 hover:bg-indigo-900',
          text: 'text-indigo-700',
          textLight: 'text-indigo-300',
        };

  // --- Dropdown button + list (reusable) ---
  const renderDropdown = (
    placeholder: string,
    items: { label: string; value: string; bold?: boolean }[],
    bgClass: string,
    borderClass: string,
    dropdownBorder: string,
  ) => (
    <div className="smart-nudge-dropdown relative mb-3 md:mb-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setDropdownOpen((o) => !o);
        }}
        className={`w-full ${bgClass} border ${borderClass} text-white text-left px-4 py-3 md:py-2 rounded text-sm md:text-xs font-medium flex justify-between items-center`}
      >
        <span>{placeholder}</span>
        <svg
          className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {dropdownOpen && (
        <div
          className={`absolute z-[200] w-full bottom-full mb-1 bg-white rounded-lg shadow-xl border ${dropdownBorder} max-h-60 overflow-y-auto`}
        >
          {items.map((item) => (
            <button
              key={item.value}
              onClick={() => {
                if (step === 'ask-main' || step === 'fix-main') selectMain(item.value);
                else selectSub(item.value);
              }}
              className={`w-full text-left px-4 py-2.5 md:py-2 text-sm md:text-xs transition-colors ${
                item.bold
                  ? 'text-indigo-900 bg-indigo-50 hover:bg-indigo-100 font-bold border-b border-indigo-100'
                  : 'text-gray-800 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (step === 'hidden') return null;

  return (
    <div className="fixed right-0 bottom-24 md:bottom-36 z-[130] px-4 pointer-events-none">
      <div className="max-w-2xl min-w-[320px] md:min-w-[360px] ml-auto pointer-events-auto">
        <div className="w-full relative z-0 mb-2 shadow-xl rounded-xl font-sans animate-in fade-in duration-200">
          {/* VERIFY: style + tempo */}
          {step === 'verify' && (
            <div className="bg-indigo-600 p-4 md:p-3 pb-5 md:pb-4 text-white flex justify-between items-center gap-6 md:gap-4 rounded-xl">
              <div className="text-sm md:text-xs leading-tight">
                <p className="opacity-80">Stammer detta?</p>
                <p className="font-bold text-base md:text-sm">
                  {track?.danceStyle}
                  {track?.subStyle && track.subStyle !== track.danceStyle && (
                    <span className="font-normal opacity-90"> ({track.subStyle})</span>
                  )}
                  {' '}&bull; {tempoLabel}
                </p>
              </div>
              <div className="flex gap-3 md:gap-2">
                <button
                  onClick={startCorrection}
                  className="bg-indigo-800 hover:bg-indigo-900 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors"
                >
                  Nej
                </button>
                <button
                  onClick={confirmVerify}
                  disabled={isSubmitting}
                  className="bg-white text-indigo-700 hover:bg-indigo-50 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors"
                >
                  Ja
                </button>
              </div>
            </div>
          )}

          {/* VERIFY: style only (no tempo) */}
          {step === 'verify-style-only' && (
            <div className="bg-indigo-600 p-4 md:p-3 pb-5 md:pb-4 text-white flex justify-between items-center gap-6 md:gap-4 rounded-xl">
              <div className="text-sm md:text-xs leading-tight">
                <p className="opacity-80">Ar detta en</p>
                <p className="font-bold text-base md:text-sm">
                  {track?.danceStyle}
                  {track?.subStyle && track.subStyle !== track.danceStyle && (
                    <span className="font-normal opacity-90"> ({track.subStyle})</span>
                  )}
                  ?
                </p>
              </div>
              <div className="flex gap-3 md:gap-2">
                <button
                  onClick={rejectStyleOnly}
                  className="bg-indigo-800 hover:bg-indigo-900 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors"
                >
                  Nej
                </button>
                <button
                  onClick={confirmStyleOnly}
                  disabled={isSubmitting}
                  className="bg-white text-indigo-700 hover:bg-indigo-50 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors"
                >
                  Ja
                </button>
              </div>
            </div>
          )}

          {/* CONFIRM SECONDARY */}
          {step === 'confirm-secondary' && pendingSecondary && (
            <div className="bg-amber-600 p-4 md:p-3 pb-5 md:pb-4 text-white flex justify-between items-center gap-6 md:gap-4 rounded-xl">
              <div className="text-sm md:text-xs leading-tight">
                <p className="opacity-80">Kan man aven dansa</p>
                <p className="font-bold text-base md:text-sm">
                  {pendingSecondary.danceStyle}
                  {pendingSecondary.subStyle &&
                    pendingSecondary.subStyle !== pendingSecondary.danceStyle && (
                      <span className="font-normal opacity-90">
                        {' '}({pendingSecondary.subStyle})
                      </span>
                    )}
                  ?
                </p>
              </div>
              <div className="flex gap-3 md:gap-2">
                <button
                  onClick={rejectSecondary}
                  className="bg-amber-800 hover:bg-amber-900 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors"
                >
                  Nej
                </button>
                <button
                  onClick={confirmSecondaryHandler}
                  disabled={isSubmitting}
                  className="bg-white text-amber-700 hover:bg-amber-50 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors"
                >
                  Ja!
                </button>
              </div>
            </div>
          )}

          {/* ASK MAIN: no style at all */}
          {step === 'ask-main' && (
            <div className="bg-purple-600 p-4 md:p-3 pb-5 md:pb-4 text-white rounded-xl">
              <p className="text-xs md:text-[10px] opacity-80 uppercase font-bold mb-3 md:mb-2">
                Vad kan man dansa?
              </p>
              {renderDropdown(
                correction.main || 'Valj kategori...',
                mainCategories.map((c) => ({ label: c, value: c })),
                'bg-purple-700 hover:bg-purple-800',
                'border-purple-500',
                'border-purple-200',
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setStep('hidden');
                    setDropdownOpen(false);
                  }}
                  className="bg-purple-800 hover:bg-purple-900 text-sm md:text-[10px] font-bold px-4 py-2.5 md:px-3 md:py-1.5 rounded transition-colors"
                >
                  Vet ej
                </button>
              </div>
            </div>
          )}

          {/* ASK SUB */}
          {step === 'ask-sub' && (
            <div className="bg-purple-600 p-4 md:p-3 pb-5 md:pb-4 text-white rounded-xl">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs md:text-[10px] opacity-80 uppercase font-bold">
                  Vilken typ av {correction.main}?
                </p>
                <button
                  onClick={() => {
                    setStep('ask-main');
                    setCorrection((c) => ({ ...c, main: '' }));
                  }}
                  className="text-xs md:text-[10px] text-purple-300 hover:text-white"
                >
                  &larr; Andra
                </button>
              </div>
              {renderDropdown(
                'Valj variant...',
                [
                  {
                    label: `Vet ej / Allman ${correction.main}`,
                    value: correction.main,
                    bold: true,
                  },
                  ...currentSubStyles.map((s) => ({ label: s, value: s })),
                ],
                'bg-purple-700 hover:bg-purple-800',
                'border-purple-500',
                'border-purple-200',
              )}
            </div>
          )}

          {/* ASK TEMPO */}
          {step === 'ask-tempo' && (
            <div className="bg-purple-700 p-4 md:p-3 pb-5 md:pb-4 text-white rounded-xl">
              <div className="flex justify-between items-center mb-3 md:mb-2">
                <p className="text-xs md:text-[10px] opacity-80 uppercase font-bold">
                  Hur snabb ar {correction.style}n?
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
                  className="text-xs md:text-[10px] text-purple-300 hover:text-white"
                >
                  &larr; Tillbaka
                </button>
              </div>
              <div className="grid grid-cols-5 gap-2 md:gap-1">
                {(['Langsamt', 'Lugnt', 'Lagom', 'Snabbt', 'V. snabbt'] as const).map(
                  (label) => (
                    <button
                      key={label}
                      onClick={() => submitTempoSelection(label === 'V. snabbt' ? 'Valdigt snabbt' : label)}
                      className="bg-purple-800 hover:bg-purple-900 border border-white/20 text-sm md:text-[10px] py-3 md:py-2 rounded"
                    >
                      {label}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}

          {/* FIX MAIN */}
          {step === 'fix-main' && (
            <div
              className={`${colorClasses.bg} p-4 md:p-3 pb-5 md:pb-4 text-white relative rounded-xl`}
            >
              <button
                onClick={() => setStep('menu')}
                className={`absolute top-2 md:top-1 right-3 md:right-2 text-sm md:text-xs ${colorClasses.textLight}`}
              >
                &larr; Tillbaka
              </button>
              <p className="text-xs md:text-[10px] opacity-80 uppercase font-bold mb-3 md:mb-2">
                {mode === 'addition' ? 'Lagg till stil' : 'Korrekt dansstil'}
              </p>
              {renderDropdown(
                correction.main || 'Valj kategori...',
                mainCategories.map((c) => ({ label: c, value: c })),
                `${colorClasses.btn}`,
                'border-white/20',
                'border-gray-200',
              )}
            </div>
          )}

          {/* FIX SUB */}
          {step === 'fix-sub' && (
            <div
              className={`${colorClasses.bg} p-4 md:p-3 pb-5 md:pb-4 text-white relative rounded-xl`}
            >
              <button
                onClick={() => setStep('fix-main')}
                className={`absolute top-2 md:top-1 right-3 md:right-2 text-sm md:text-xs ${colorClasses.textLight}`}
              >
                &larr; Tillbaka
              </button>
              <p className="text-xs md:text-[10px] opacity-80 uppercase font-bold mb-3 md:mb-2">
                Vilken typ av {correction.main}?
              </p>
              {renderDropdown(
                'Valj variant...',
                [
                  {
                    label: `Vet ej / Allman ${correction.main}`,
                    value: correction.main,
                    bold: true,
                  },
                  ...currentSubStyles.map((s) => ({ label: s, value: s })),
                ],
                `${colorClasses.btn}`,
                'border-white/20',
                'border-gray-200',
              )}
            </div>
          )}

          {/* FIX TEMPO */}
          {step === 'fix-tempo' && (
            <div
              className={`${colorClasses.bgDark} p-4 md:p-3 pb-5 md:pb-4 text-white rounded-xl`}
            >
              <div className="flex justify-between items-center mb-3 md:mb-2">
                <p className="text-xs md:text-[10px] opacity-80 uppercase font-bold">
                  Ar {correction.style || 'dansen'} {tempoLabel}?
                </p>
                <button
                  onClick={() =>
                    setStep(currentSubStyles.length ? 'fix-sub' : 'fix-main')
                  }
                  className={`text-xs md:text-[10px] hover:text-white ${colorClasses.textLight}`}
                >
                  &larr; Tillbaka
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 md:gap-2">
                <button
                  onClick={() => submitFix('half')}
                  className={`${colorClasses.btn} border border-white/20 text-sm md:text-[10px] py-3 md:py-2 rounded leading-tight transition-colors`}
                >
                  Den ar <br />
                  langsammare
                </button>
                <button
                  onClick={() => submitFix('ok')}
                  className={`bg-white hover:bg-gray-50 font-bold text-sm md:text-[10px] py-3 md:py-2 rounded ${colorClasses.text}`}
                >
                  Ja, det ar
                  <br />
                  ratt
                </button>
                <button
                  onClick={() => submitFix('double')}
                  className={`${colorClasses.btn} border border-white/20 text-sm md:text-[10px] py-3 md:py-2 rounded leading-tight transition-colors`}
                >
                  Den ar
                  <br />
                  snabbare
                </button>
              </div>
            </div>
          )}

          {/* MENU */}
          {step === 'menu' && (
            <div className="bg-gray-800 p-4 md:p-3 pb-5 md:pb-4 text-white rounded-xl">
              <div className="flex justify-between items-center mb-3 md:mb-2">
                <p className="text-sm md:text-xs font-bold text-gray-400 uppercase">Redigera</p>
                <button
                  onClick={() => setStep('hidden')}
                  className="text-gray-400 hover:text-white text-sm md:text-xs"
                >
                  Stang
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 md:gap-2">
                <button
                  onClick={startCorrection}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm md:text-xs font-bold py-3 md:py-2 rounded flex flex-col items-center"
                >
                  <span>Ratta Huvudstil</span>
                  <span className="text-xs md:text-[9px] opacity-75 font-normal">
                    Detta ar fel
                  </span>
                </button>
                <button
                  onClick={startAddition}
                  className="bg-teal-600 hover:bg-teal-700 text-white text-sm md:text-xs font-bold py-3 md:py-2 rounded flex flex-col items-center"
                >
                  <span>Lagg till Alt.</span>
                  <span className="text-xs md:text-[9px] opacity-75 font-normal">
                    Detta ar ocksa...
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* SUCCESS */}
          {step === 'success' && (
            <div className="bg-green-600 p-5 md:p-4 text-white flex justify-center items-center rounded-xl">
              <div className="text-base md:text-sm font-bold flex items-center gap-2">
                <svg
                  className="w-6 h-6 md:w-5 md:h-5"
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
                Tack for hjalpen!
              </div>
            </div>
          )}

          {/* BONUS */}
          {step === 'bonus' && (
            <div className="bg-teal-600 p-4 md:p-3 pb-5 md:pb-4 text-white flex justify-between items-center gap-6 md:gap-4 rounded-xl">
              <div className="text-sm md:text-xs leading-tight">
                <p className="font-bold opacity-90">
                  Tack! Gar det att
                  <br />
                  dansa nagot annat?
                </p>
              </div>
              <div className="flex gap-3 md:gap-2">
                <button
                  onClick={() => setStep('hidden')}
                  className="bg-teal-800 hover:bg-teal-900 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors"
                >
                  Nej
                </button>
                <button
                  onClick={startAddition}
                  className="bg-white text-teal-700 hover:bg-teal-50 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors"
                >
                  + Lagg till
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
