import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { getStyleTree } from '@/api/generated/styles/styles';
import { createSuggestion } from '@/api/manual/suggestions';
import type { StyleNode } from '@/api/models/styleNode';
import { CloseIcon } from '@/icons';
import { Button, IconButton, InlineError, toast } from '@/ui';

interface SuggestNewTrackModalProps {
  onClose: () => void;
}

const TEMPO_OPTIONS = ['Långsamt', 'Lugnt', 'Lagom', 'Snabbt', 'Väldigt snabbt'];

const labelClass = 'mb-1 block text-[14px] font-semibold text-[rgb(var(--color-text))]';
const inputClass =
  'min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-[15px] text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] disabled:opacity-50';

/**
 * Merged suggest-and-classify flow: the person suggesting a missing track almost always
 * already knows its dance style, so that classification is captured here rather than
 * deferred to a separate later step. Anonymous — no login required.
 */
export function SuggestNewTrackModal({ onClose }: SuggestNewTrackModalProps) {
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [mainStyle, setMainStyle] = useState('');
  const [subStyle, setSubStyle] = useState('');
  const [tempo, setTempo] = useState('');
  const [note, setNote] = useState('');
  const [styleTree, setStyleTree] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const titleId = `${id}-title`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    getStyleTree()
      .then((nodes: StyleNode[]) => {
        const tree: Record<string, string[]> = {};
        for (const node of nodes) {
          if (node.name) tree[node.name] = node.subStyles ?? [];
        }
        setStyleTree(tree);
      })
      .catch(() => {});
  }, []);

  const mainCategories = Object.keys(styleTree).sort();
  const currentSubStyles = mainStyle ? styleTree[mainStyle] ?? [] : [];

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Titel krävs.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createSuggestion(
        'content',
        {
          title: title.trim(),
          artistName: artistName.trim() || undefined,
          externalUrl: externalUrl.trim() || undefined,
          suggestedMainStyle: mainStyle || undefined,
          suggestedSubStyle: subStyle || undefined,
          suggestedTempoCategory: tempo || undefined,
        },
        note.trim() || undefined,
      );
      toast('Tack — förslaget granskas av en riktig person och används direkt om det stämmer.');
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
          Saknar du en låt?
        </h2>
        <p className="mb-5 pr-12 text-[15px] text-[rgb(var(--color-text-muted))]">
          Föreslå den — vet du dansstilen kan du gärna ange den direkt.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor={`${id}-title-input`} className={labelClass}>Låttitel *</label>
            <input
              id={`${id}-title-input`}
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`${id}-artist`} className={labelClass}>Artist (valfritt)</label>
            <input
              id={`${id}-artist`}
              type="text"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`${id}-url`} className={labelClass}>Länk (valfritt)</label>
            <input
              id={`${id}-url`}
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="Spotify eller YouTube"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${id}-style`} className={labelClass}>Dansstil (valfritt)</label>
              <select
                id={`${id}-style`}
                value={mainStyle}
                onChange={(e) => { setMainStyle(e.target.value); setSubStyle(''); }}
                className={inputClass}
              >
                <option value="">Välj dansstil</option>
                {mainCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-sub`} className={labelClass}>Variant (valfritt)</label>
              <select
                id={`${id}-sub`}
                value={subStyle}
                onChange={(e) => setSubStyle(e.target.value)}
                disabled={currentSubStyles.length === 0}
                className={inputClass}
              >
                <option value="">Välj variant</option>
                {currentSubStyles.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor={`${id}-tempo`} className={labelClass}>Tempo (valfritt)</label>
            <select id={`${id}-tempo`} value={tempo} onChange={(e) => setTempo(e.target.value)} className={inputClass}>
              <option value="">Välj tempo</option>
              {TEMPO_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${id}-note`} className={labelClass}>Övrig kommentar (valfritt)</label>
            <textarea
              id={`${id}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
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
