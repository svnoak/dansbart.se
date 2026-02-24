import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getTrack } from '@/api/generated/tracks/tracks';
import type { Track } from '@/api/models/track';
import { Card } from '@/ui';
import { usePlayer } from '@/player/usePlayer';
import { formatDurationMs } from '@/utils/formatDuration';

export function TrackPage() {
  const { id } = useParams<{ id: string }>();
  const [track, setTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prevId, setPrevId] = useState(id);
  const { play } = usePlayer();

  if (prevId !== id) {
    setPrevId(id);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getTrack(id)
      .then((data) => {
        if (!cancelled) setTrack(data ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Kunde inte hämta låt');
          setTrack(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return <p className="text-[rgb(var(--color-text-muted))]">Laddar…</p>;
  }
  if (error || !track) {
    return (
      <p className="text-red-600" role="alert">
        {error ?? 'Låten hittades inte.'}
      </p>
    );
  }

  const trackListDto = {
    id: track.id,
    title: track.title,
    durationMs: track.durationMs,
    effectiveBpm: track.tempoBpm,
    hasVocals: track.hasVocals ?? track.isInstrumental === false,
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">
          {track.title ?? 'Okänd låt'}
        </h1>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-[rgb(var(--color-text-muted))]">
          {track.durationMs != null && (
            <span>{formatDurationMs(track.durationMs)}</span>
          )}
          {track.tempoBpm != null && <span>{Math.round(track.tempoBpm)} BPM</span>}
          {track.hasVocals != null && (
            <span>{track.hasVocals ? 'Sång' : 'Instrumental'}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => play(trackListDto)}
          className="mt-4 rounded-[var(--radius)] bg-[rgb(var(--color-accent))] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Spela
        </button>
      </Card>
      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        Använd spelaren längst ner på sidan för att lyssna.
      </p>
    </div>
  );
}
