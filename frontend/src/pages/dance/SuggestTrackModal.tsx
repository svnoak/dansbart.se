import { useCallback, useEffect, useRef, useState } from 'react';
import { searchTracks } from '@/api/generated/tracks/tracks';
import type { TrackListDto } from '@/api/models/trackListDto';
import { Button, Modal, toast } from '@/ui';

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

  const title = `Föreslå låt för ${danceName}`;

  return (
    <Modal open onClose={onClose} label={title}>
      <h2 className="mb-4 text-xl font-bold text-[rgb(var(--color-text))]">{title}</h2>

      <label htmlFor="suggest-track-search" className="sr-only">
        Sök låt
      </label>
      <input
        id="suggest-track-search"
        type="search"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Sök låt…"
        className="min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-4 py-2 text-[15px] text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]"
      />

      <div className="mt-3 max-h-72 overflow-y-auto">
        {loading && (
          <p className="py-4 text-center text-sm text-[rgb(var(--color-text-muted))]" role="status">
            Laddar…
          </p>
        )}
        {!loading && results.length === 0 && query.trim() && (
          <p className="py-4 text-center text-sm text-[rgb(var(--color-text-muted))]">
            Inga låtar hittades.
          </p>
        )}
        {results.length > 0 && (
          <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]">
            {results.map((track) => {
              const alreadySuggested = track.id ? alreadySuggestedTrackIds.has(track.id) : false;
              return (
                <li
                  key={track.id}
                  className="flex items-center gap-3 border-b border-[rgb(var(--color-border))] px-3 py-2.5 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold leading-snug text-[rgb(var(--color-text))]">
                      {track.title}
                    </p>
                    {track.artistName && (
                      <p className="truncate text-[13px] text-[rgb(var(--color-text-muted))]">
                        {track.artistName}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={
                      alreadySuggested
                        ? `${track.title ?? 'Låten'} är redan föreslagen`
                        : `Föreslå ${track.title ?? 'låten'}`
                    }
                    disabled={alreadySuggested || submitting === track.id}
                    onClick={() => handleSuggest(track)}
                  >
                    {alreadySuggested ? 'Föreslagen' : 'Föreslå'}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Stäng
        </Button>
      </div>
    </Modal>
  );
}
