import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useConsent } from '@/consent/useConsent';
import { SHOW_CONSENT_BANNER } from '@/consent/constants';
import type { TrackListDto } from '@/api/models/trackListDto';
import { PlayerContext } from './context';

interface PlayerState {
  currentTrack: TrackListDto | null;
  queue: TrackListDto[];
  isPlaying: boolean;
}

export interface PlayerContextValue extends PlayerState {
  play: (track: TrackListDto, contextTracks?: TrackListDto[]) => void;
  playFromQueue: (index: number) => void;
  togglePlayPause: () => void;
  addToQueue: (track: TrackListDto) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  next: () => void;
  prev: () => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  queueOpen: boolean;
  toggleQueue: () => void;
  closeQueue: () => void;
}

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

  const [queueOpen, setQueueOpen] = useState(false);
  const toggleQueue = useCallback(() => setQueueOpen((v) => !v), []);
  const closeQueue = useCallback(() => setQueueOpen(false), []);

  // Auto-close queue panel when queue becomes empty
  useEffect(() => {
    if (state.queue.length === 0) setQueueOpen(false);
  }, [state.queue.length]);

  const play = useCallback(
    (track: TrackListDto, contextTracks?: TrackListDto[]) => {
      if (consentStatus !== 'granted') {
        window.dispatchEvent(new Event(SHOW_CONSENT_BANNER));
        return;
      }
      if (contextTracks && contextTracks.length > 0) {
        const idx = contextTracks.findIndex((t) => t.id === track.id);
        const after = idx >= 0 ? contextTracks.slice(idx + 1, idx + 21) : [];
        saveQueue(after);
        setState((prev) => ({
          ...prev,
          currentTrack: track,
          queue: after,
          isPlaying: true,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          currentTrack: track,
          isPlaying: true,
        }));
      }
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

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setState((prev) => {
      const next = [...prev.queue];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      saveQueue(next);
      return { ...prev, queue: next };
    });
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
      reorderQueue,
      next,
      prev,
      queueOpen,
      toggleQueue,
      closeQueue,
    }),
    [
      state,
      play,
      playFromQueue,
      togglePlayPause,
      addToQueue,
      removeFromQueue,
      clearQueue,
      reorderQueue,
      next,
      prev,
      queueOpen,
      toggleQueue,
      closeQueue,
    ]
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

