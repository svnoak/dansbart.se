import { useState, useEffect } from 'react';
import { getStructureVersions } from '@/api/generated/tracks/tracks';

export function useStructureBars(trackId: string | undefined): number[] {
  const [bars, setBars] = useState<number[]>([]);

  useEffect(() => {
    if (!trackId) return;
    let cancelled = false;
    getStructureVersions(trackId)
      .then((versions) => {
        if (cancelled) return;
        const active = versions.find((v) => v.isActive) ?? versions[0];
        const data = active?.structureData as Record<string, unknown> | undefined;
        const trackBars = Array.isArray(data?.bars) ? (data.bars as number[]) : [];
        setBars(trackBars);
      })
      .catch(() => {
        if (!cancelled) setBars([]);
      });
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  return bars;
}
