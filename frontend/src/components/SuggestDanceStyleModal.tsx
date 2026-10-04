import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { createSuggestion } from '@/api/manual/suggestions';
import { CloseIcon } from '@/icons';
import { Button, IconButton, InlineError, toast } from '@/ui';

interface SuggestDanceStyleModalProps {
  onClose: () => void;
}

const labelClass = 'mb-1 block text-[14px] font-semibold text-[rgb(var(--color-text))]';
const inputClass =
  'min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-[15px] text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]';

/**
 * Suggests a new dance style/sub-style. Never writes directly into dance_style_config —
 * an admin has to accept it and then separately activate it, since beats_per_bar feeds
 * the audio worker's bar-correction DSP pipeline and shouldn't change production behavior
 * as a side effect of an anonymous, unvetted suggestion.
 */
export function SuggestDanceStyleModal({ onClose }: SuggestDanceStyleModalProps) {
  const [mainStyle, setMainStyle] = useState('');
  const [subStyle, setSubStyle] = useState('');
  const [beatsPerBar, setBeatsPerBar] = useState('3');
  const [exampleTrack, setExampleTrack] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const titleId = `${id}-title`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async () => {
    const bpb = Number(beatsPerBar);
    if (!mainStyle.trim()) {
      setError('Namn på dansstil krävs.');
      return;
    }
    if (!Number.isInteger(bpb) || bpb < 1 || bpb > 12) {
      setError('Taktslag måste vara ett heltal mellan 1 och 12.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createSuggestion(
        'dance_style',
        {
          proposedMainStyle: mainStyle.trim(),
          proposedSubStyle: subStyle.trim() || undefined,
          proposedBeatsPerBar: bpb,
          exampleTrack: exampleTrack.trim() || undefined,
        },
        description.trim() || undefined,
      );
      toast('Tack — förslaget granskas av en riktig person.');
      onClose();
    } catch {
      setError('Kunde inte skicka förslaget, försök igen.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => { if (e.currentTarget === e.target) onClose(); }}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-6 shadow-[var(--color-card-shadow)]"
        onClick={(e) => e.stopPropagation()}
      >
        <IconButton aria-label="Stäng" onClick={onClose} className="absolute right-3 top-3">
          <CloseIcon className="h-5 w-5" aria-hidden />
        </IconButton>

        <h2 id={titleId} className="mb-1 pr-12 text-[20px] font-bold leading-tight text-[rgb(var(--color-text))]">
          Saknas en dansstil?
        </h2>
        <p className="mb-5 pr-12 text-[15px] text-[rgb(var(--color-text-muted))]">
          Föreslå en ny dansstil eller variant som inte finns i listan.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor={`${id}-main`} className={labelClass}>Namn på dansstil *</label>
            <input
              id={`${id}-main`}
              type="text"
              autoFocus
              value={mainStyle}
              onChange={(e) => setMainStyle(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`${id}-sub`} className={labelClass}>Variant (valfritt)</label>
            <input
              id={`${id}-sub`}
              type="text"
              value={subStyle}
              onChange={(e) => setSubStyle(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`${id}-bpb`} className={labelClass}>Taktslag per takt (1–12) *</label>
            <input
              id={`${id}-bpb`}
              type="number"
              min={1}
              max={12}
              value={beatsPerBar}
              onChange={(e) => setBeatsPerBar(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`${id}-example`} className={labelClass}>Exempellåt (valfritt)</label>
            <input
              id={`${id}-example`}
              type="text"
              value={exampleTrack}
              onChange={(e) => setExampleTrack(e.target.value)}
              placeholder="Titel eller länk"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`${id}-description`} className={labelClass}>Beskrivning (valfritt)</label>
            <textarea
              id={`${id}-description`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-3">
          <InlineError>{error}</InlineError>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Avbryt
          </Button>
          <Button variant="primary" disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Skickar...' : 'Skicka förslag'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
