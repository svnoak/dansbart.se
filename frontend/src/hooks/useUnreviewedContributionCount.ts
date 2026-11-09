import { useEffect, useState } from 'react';
import { countUnreviewedContributions } from '@/api/generated/admin-contributions/admin-contributions';

/**
 * How many tracks and dance styles users have added that no admin has looked at yet.
 * Only fetched when enabled (for admins). Pass a changing refreshKey, for example the
 * current path, to fetch it again.
 */
export function useUnreviewedContributionCount(enabled: boolean, refreshKey?: unknown): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    countUnreviewedContributions()
      .then((c) => {
        if (!cancelled) setCount((c.tracks ?? 0) + (c.styles ?? 0));
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });
    return () => { cancelled = true; };
  }, [enabled, refreshKey]);

  return enabled ? count : 0;
}
