import { useEffect, useRef } from 'react';

export function useScreenWakeLock(active: boolean) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !navigator.wakeLock) {
      return;
    }

    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || sentinelRef.current) {
        return;
      }
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener('release', () => {
          sentinelRef.current = null;
        });
      } catch (error) {
        void error;
      }
    };

    document.addEventListener('visibilitychange', acquire);
    acquire();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      if (sentinelRef.current) {
        sentinelRef.current.release();
        sentinelRef.current = null;
      }
    };
  }, [active]);
}
