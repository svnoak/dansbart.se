import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon, FlagIcon, ChevronDownIcon } from '@/icons';
import { getStyleTree } from '@/api/generated/styles/styles';
import { flagTrack, submitFeedback } from '@/api/generated/tracks/tracks';
import type { TrackListDto } from '@/api/models/trackListDto';
import type { StyleNode } from '@/api/models/styleNode';

type View =
  | 'menu'
  | 'verify_style_tempo'
  | 'verify_style_only'
  | 'confirm_folk'
  | 'options_link'
  | 'ask_main'
  | 'ask_sub'
  | 'ask_tempo'
  | 'fix_main'
  | 'fix_sub'
  | 'fix_tempo'
  | 'success';

interface FlagTrackModalProps {
  open: boolean;
  onClose: () => void;
  track: TrackListDto;
  onRefresh?: () => void;
}

const TEMPO_BUTTONS: { key: string; label: string }[] = [
  { key: 'Slow', label: 'L\u00e5ngsamt' },
  { key: 'SlowMed', label: 'Lugnt' },
  { key: 'Medium', label: 'Lagom' },
  { key: 'Fast', label: 'Snabbt' },
  { key: 'Turbo', label: 'V. snabbt' },
];

export function FlagTrackModal({ open, onClose, track, onRefresh }: FlagTrackModalProps) {
  const [view, setView] = useState<View>('menu');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const [correctionMain, setCorrectionMain] = useState('');
  const [correctionStyle, setCorrectionStyle] = useState('');
  const [correctionTempo, setCorrectionTempo] = useState('ok');

  const [styleTree, setStyleTree] = useState<Record<string, string[]>>({});
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasStyle =
    typeof track.danceStyle === 'string' &&
    track.danceStyle.length > 0 &&
    track.danceStyle !== 'Unknown' &&
    track.danceStyle !== 'Unclassified';

  const hasTempo = (track.effectiveBpm ?? 0) > 0;

  const hasSubStyle = !!track.subStyle && track.subStyle !== track.danceStyle;

  const youtubeLink = track.playbackLinks?.find(
    (l) =>
      l.platform?.toUpperCase() === 'YOUTUBE' ||
      l.deepLink?.includes('youtube') ||
      l.deepLink?.includes('youtu.be'),
  );

  const mainCategories = Object.keys(styleTree).sort();
  const currentSubStyles = correctionMain ? styleTree[correctionMain] ?? [] : [];

  const resetCorrection = useCallback(() => {
    setCorrectionMain(track.danceStyle ?? '');
    setCorrectionStyle(track.subStyle ?? track.danceStyle ?? '');
    setCorrectionTempo('ok');
  }, [track.danceStyle, track.subStyle]);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open && !prevOpen) {
    setView('menu');
    setError(null);
    setIsSubmitting(false);
    setSuccessMessage('');
    setDropdownOpen(false);
    resetCorrection();
  }
  if (prevOpen !== open) {
    setPrevOpen(open);
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open || Object.keys(styleTree).length > 0) return;
    getStyleTree()
      .then((nodes: StyleNode[]) => {
        const tree: Record<string, string[]> = {};
        for (const node of nodes) {
          if (node.name) tree[node.name] = node.subStyles ?? [];
        }
        setStyleTree(tree);
      })
      .catch(() => {});
  }, [open, styleTree]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function finish(message: string) {
    setSuccessMessage(message);
    setView('success');
    closeTimerRef.current = setTimeout(() => {
      onRefresh?.();
      onClose();
    }, 1500);
  }

  async function handleSubmitNotFolk() {
    if (!track.id) return;
    setIsSubmitting(true);
    try {
      await flagTrack(track.id);
      finish('Rapporterad som ej dansbart');
    } catch {
      setError('Kunde inte rapportera');
      setIsSubmitting(false);
    }
  }

  async function handleSubmitBrokenLink(reason: 'wrong_track' | 'broken') {
    if (!track.id) return;
    setIsSubmitting(true);
    try {
      if (youtubeLink?.id) {
        await fetch(`/api/tracks/links/${youtubeLink.id}/report?reason=${reason}`, {
          method: 'PATCH',
        });
      } else {
        await flagTrack(track.id, { reason });
      }
      finish(
        reason === 'wrong_track'
          ? 'Rapporterad: Fel l\u00e5t'
          : 'Rapporterad: Trasig l\u00e4nk',
      );
    } catch {
      setError('Kunde inte skicka');
      setIsSubmitting(false);
    }
  }

  async function handleSubmitStyleTempo(tempoOverride?: string) {
    if (!correctionStyle) {
      setError('V\u00e4lj stil');
      return;
    }
    if (!track.id) return;
    setIsSubmitting(true);
    try {
      await submitFeedback(track.id, {
        suggestedStyle: correctionStyle,
        tempoCorrection: tempoOverride ?? correctionTempo,
      });
      finish('Tack f\u00f6r att du bidrar till att g\u00f6ra sidan b\u00e4ttre!');
    } catch {
      setError('Kunde inte skicka');
      setIsSubmitting(false);
    }
  }

  function selectMain(cat: string, flowType: 'ask' | 'fix') {
    setCorrectionMain(cat);
    setDropdownOpen(false);
    const subs = styleTree[cat];
    if (!subs || subs.length === 0) {
      setCorrectionStyle(cat);
      setView(flowType === 'fix' ? 'fix_tempo' : 'ask_tempo');
    } else {
      setView(flowType === 'fix' ? 'fix_sub' : 'ask_sub');
    }
  }

  function selectSub(sub: string, flowType: 'ask' | 'fix') {
    setCorrectionStyle(sub);
    setDropdownOpen(false);
    setView(flowType === 'fix' ? 'fix_tempo' : 'ask_tempo');
  }

  if (!open) return null;

  function renderDropdown(flowType: 'ask' | 'fix', showSubs: boolean) {
    const items = showSubs ? currentSubStyles : mainCategories;

    return (
      <div className="relative mb-6">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDropdownOpen((o) => !o);
          }}
          className="flex w-full items-center justify-between rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-4 py-3 text-left text-sm font-medium text-[rgb(var(--color-text))] hover:border-[rgb(var(--color-accent))]"
        >
          <span>
            {showSubs
              ? 'V\u00e4lj variant...'
              : correctionMain || 'V\u00e4lj kategori...'}
          </span>
          <ChevronDownIcon
            className={`h-5 w-5 text-[rgb(var(--color-text-muted))] transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {dropdownOpen && (
          <div className="absolute z-[200] mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] shadow-xl">
            {showSubs && (
              <button
                type="button"
                onClick={() => selectSub(correctionMain, flowType)}
                className="w-full border-b border-[rgb(var(--color-border))] px-4 py-3 text-left text-sm font-bold text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-accent))]/10"
              >
                Vet ej / Allm\u00e4n {correctionMain}
              </button>
            )}
            {items.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() =>
                  showSubs
                    ? selectSub(item, flowType)
                    : selectMain(item, flowType)
                }
                className="w-full px-4 py-3 text-left text-sm text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent))]/10"
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderContent() {
    switch (view) {
      case 'menu':
        return (
          <div className="flex flex-col gap-3">
            <p className="mb-1 text-sm text-[rgb(var(--color-text-muted))]">
              Vad {'\u00e4'}r fel med den h{'\u00e4'}r l{'\u00e5'}ten?
            </p>
            <button
              type="button"
              onClick={() =>
                setView(
                  hasStyle && hasTempo
                    ? 'verify_style_tempo'
                    : hasStyle
                      ? 'verify_style_only'
                      : 'ask_main',
                )
              }
              className="group flex w-full items-center gap-3 rounded-lg border border-[rgb(var(--color-border))] p-3 text-left transition-all hover:border-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-accent))]/5"
            >
              <div className="rounded-full bg-[rgb(var(--color-border))]/50 p-2.5 text-[rgb(var(--color-text-muted))] group-hover:bg-[rgb(var(--color-bg))] group-hover:text-[rgb(var(--color-accent))]">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-bold text-[rgb(var(--color-text))]">Dansstil / Tempo</div>
                <div className="text-xs text-[rgb(var(--color-text-muted))]">Korrigera eller bekr{'\u00e4'}fta</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setView('confirm_folk')}
              className="group flex w-full items-center gap-3 rounded-lg border border-[rgb(var(--color-border))] p-3 text-left transition-all hover:border-amber-300 hover:bg-amber-50"
            >
              <div className="rounded-full bg-[rgb(var(--color-border))]/50 p-2.5 text-[rgb(var(--color-text-muted))] group-hover:bg-white group-hover:text-amber-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} strokeDasharray="2 2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-bold text-[rgb(var(--color-text))]">Inte dansbart</div>
                <div className="text-xs text-[rgb(var(--color-text-muted))]">Går inte att dansa folkdans till</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setView('options_link')}
              disabled={!youtubeLink}
              className="group flex w-full items-center gap-3 rounded-lg border border-[rgb(var(--color-border))] p-3 text-left transition-all hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
            >
              <div className="rounded-full bg-[rgb(var(--color-border))]/50 p-2.5 text-[rgb(var(--color-text-muted))] group-hover:bg-white group-hover:text-red-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-bold text-[rgb(var(--color-text))]">L{'\u00e4'}nk / Uppspelning</div>
                <div className="text-xs text-[rgb(var(--color-text-muted))]">Trasig l{'\u00e4'}nk eller fel l{'\u00e5'}t</div>
              </div>
            </button>
          </div>
        );

      case 'verify_style_tempo':
        return (
          <div>
            <p className="mb-4 text-sm text-[rgb(var(--color-text))]">St{'\u00e4'}mmer detta?</p>
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="text-lg font-bold text-blue-900">
                {track.danceStyle}
                {hasSubStyle && (
                  <span className="font-normal text-blue-700"> ({track.subStyle})</span>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setView('menu')} className="px-3 py-2 text-sm text-[rgb(var(--color-text-muted))]">Tillbaka</button>
              <button type="button" onClick={() => setView('fix_main')} className="rounded bg-[rgb(var(--color-border))] px-4 py-2 text-sm font-bold text-[rgb(var(--color-text))]">Nej, r{'\u00e4'}tta</button>
              <button type="button" onClick={() => handleSubmitStyleTempo()} disabled={isSubmitting} className="rounded bg-[rgb(var(--color-accent))] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Ja, st{'\u00e4'}mmer</button>
            </div>
          </div>
        );

      case 'verify_style_only':
        return (
          <div>
            <p className="mb-4 text-sm text-[rgb(var(--color-text))]">{'\u00c4'}r detta en</p>
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="text-lg font-bold text-blue-900">
                {track.danceStyle}
                {hasSubStyle && (
                  <span className="font-normal text-blue-700"> ({track.subStyle})</span>
                )}
                ?
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setView('menu')} className="px-3 py-2 text-sm text-[rgb(var(--color-text-muted))]">Tillbaka</button>
              <button
                type="button"
                onClick={() => {
                  setCorrectionStyle('');
                  setView('ask_main');
                }}
                className="rounded bg-[rgb(var(--color-border))] px-4 py-2 text-sm font-bold text-[rgb(var(--color-text))]"
              >
                Nej
              </button>
              <button
                type="button"
                onClick={() => {
                  setCorrectionStyle(track.subStyle ?? track.danceStyle ?? '');
                  setView('ask_tempo');
                }}
                className="rounded bg-[rgb(var(--color-accent))] px-4 py-2 text-sm font-bold text-white"
              >
                Ja
              </button>
            </div>
          </div>
        );

      case 'confirm_folk':
        return (
          <div>
            <p className="mb-4 text-sm text-[rgb(var(--color-text))]">
              {'\u00c4'}r du s{'\u00e4'}ker p{'\u00e5'} att du vill rapportera <strong>{track.title}</strong> som <strong>inte dansbart</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setView('menu')} className="px-3 py-2 text-sm text-[rgb(var(--color-text-muted))]">Tillbaka</button>
              <button type="button" onClick={handleSubmitNotFolk} disabled={isSubmitting} className="rounded bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Rapportera</button>
            </div>
          </div>
        );

      case 'options_link':
        return (
          <div>
            <p className="mb-4 text-sm text-[rgb(var(--color-text))]">Vad {'\u00e4'}r fel med YouTube-l{'\u00e4'}nken?</p>
            <div className="mb-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSubmitBrokenLink('wrong_track')}
                disabled={isSubmitting}
                className="rounded border border-orange-200 bg-orange-50 p-4 text-sm font-bold text-orange-800 disabled:opacity-50"
              >
                Fel l{'\u00e5'}t
              </button>
              <button
                type="button"
                onClick={() => handleSubmitBrokenLink('broken')}
                disabled={isSubmitting}
                className="rounded border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800 disabled:opacity-50"
              >
                Trasig
              </button>
            </div>
            <div className="text-center">
              <button type="button" onClick={() => setView('menu')} className="text-xs text-[rgb(var(--color-text-muted))] underline">Tillbaka</button>
            </div>
          </div>
        );

      case 'ask_main':
        return (
          <div>
            <p className="mb-1 text-sm font-bold text-[rgb(var(--color-text))]">Vad kan man dansa?</p>
            <p className="mb-4 text-xs text-[rgb(var(--color-text-muted))]">V{'\u00e4'}lj huvudkategori</p>
            {renderDropdown('ask', false)}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setView('menu');
                  setDropdownOpen(false);
                }}
                className="px-3 py-2 text-sm text-[rgb(var(--color-text-muted))]"
              >
                Tillbaka
              </button>
            </div>
          </div>
        );

      case 'ask_sub':
        return (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-bold text-[rgb(var(--color-text))]">Vilken typ av {correctionMain}?</p>
              <button
                type="button"
                onClick={() => {
                  setView('ask_main');
                  setCorrectionMain('');
                }}
                className="text-xs text-[rgb(var(--color-accent))] hover:underline"
              >
                {'\u00c4'}ndra
              </button>
            </div>
            {renderDropdown('ask', true)}
          </div>
        );

      case 'ask_tempo':
        return (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[rgb(var(--color-text))]">Hur snabb {'\u00e4'}r {correctionStyle}n?</p>
                <p className="text-xs text-[rgb(var(--color-text-muted))]">V{'\u00e4'}lj tempokategori</p>
              </div>
              <button
                type="button"
                onClick={() => setView(currentSubStyles.length ? 'ask_sub' : 'ask_main')}
                className="text-xs text-[rgb(var(--color-text-muted))]"
              >
                Tillbaka
              </button>
            </div>
            <div className="mb-6 grid grid-cols-5 gap-2">
              {TEMPO_BUTTONS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSubmitStyleTempo(key)}
                  disabled={isSubmitting}
                  className="rounded bg-[rgb(var(--color-accent))] py-4 text-xs font-bold text-white disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        );

      case 'fix_main':
        return (
          <div>
            <p className="mb-1 text-sm font-bold text-[rgb(var(--color-text))]">Korrekt dansstil</p>
            <p className="mb-4 text-xs text-[rgb(var(--color-text-muted))]">V{'\u00e4'}lj huvudkategori</p>
            {renderDropdown('fix', false)}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setView('menu');
                  setDropdownOpen(false);
                }}
                className="px-3 py-2 text-sm text-[rgb(var(--color-text-muted))]"
              >
                Tillbaka
              </button>
            </div>
          </div>
        );

      case 'fix_sub':
        return (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-bold text-[rgb(var(--color-text))]">Vilken typ av {correctionMain}?</p>
              <button
                type="button"
                onClick={() => {
                  setView('fix_main');
                  setCorrectionMain('');
                }}
                className="text-xs text-[rgb(var(--color-accent))] hover:underline"
              >
                {'\u00c4'}ndra
              </button>
            </div>
            {renderDropdown('fix', true)}
          </div>
        );

      case 'fix_tempo':
        return (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[rgb(var(--color-text))]">
                  {'\u00c4'}r {correctionStyle || 'dansen'} r{'\u00e4'}tt tempo?
                </p>
                <p className="text-xs text-[rgb(var(--color-text-muted))]">Bekr{'\u00e4'}fta eller korrigera tempot</p>
              </div>
              <button
                type="button"
                onClick={() => setView(currentSubStyles.length ? 'fix_sub' : 'fix_main')}
                className="text-xs text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
              >
                Tillbaka
              </button>
            </div>
            <div className="mb-6 grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleSubmitStyleTempo('half')}
                disabled={isSubmitting}
                className="rounded-lg bg-[rgb(var(--color-accent))] py-5 text-sm font-bold leading-tight text-white disabled:opacity-50"
              >
                Den {'\u00e4'}r<br />l{'\u00e5'}ngsammare
              </button>
              <button
                type="button"
                onClick={() => handleSubmitStyleTempo('ok')}
                disabled={isSubmitting}
                className="rounded-lg border-2 border-[rgb(var(--color-accent))] bg-[rgb(var(--color-bg))] py-5 text-sm font-bold text-[rgb(var(--color-accent))] disabled:opacity-50"
              >
                Ja, det {'\u00e4'}r<br />r{'\u00e4'}tt
              </button>
              <button
                type="button"
                onClick={() => handleSubmitStyleTempo('double')}
                disabled={isSubmitting}
                className="rounded-lg bg-[rgb(var(--color-accent))] py-5 text-sm font-bold leading-tight text-white disabled:opacity-50"
              >
                Den {'\u00e4'}r<br />snabbare
              </button>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="py-6 text-center">
            <svg className="mx-auto mb-2 h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4 className="text-lg font-bold text-[rgb(var(--color-text))]">Tack!</h4>
            <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">{successMessage}</p>
          </div>
        );
    }
  }

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50 hover:text-[rgb(var(--color-text))]"
        >
          <CloseIcon className="h-5 w-5" aria-hidden />
        </button>

        <h3 className="mb-5 flex items-center gap-2 border-b border-[rgb(var(--color-border))] pb-3 pr-8 text-lg font-bold text-[rgb(var(--color-text))]">
          {view === 'success' ? (
            <span className="text-green-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          ) : (
            <span className="text-amber-600">
              <FlagIcon className="h-5 w-5" aria-hidden />
            </span>
          )}
          <span>{view === 'success' ? 'Tack!' : 'Rapportera problem'}</span>
        </h3>

        {error && (
          <div className="mb-4 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {renderContent()}
      </div>
    </div>,
    document.body,
  );
}
