import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createSuggestion } from '@/api/manual/suggestions';
import { Button, toast } from '@/ui';

interface SuggestDanceStyleModalProps {
  onClose: () => void;
}

const inputClass =
  'w-full rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-2 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:border-[rgb(var(--color-accent))] focus:outline-none';

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
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onClick={(e) => { if (e.currentTarget === e.target) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-semibold text-[rgb(var(--color-text))]">
          Saknas en dansstil?
        </h2>
        <p className="mb-4 text-xs text-[rgb(var(--color-text-muted))]">
          Föreslå en ny dansstil eller variant som inte finns i listan.
        </p>

        <div className="space-y-3">
          <input
            type="text"
            autoFocus
            value={mainStyle}
            onChange={(e) => setMainStyle(e.target.value)}
            placeholder="Namn på dansstil *"
            className={inputClass}
          />
          <input
            type="text"
            value={subStyle}
            onChange={(e) => setSubStyle(e.target.value)}
            placeholder="Variant (valfritt)"
            className={inputClass}
          />
          <div>
            <label className="mb-1 block text-xs text-[rgb(var(--color-text-muted))]">
              Taktslag per takt (1-12) *
            </label>
            <input
              type="number"
              min={1}
              max={12}
              value={beatsPerBar}
              onChange={(e) => setBeatsPerBar(e.target.value)}
              className={inputClass}
            />
          </div>
          <input
            type="text"
            value={exampleTrack}
            onChange={(e) => setExampleTrack(e.target.value)}
            placeholder="Exempellåt (titel eller länk, valfritt)"
            className={inputClass}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Beskrivning (valfritt)"
            rows={3}
            className={inputClass}
          />
        </div>

        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Avbryt
          </Button>
          <Button variant="primary" size="sm" disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Skickar...' : 'Skicka förslag'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
