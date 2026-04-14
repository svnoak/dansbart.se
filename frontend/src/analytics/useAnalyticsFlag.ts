import { useRef } from 'react';
import { getVoterId } from '@/utils/voter';

type SiteArea = 'search' | 'playlists' | 'library' | 'discovery';

/**
 * Fires once per component mount to record that this session touched a site area.
 * Subsequent renders are no-ops. The backend call is idempotent.
 */
export function useAnalyticsFlag(area: SiteArea) {
  const fired = useRef(false);
  if (!fired.current) {
    fired.current = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetch('/api/analytics/session/flag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: getVoterId(), area }),
    }).catch(() => {});
  }
}
