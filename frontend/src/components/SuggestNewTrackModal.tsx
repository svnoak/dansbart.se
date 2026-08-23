import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getStyleTree } from '@/api/generated/styles/styles';
import { createSuggestion } from '@/api/manual/suggestions';
import type { StyleNode } from '@/api/models/styleNode';
import { Button, toast } from '@/ui';

interface SuggestNewTrackModalProps {
  onClose: () => void;
}

const TEMPO_OPTIONS = ['Långsamt', 'Lugnt', 'Lagom', 'Snabbt', 'Väldigt snabbt'];

const inputClass =
  'w-full rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-2 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:border-[rgb(var(--color-accent))] focus:outline-none';

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
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onClick={(e) => { if (e.currentTarget === e.target) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-semibold text-[rgb(var(--color-text))]">
          Saknar du en låt?
        </h2>
        <p className="mb-4 text-xs text-[rgb(var(--color-text-muted))]">
          Föreslå den — vet du dansstilen kan du gärna ange den direkt.
        </p>

        <div className="space-y-3">
          <input
            type="text"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Låttitel *"
            className={inputClass}
          />
          <input
            type="text"
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            placeholder="Artist (valfritt)"
            className={inputClass}
          />
          <input
            type="text"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="Länk (Spotify/YouTube, valfritt)"
            className={inputClass}
          />

          <div className="grid grid-cols-2 gap-2">
            <select
              value={mainStyle}
              onChange={(e) => { setMainStyle(e.target.value); setSubStyle(''); }}
              className={inputClass}
            >
              <option value="">Dansstil (valfritt)</option>
              {mainCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={subStyle}
              onChange={(e) => setSubStyle(e.target.value)}
              disabled={currentSubStyles.length === 0}
              className={inputClass}
            >
              <option value="">Variant (valfritt)</option>
              {currentSubStyles.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <select value={tempo} onChange={(e) => setTempo(e.target.value)} className={inputClass}>
            <option value="">Tempo (valfritt)</option>
            {TEMPO_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Övrig kommentar (valfritt)"
            rows={2}
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
