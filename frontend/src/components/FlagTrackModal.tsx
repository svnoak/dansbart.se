import { useState, useEffect, useCallback, useRef, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon, CloseIcon, FlagIcon } from '@/icons';
import { flagTrack } from '@/api/generated/tracks/tracks';
import { useStyleVote } from '@/hooks/useStyleVote';
import { StylePicker } from '@/components/StylePicker';
import { TEMPO_OPTIONS } from '@/utils/tempoOptions';
import { Button, IconButton, InlineError } from '@/ui';
import type { TrackListDto } from '@/api/models/trackListDto';

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

const headingClass = 'text-[15px] font-bold text-[rgb(var(--color-text))]';
const hintClass = 'text-[13px] text-[rgb(var(--color-text-muted))]';

/** One choice in the opening menu: a 56 px row with an icon tile and two lines of text. */
function MenuOption({
  icon,
  title,
  hint,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full min-h-14 items-center gap-3 rounded-[var(--radius)] border border-[rgb(var(--color-border))] px-3 py-2 text-left transition-colors hover:bg-[rgb(var(--color-accent-muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))] disabled:opacity-50"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text))]"
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className={`block ${headingClass}`}>{title}</span>
        <span className={`block ${hintClass}`}>{hint}</span>
      </span>
    </button>
  );
}

export function FlagTrackModal({ open, onClose, track, onRefresh }: FlagTrackModalProps) {
  const [view, setView] = useState<View>('menu');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const [correctionMain, setCorrectionMain] = useState('');
  const [correctionStyle, setCorrectionStyle] = useState('');
  const [correctionTempo, setCorrectionTempo] = useState('ok');

  const styleVote = useStyleVote(track.id, open);

  const overlayRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleId = useId();

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

  const currentSubStyles = styleVote.subStylesFor(correctionMain);

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
          ? 'Rapporterad: Fel låt'
          : 'Rapporterad: Trasig länk',
      );
    } catch {
      setError('Kunde inte skicka');
      setIsSubmitting(false);
    }
  }

  async function handleSubmitStyleTempo(tempoOverride?: string) {
    if (!correctionStyle) {
      setError('Välj stil');
      return;
    }
    if (!track.id) return;
    setIsSubmitting(true);
    const { success } = await styleVote.submit(correctionStyle, tempoOverride ?? correctionTempo);
    if (success) {
      finish('Tack för att du bidrar till att göra sidan bättre!');
    } else {
      setError('Kunde inte skicka');
      setIsSubmitting(false);
    }
  }

  function selectMain(cat: string, flowType: 'ask' | 'fix') {
    setCorrectionMain(cat);
    const subs = styleVote.subStylesFor(cat);
    if (subs.length === 0) {
      setCorrectionStyle(cat);
      setView(flowType === 'fix' ? 'fix_tempo' : 'ask_tempo');
    } else {
      setView(flowType === 'fix' ? 'fix_sub' : 'ask_sub');
    }
  }

  function selectSub(sub: string, flowType: 'ask' | 'fix') {
    setCorrectionStyle(sub);
    setView(flowType === 'fix' ? 'fix_tempo' : 'ask_tempo');
  }

  if (!open) return null;

  function renderStylePicker(flowType: 'ask' | 'fix', showSubs: boolean) {
    const items = showSubs
      ? [
          { value: correctionMain, label: `Vet ej / Allmän ${correctionMain}`, bold: true },
          ...currentSubStyles.map((s) => ({ value: s, label: s })),
        ]
      : styleVote.mainCategories.map((c) => ({ value: c, label: c }));

    return (
      <StylePicker
        presentation="full"
        options={items}
        placeholder={showSubs ? 'Välj variant...' : 'Välj kategori...'}
        onSelect={(value) =>
          showSubs ? selectSub(value, flowType) : selectMain(value, flowType)
        }
      />
    );
  }

  /** The style the track has today, shown as a quiet card for the person to confirm. */
  function renderCurrentStyleCard(trailing = '') {
    return (
      <div className="mb-5 rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-4 py-3">
        <div className="text-[17px] font-bold text-[rgb(var(--color-text))]">
          {track.danceStyle}
          {hasSubStyle && (
            <span className="font-normal text-[rgb(var(--color-text-muted))]"> ({track.subStyle})</span>
          )}
          {trailing}
        </div>
      </div>
    );
  }

  function renderContent() {
    switch (view) {
      case 'menu':
        return (
          <div className="flex flex-col gap-2">
            <p className="mb-1 text-[15px] text-[rgb(var(--color-text-muted))]">
              Vad {'ä'}r fel med den h{'ä'}r l{'å'}ten?
            </p>
            <MenuOption
              title="Dansstil / tempo"
              hint={`Korrigera eller bekräfta`}
              onClick={() =>
                setView(
                  hasStyle && hasTempo
                    ? 'verify_style_tempo'
                    : hasStyle
                      ? 'verify_style_only'
                      : 'ask_main',
                )
              }
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              }
            />
            <MenuOption
              title="Inte dansbart"
              hint="Går inte att dansa folkdans till"
              onClick={() => setView('confirm_folk')}
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} strokeDasharray="2 2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              }
            />
            <MenuOption
              title={`Länk / uppspelning`}
              hint={`Trasig länk eller fel låt`}
              onClick={() => setView('options_link')}
              disabled={!youtubeLink}
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              }
            />
          </div>
        );

      case 'verify_style_tempo':
        return (
          <div>
            <p className="mb-3 text-[15px] text-[rgb(var(--color-text))]">St{'ä'}mmer detta?</p>
            {renderCurrentStyleCard()}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setView('menu')}>Tillbaka</Button>
              <Button variant="outline" onClick={() => setView('fix_main')}>Nej, r{'ä'}tta</Button>
              <Button variant="primary" onClick={() => handleSubmitStyleTempo()} disabled={isSubmitting}>
                Ja, st{'ä'}mmer
              </Button>
            </div>
          </div>
        );

      case 'verify_style_only':
        return (
          <div>
            <p className="mb-3 text-[15px] text-[rgb(var(--color-text))]">{'Ä'}r detta en</p>
            {renderCurrentStyleCard('?')}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setView('menu')}>Tillbaka</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setCorrectionStyle('');
                  setView('ask_main');
                }}
              >
                Nej
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setCorrectionStyle(track.subStyle ?? track.danceStyle ?? '');
                  setView('ask_tempo');
                }}
              >
                Ja
              </Button>
            </div>
          </div>
        );

      case 'confirm_folk':
        return (
          <div>
            <p className="mb-5 text-[15px] text-[rgb(var(--color-text))]">
              {'Ä'}r du s{'ä'}ker p{'å'} att du vill rapportera <strong>{track.title}</strong> som <strong>inte dansbart</strong>?
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setView('menu')}>Tillbaka</Button>
              <Button variant="primary" onClick={handleSubmitNotFolk} disabled={isSubmitting}>Rapportera</Button>
            </div>
          </div>
        );

      case 'options_link':
        return (
          <div>
            <p className="mb-4 text-[15px] text-[rgb(var(--color-text))]">Vad {'ä'}r fel med YouTube-l{'ä'}nken?</p>
            <div className="mb-5 grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="min-h-14"
                onClick={() => handleSubmitBrokenLink('wrong_track')}
                disabled={isSubmitting}
              >
                Fel l{'å'}t
              </Button>
              <Button
                variant="outline"
                className="min-h-14"
                onClick={() => handleSubmitBrokenLink('broken')}
                disabled={isSubmitting}
              >
                Trasig l{'ä'}nk
              </Button>
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setView('menu')}>Tillbaka</Button>
            </div>
          </div>
        );

      case 'ask_main':
        return (
          <div>
            <p className={`mb-1 ${headingClass}`}>Vad kan man dansa?</p>
            <p className={`mb-4 ${hintClass}`}>V{'ä'}lj huvudkategori</p>
            {renderStylePicker('ask', false)}
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" onClick={() => setView('menu')}>Tillbaka</Button>
            </div>
          </div>
        );

      case 'ask_sub':
        return (
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className={headingClass}>Vilken typ av {correctionMain}?</p>
              <Button
                variant="ghost"
                onClick={() => {
                  setView('ask_main');
                  setCorrectionMain('');
                }}
              >
                {'Ä'}ndra
              </Button>
            </div>
            {renderStylePicker('ask', true)}
          </div>
        );

      case 'ask_tempo':
        return (
          <div>
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <p className={headingClass}>Hur snabb {'ä'}r {correctionStyle}n?</p>
                <p className={hintClass}>V{'ä'}lj tempokategori</p>
              </div>
              <Button
                variant="ghost"
                onClick={() => setView(currentSubStyles.length ? 'ask_sub' : 'ask_main')}
              >
                Tillbaka
              </Button>
            </div>
            <StylePicker
              presentation="full"
              options={TEMPO_OPTIONS.map((t) => ({ value: t.key, label: t.label }))}
              placeholder="Välj tempo..."
              onSelect={(key) => handleSubmitStyleTempo(key)}
              disabled={isSubmitting}
            />
          </div>
        );

      case 'fix_main':
        return (
          <div>
            <p className={`mb-1 ${headingClass}`}>Korrekt dansstil</p>
            <p className={`mb-4 ${hintClass}`}>V{'ä'}lj huvudkategori</p>
            {renderStylePicker('fix', false)}
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" onClick={() => setView('menu')}>Tillbaka</Button>
            </div>
          </div>
        );

      case 'fix_sub':
        return (
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className={headingClass}>Vilken typ av {correctionMain}?</p>
              <Button
                variant="ghost"
                onClick={() => {
                  setView('fix_main');
                  setCorrectionMain('');
                }}
              >
                {'Ä'}ndra
              </Button>
            </div>
            {renderStylePicker('fix', true)}
          </div>
        );

      case 'fix_tempo':
        return (
          <div>
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <p className={headingClass}>
                  {'Ä'}r {correctionStyle || 'dansen'} r{'ä'}tt tempo?
                </p>
                <p className={hintClass}>Bekr{'ä'}fta eller korrigera tempot</p>
              </div>
              <Button
                variant="ghost"
                onClick={() => setView(currentSubStyles.length ? 'fix_sub' : 'fix_main')}
              >
                Tillbaka
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                className="min-h-16 leading-tight"
                onClick={() => handleSubmitStyleTempo('half')}
                disabled={isSubmitting}
              >
                Den {'ä'}r<br />l{'å'}ngsammare
              </Button>
              <Button
                variant="primary"
                className="min-h-16 leading-tight"
                onClick={() => handleSubmitStyleTempo('ok')}
                disabled={isSubmitting}
              >
                Ja, det {'ä'}r<br />r{'ä'}tt
              </Button>
              <Button
                variant="outline"
                className="min-h-16 leading-tight"
                onClick={() => handleSubmitStyleTempo('double')}
                disabled={isSubmitting}
              >
                Den {'ä'}r<br />snabbare
              </Button>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgb(var(--color-success))]/15 text-[rgb(var(--color-success))]"
              aria-hidden
            >
              <CheckIcon className="h-6 w-6" aria-hidden />
            </span>
            <p className="text-[15px] font-bold text-[rgb(var(--color-text))]">{successMessage}</p>
          </div>
        );
    }
  }

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-6 shadow-[var(--color-card-shadow)]">
        <IconButton aria-label="Stäng" onClick={onClose} className="absolute right-3 top-3">
          <CloseIcon className="h-5 w-5" aria-hidden />
        </IconButton>

        <div className="mb-5 flex items-center gap-2 pr-12">
          {view !== 'success' && (
            <FlagIcon className="h-5 w-5 shrink-0 text-[rgb(var(--color-text-muted))]" aria-hidden />
          )}
          <h3 id={titleId} className="text-[20px] font-bold leading-tight text-[rgb(var(--color-text))]">
            {view === 'success' ? 'Tack!' : 'Rapportera problem'}
          </h3>
        </div>

        {error && (
          <div className="mb-4">
            <InlineError>{error}</InlineError>
          </div>
        )}

        {renderContent()}
      </div>
    </div>,
    document.body,
  );
}
