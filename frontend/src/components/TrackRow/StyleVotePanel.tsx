import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from '@/icons';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { StylePicker } from '@/components/StylePicker';
import { useStyleVote } from '@/hooks/useStyleVote';

type Step = 'main' | 'sub' | 'success';

interface StyleVotePanelProps {
  trackId: string;
  trackTitle: string;
  currentStyle: string | null | undefined;
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
  onClose,
  onVoted,
}: Omit<StyleVotePanelProps, 'open'>) {
  const [step, setStep] = useState<Step>('main');
  const [selectedMain, setSelectedMain] = useState('');
  const [failed, setFailed] = useState(false);
  const titleId = useId();

  const styleVote = useStyleVote(trackId, true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSelect(style: string) {
    const { success, styleJustConfirmed } = await styleVote.submit(style);
    setFailed(!success);
    if (success) {
      setStep('success');
      onVoted?.(style, styleJustConfirmed);
    }
  }

  function handleSelectMain(main: string) {
    if (styleVote.subStylesFor(main).length === 0) {
      void handleSelect(main);
    } else {
      setSelectedMain(main);
      setStep('sub');
    }
  }

  const subOptions = [
    { value: selectedMain, label: `Vet ej / Allmän ${selectedMain}`, bold: true },
    ...styleVote.subStylesFor(selectedMain).map((s) => ({ value: s, label: s })),
  ];

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
      <div className="relative w-full max-w-sm rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-6 shadow-xl">
        <IconButton
          aria-label="Stäng"
          onClick={onClose}
          className="absolute right-3 top-3"
        >
          <CloseIcon className="h-4 w-4" aria-hidden />
        </IconButton>

        <h3 id={titleId} className="mb-1 pr-8 text-lg font-bold text-[rgb(var(--color-text))]">
          {trackTitle}
        </h3>
        <p className="mb-4 text-sm text-[rgb(var(--color-text-muted))]">
          {currentStyle ? `Nuvarande dansstil: ${currentStyle}` : 'Dansstil saknas'}
        </p>

        {step === 'success' && <p className="text-sm text-[rgb(var(--color-text))]">Tack! Din röst är sparad.</p>}
        {failed && (
          <p role="alert" className="mb-3 text-sm text-red-600">
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
