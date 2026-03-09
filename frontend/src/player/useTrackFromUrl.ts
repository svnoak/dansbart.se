import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getTrack } from '@/api/generated/tracks/tracks';
import { usePlayer } from './usePlayer';

/**
 * Reads a `?track=<id>` query param from the URL. When present,
 * fetches the track and loads it into the player in a paused state.
 * The param stays in the URL so it remains shareable/refreshable.
 */
export function useTrackFromUrl() {
  const [searchParams] = useSearchParams();
  const { loadTrack } = usePlayer();
  const handledRef = useRef<string | null>(null);

  const trackId = searchParams.get('track');

  useEffect(() => {
    if (!trackId || trackId === handledRef.current) return;
    handledRef.current = trackId;

    getTrack(trackId)
      .then((track) => {
        loadTrack(track);
      })
      .catch(() => {
        // Track not found or fetch failed
      });
  }, [trackId, loadTrack]);
}