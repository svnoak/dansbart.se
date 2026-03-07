import { useMemo } from 'react';

export function useCurrentBarIndex(bars: number[], playbackPositionMs: number): number {
  return useMemo(() => {
    if (bars.length === 0) return -1;
    const positionSec = playbackPositionMs / 1000;
    // Reverse scan to find the last bar at or before current position
    for (let i = bars.length - 1; i >= 0; i--) {
      if (bars[i] <= positionSec) return i;
    }
    return 0;
  }, [bars, playbackPositionMs]);
}
