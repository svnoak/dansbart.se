import { useCallback, useEffect, useRef, useState } from 'react';
import { getLocalFileForTrack } from '@/library/localHandles';

interface UseLocalAudioPlayerOptions {
  trackId: string | null | undefined;
  isPlaying: boolean;
  onEnded: () => void;
}

/** Plays the local file of a track in one audio element. The file never leaves the device. */
export function useLocalAudioPlayer({ trackId, isPlaying, onEnded }: UseLocalAudioPlayerOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const getAudio = useCallback(() => (audioRef.current ??= new Audio()), []);
  const [loadedTrackId, setLoadedTrackId] = useState<string | null>(null);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const hasLocalFile = !!trackId && loadedTrackId === trackId;

  useEffect(() => {
    const audio = getAudio();
    const handleTimeUpdate = () => setPositionMs(audio.currentTime * 1000);
    const handleDuration = () => setDurationMs(Number.isFinite(audio.duration) ? audio.duration * 1000 : 0);
    const handleEnded = () => onEndedRef.current();
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDuration);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, [getAudio]);

  useEffect(() => {
    if (!trackId) return;
    const audio = getAudio();
    let cancelled = false;
    let objectUrl: string | null = null;
    void getLocalFileForTrack(trackId).then((file) => {
      if (cancelled || !file) return;
      objectUrl = URL.createObjectURL(file);
      audio.src = objectUrl;
      setPositionMs(0);
      setDurationMs(0);
      setLoadedTrackId(trackId);
    });
    return () => {
      cancelled = true;
      audio.pause();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [getAudio, trackId]);

  useEffect(() => {
    if (!hasLocalFile) return;
    const audio = getAudio();
    if (isPlaying) void audio.play().catch(() => {});
    else audio.pause();
  }, [getAudio, hasLocalFile, isPlaying]);

  const seekTo = useCallback(
    (seconds: number) => {
      getAudio().currentTime = seconds;
      setPositionMs(seconds * 1000);
    },
    [getAudio],
  );

  const getCurrentTime = useCallback(() => getAudio().currentTime, [getAudio]);

  return { hasLocalFile, positionMs, durationMs, seekTo, getCurrentTime };
}
