import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon, CloseIcon } from '@/icons';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { StylePicker } from '@/components/StylePicker';
import { TempoPicker } from '@/components/TempoPicker';
import { useStyleVote } from '@/hooks/useStyleVote';
import { useAuth } from '@/auth/useAuth';
import { StylePill } from './StylePill';
import { stylePillState } from './stylePillState';

type Step = 'main' | 'sub' | 'tempo' | 'success';

interface StyleVotePanelProps {
  trackId: string;
  trackTitle: string;
  currentStyle: string | null | undefined;
  /** The confidence behind the current style, when the caller knows it. Without it the style reads as confirmed. */
  currentConfidence?: number | null;
  open: boolean;
  onClose: () => void;
  onVoted?: (style: string, confirmed: boolean) => void;
}

/** Dialog where a person votes for the main dance style of one track. */
export function StyleVotePanel({ open, ...props }: StyleVotePanelProps) {
  return open ? <StyleVoteDialog {...props} /> : null;
}

function StyleVoteDialog({
  trackId,
  trackTitle,
  currentStyle,
  currentConfidence,
  onClose,
  onVoted,
}: Omit<StyleVotePanelProps, 'open'>) {
  const [step, setStep] = useState<Step>('main');
  const [selectedMain, setSelectedMain] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [failed, setFailed] = useState(false);
  const [styleJustConfirmed, setStyleJustConfirmed] = useState(false);
  const titleId = useId();

  const styleVote = useStyleVote(trackId, true);
  const { isAuthenticated, login } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleSelect(style: string) {
    setSelectedStyle(style);
    setStep('tempo');
  }

  async function handleSubmit(tempoCorrection?: string) {
    const { success, styleJustConfirmed: confirmed } = await styleVote.submit(
      selectedStyle,
      tempoCorrection,
    );
    setFailed(!success);
    if (success) {
      setStyleJustConfirmed(confirmed);
      setStep('success');
      onVoted?.(selectedStyle, confirmed);
    }
  }

  function handleSelectMain(main: string) {
    if (styleVote.subStylesFor(main).length === 0) {
      handleSelect(main);
    } else {
      setSelectedMain(main);
      setStep('sub');
    }
  }

  const subOptions = [
    { value: selectedMain, label: `Vet ej / Allmän ${selectedMain}`, bold: true },
    ...styleVote.subStylesFor(selectedMain).map((s) => ({ value: s, label: s })),
  ];

  const hasCurrentStyle = typeof currentStyle === 'string' && currentStyle.length > 0;
  const currentState = hasCurrentStyle
    ? currentConfidence == null
      ? 'confirmed'
      : stylePillState(currentStyle, currentConfidence)
    : 'unknown';
  const stepLabel = step === 'tempo' ? 'Steg 2 av 2' : step === 'success' ? null : 'Steg 1 av 2';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-6 shadow-[var(--color-card-shadow)]">
        <IconButton
          aria-label="Stäng"
          onClick={onClose}
          className="absolute right-3 top-3"
        >
          <CloseIcon className="h-5 w-5" aria-hidden />
        </IconButton>

        <p className="mb-1 pr-12 text-[13px] font-semibold text-[rgb(var(--color-text-muted))]">
          Vilken dans passar?
        </p>
        <h3 id={titleId} className="mb-2 pr-12 text-[20px] font-bold leading-tight text-[rgb(var(--color-text))]">
          {trackTitle}
        </h3>
        <p className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-[rgb(var(--color-text-muted))]">
          {hasCurrentStyle ? (
            <span className="inline-flex items-center gap-1.5">
              Nuvarande:
              <StylePill style={currentStyle} state={currentState} size="sm" />
            </span>
          ) : (
            <span>Dansstil saknas</span>
          )}
          {stepLabel && (
            <>
              <span aria-hidden>·</span>
              <span>{stepLabel}</span>
            </>
          )}
        </p>

        {step === 'success' && (
          <div className="flex flex-col items-start gap-3 text-[15px] text-[rgb(var(--color-text))]">
            <div className="flex items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-success))]/15 text-[rgb(var(--color-success))]"
                aria-hidden
              >
                <CheckIcon className="h-6 w-6" aria-hidden />
              </span>
              <p className="font-bold">
                {styleJustConfirmed ? 'Tack! Nu är stilen bekräftad.' : 'Tack! Din röst är sparad.'}
              </p>
            </div>
            {!styleJustConfirmed && !isAuthenticated && (
              <>
                <p className="text-[rgb(var(--color-text-muted))]">
                  Inloggade användare kan bekräfta stilar med enbart en röst
                </p>
                <Button variant="secondary" onClick={login}>
                  Logga in eller skapa konto
                </Button>
              </>
            )}
          </div>
        )}
        {failed && (
          <p role="alert" className="mb-3 text-[14px] text-[rgb(var(--color-error))]">
            Det gick inte att spara din röst. Försök igen.
          </p>
        )}

        {step === 'main' && (
          <StylePicker
            presentation="full"
            options={styleVote.mainCategories.map((c) => ({ value: c, label: c }))}
            placeholder="Välj kategori..."
            onSelect={handleSelectMain}
            disabled={styleVote.isSubmitting}
          />
        )}

        {step === 'sub' && (
          <StylePicker
            presentation="full"
            options={subOptions}
            placeholder="Välj variant..."
            onSelect={handleSelect}
            disabled={styleVote.isSubmitting}
          />
        )}

        {step === 'tempo' && (
          <>
            <p className="mb-3 text-[15px] font-bold text-[rgb(var(--color-text))]">Hur snabbt är danstempot?</p>
            <TempoPicker presentation="full" onSelect={handleSubmit} disabled={styleVote.isSubmitting} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={() => void handleSubmit()}
                disabled={styleVote.isSubmitting}
              >
                Hoppa över tempot
              </Button>
              <Button
                variant="ghost"
                onClick={() => setStep(styleVote.subStylesFor(selectedMain).length > 0 ? 'sub' : 'main')}
                disabled={styleVote.isSubmitting}
              >
                Tillbaka
              </Button>
            </div>
          </>
        )}

        {step === 'sub' && (
          <Button variant="ghost" className="mt-3" onClick={() => setStep('main')}>
            Tillbaka
          </Button>
        )}
      </div>
    </div>,
    document.body,
  );
}
