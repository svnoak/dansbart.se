import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useConsent, SHOW_CONSENT_BANNER } from '@/consent/ConsentContext';
import type { TrackListDto } from '@/api/models/trackListDto';

interface PlayerState {
  currentTrack: TrackListDto | null;
  queue: TrackListDto[];
  isPlaying: boolean;
}

interface PlayerContextValue extends PlayerState {
  play: (track: TrackListDto) => void;
  playFromQueue: (index: number) => void;
  togglePlayPause: () => void;
  addToQueue: (track: TrackListDto) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  next: () => void;
  prev: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

const QUEUE_STORAGE_KEY = 'dansbart-queue';

function loadQueue(): TrackListDto[] {
  try {
    const s = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!s) return [];
    const parsed = JSON.parse(s) as TrackListDto[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: TrackListDto[]) {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { consentStatus } = useConsent();
  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    queue: loadQueue(),
    isPlaying: false,
  });

  const play = useCallback(
    (track: TrackListDto) => {
      if (consentStatus !== 'granted') {
        window.dispatchEvent(new Event(SHOW_CONSENT_BANNER));
        return;
      }
      setState((prev) => ({
        ...prev,
        currentTrack: track,
        isPlaying: true,
      }));
    },
    [consentStatus]
  );

  const playFromQueue = useCallback(
    (index: number) => {
      if (consentStatus !== 'granted') {
        window.dispatchEvent(new Event(SHOW_CONSENT_BANNER));
        return;
      }
      setState((prev) => {
        const item = prev.queue[index];
        if (!item) return prev;
        return {
          ...prev,
          currentTrack: item,
          isPlaying: true,
        };
      });
    },
    [consentStatus]
  );

  const togglePlayPause = useCallback(() => {
    if (!state.isPlaying && consentStatus !== 'granted') {
      window.dispatchEvent(new Event(SHOW_CONSENT_BANNER));
      return;
    }
    setState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, [consentStatus, state.isPlaying]);

  const addToQueue = useCallback((track: TrackListDto) => {
    setState((prev) => {
      const next = [...prev.queue, track];
      saveQueue(next);
      return { ...prev, queue: next };
    });
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setState((prev) => {
      const next = prev.queue.filter((_, i) => i !== index);
      saveQueue(next);
      const currentTrack =
        prev.currentTrack && prev.queue[index]?.id === prev.currentTrack.id
          ? null
          : prev.currentTrack;
      return { ...prev, queue: next, currentTrack: currentTrack ?? prev.currentTrack };
    });
  }, []);

  const clearQueue = useCallback(() => {
    setState((prev) => ({ ...prev, queue: [] }));
    saveQueue([]);
  }, []);

  const next = useCallback(() => {
    if (consentStatus !== 'granted') {
      window.dispatchEvent(new Event(SHOW_CONSENT_BANNER));
      return;
    }
    setState((prev) => {
      if (prev.queue.length === 0) return { ...prev, isPlaying: false };
      const idx = prev.currentTrack
        ? prev.queue.findIndex((t) => t.id === prev.currentTrack?.id)
        : -1;
      const nextIdx = idx < 0 ? 0 : Math.min(idx + 1, prev.queue.length - 1);
      const nextTrack = prev.queue[nextIdx];
      return {
        ...prev,
        currentTrack: nextTrack ?? null,
        isPlaying: !!nextTrack,
      };
    });
  }, [consentStatus]);

  const prev = useCallback(() => {
    if (consentStatus !== 'granted') {
      window.dispatchEvent(new Event(SHOW_CONSENT_BANNER));
      return;
    }
    setState((prev) => {
      if (prev.queue.length === 0) return { ...prev, isPlaying: false };
      const idx = prev.currentTrack
        ? prev.queue.findIndex((t) => t.id === prev.currentTrack?.id)
        : -1;
      const nextIdx = idx <= 0 ? 0 : idx - 1;
      const nextTrack = prev.queue[nextIdx];
      return {
        ...prev,
        currentTrack: nextTrack ?? null,
        isPlaying: !!nextTrack,
      };
    });
  }, [consentStatus]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      ...state,
      play,
      playFromQueue,
      togglePlayPause,
      addToQueue,
      removeFromQueue,
      clearQueue,
      next,
      prev,
    }),
    [
      state.currentTrack,
      state.queue,
      state.isPlaying,
      play,
      playFromQueue,
      togglePlayPause,
      addToQueue,
      removeFromQueue,
      clearQueue,
      next,
      prev,
    ]
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
