import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { searchTracks } from '@/api/generated/tracks/tracks';
import type { TrackListDto } from '@/api/models/trackListDto';
import { Button, fieldClassName, fieldLabelClassName, toast } from '@/ui';

interface SuggestTrackModalProps {
  danceName: string;
  alreadySuggestedTrackIds: Set<string>;
  onSuggest: (trackId: string) => Promise<void>;
  onClose: () => void;
}

export function SuggestTrackModal({
  danceName,
  alreadySuggestedTrackIds,
  onSuggest,
  onClose,
}: SuggestTrackModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrackListDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const search = useCallback((q: string) => {
    clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchTracks({ q, pageable: { page: 0, size: 10 } });
        setResults(data?.items ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    search(query);
  }, [query, search]);

  const handleSuggest = async (track: TrackListDto) => {
    if (!track.id || submitting) return;
    setSubmitting(track.id);
    try {
      await onSuggest(track.id);
      toast(`"${track.title}" föreslagen för ${danceName}`);
      onClose();
    } catch {
      toast('Kunde inte föreslå låten, försök igen.');
    } finally {
      setSubmitting(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onClick={(e) => { if (e.currentTarget === e.target) onClose(); }}
    >
      <div className="absolute inset-0 bg-[rgb(var(--color-text))]/55" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggest-track-heading"
        className="relative w-full max-w-md rounded-[var(--radius-lg)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] p-6 shadow-[var(--color-card-shadow)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="suggest-track-heading" className="mb-4 text-xl font-semibold text-[rgb(var(--color-text))]">
          Föreslå låt för {danceName}
        </h2>

        <div className="space-y-1">
          <label htmlFor="suggest-track-query" className={fieldLabelClassName}>
            Sök låt
          </label>
          <input
            id="suggest-track-query"
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök låt..."
            className={fieldClassName}
          />
        </div>

        <div className="mt-3 max-h-72 overflow-y-auto">
          {loading && (
            <p className="py-4 text-center text-sm text-[rgb(var(--color-text-muted))]">
              Laddar...
            </p>
          )}
          {!loading && results.length === 0 && query.trim() && (
            <p className="py-4 text-center text-sm text-[rgb(var(--color-text-muted))]">
              Inga låtar hittades.
            </p>
          )}
          {results.map((track) => {
            const alreadySuggested = track.id ? alreadySuggestedTrackIds.has(track.id) : false;
            return (
              <div
                key={track.id}
                className="flex items-center gap-3 rounded-[var(--radius)] px-3 py-2 hover:bg-[rgb(var(--color-pill-bg))]/40"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-[rgb(var(--color-text))]">
                    {track.title}
                  </p>
                  {track.artistName && (
                    <p className="truncate text-sm text-[rgb(var(--color-text-muted))]">
                      {track.artistName}
                    </p>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={alreadySuggested || submitting === track.id}
                  onClick={() => handleSuggest(track)}
                >
                  {alreadySuggested ? 'Föreslagen' : 'Föreslå'}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Stäng
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
