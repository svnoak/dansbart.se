import { useCallback, useEffect, useRef, useState } from 'react';
import { searchTracks } from '@/api/generated/tracks/tracks';
import type { TrackListDto } from '@/api/models/trackListDto';
import { Button } from '@/ui';
import { toast } from '@/ui';

interface SuggestTrackModalProps {
  danceId: string;
  danceName: string;
  alreadySuggestedTrackIds: Set<string>;
  onSuggest: (trackId: string) => Promise<void>;
  onClose: () => void;
}

export function SuggestTrackModal({
  danceId: _danceId,
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-[rgb(var(--color-surface))] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-[rgb(var(--color-text))]">
          Föreslå låt för {danceName}
        </h2>

        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök låt..."
          className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-4 py-2 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:border-[rgb(var(--color-primary))] focus:outline-none"
        />

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
                className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-[rgb(var(--color-border))]/30"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-[rgb(var(--color-text))]">
                    {track.title}
                  </p>
                  {track.artistName && (
                    <p className="truncate text-xs text-[rgb(var(--color-text-muted))]">
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
    </div>
  );
}
