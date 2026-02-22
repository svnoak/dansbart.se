import { useState, useEffect } from 'react';
import type { MutableRefObject, Dispatch, SetStateAction } from 'react';

interface UsePlaybackPositionOptions {
  isYouTubeEmbed: boolean;
  isPlaying: boolean;
  ytPlayerRef: MutableRefObject<YTPlayerInstance | null>;
  isDraggingRef: MutableRefObject<boolean>;
}

interface UsePlaybackPositionResult {
  playbackPositionMs: number;
  setPlaybackPositionMs: Dispatch<SetStateAction<number>>;
  playbackDurationMs: number;
  setPlaybackDurationMs: Dispatch<SetStateAction<number>>;
}

export function usePlaybackPosition({
  isYouTubeEmbed,
  isPlaying,
  ytPlayerRef,
  isDraggingRef,
}: UsePlaybackPositionOptions): UsePlaybackPositionResult {
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0);
  const [playbackDurationMs, setPlaybackDurationMs] = useState(0);

  useEffect(() => {
    if (!isYouTubeEmbed || !isPlaying) return;
    const tick = () => {
      if (isDraggingRef.current) return;
      const player = ytPlayerRef.current;
      if (!player?.getCurrentTime || typeof player.getCurrentTime !== 'function') return;
      const sec = player.getCurrentTime();
      const dur = player.getDuration?.();
      setPlaybackPositionMs(sec * 1000);
      if (typeof dur === 'number' && dur > 0) setPlaybackDurationMs(dur * 1000);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [isYouTubeEmbed, isPlaying, ytPlayerRef, isDraggingRef]);

  return { playbackPositionMs, setPlaybackPositionMs, playbackDurationMs, setPlaybackDurationMs };
}
