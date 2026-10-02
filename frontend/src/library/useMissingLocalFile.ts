import { useEffect, useState } from 'react';
import type { TrackListDto } from '@/api/models/trackListDto';
import { hasLocalFileForTrack } from './localHandles';

/** True for the person's own track when this browser holds no file for it. */
export function useMissingLocalFile(track: TrackListDto) {
  const [missing, setMissing] = useState(false);
  const isOwnTrack = track.playable === true && !track.playbackLinks?.length;

  useEffect(() => {
    if (!isOwnTrack || track.id == null) return;
    let cancelled = false;
    hasLocalFileForTrack(track.id).then((stored) => {
      if (!cancelled) setMissing(!stored);
    });
    return () => {
      cancelled = true;
    };
  }, [isOwnTrack, track.id]);

  return { missing: isOwnTrack && missing, setMissing };
}
