import { useCallback, useEffect, useRef } from 'react';

const LONG_PRESS_DELAY_MS = 500;
const MOVE_THRESHOLD_PX = 10;

export function useLongPress(onLongPress: () => void) {
  const onLongPressRef = useRef(onLongPress);
  useEffect(() => {
    onLongPressRef.current = onLongPress;
  }, [onLongPress]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPositionRef = useRef<{ x: number; y: number } | null>(null);
  const pressActiveRef = useRef(false);
  const longPressFiredRef = useRef(false);
  const removeScrollListenerRef = useRef<(() => void) | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  const endPress = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pressActiveRef.current = false;
    startPositionRef.current = null;
    activePointerIdRef.current = null;
    if (removeScrollListenerRef.current) {
      removeScrollListenerRef.current();
      removeScrollListenerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      if (activePointerIdRef.current !== null) return;
      longPressFiredRef.current = false;
      activePointerIdRef.current = e.pointerId;
      pressActiveRef.current = true;
      startPositionRef.current = { x: e.clientX, y: e.clientY };
      const handleScroll = () => endPress();
      window.addEventListener('scroll', handleScroll);
      removeScrollListenerRef.current = () => window.removeEventListener('scroll', handleScroll);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        longPressFiredRef.current = true;
        onLongPressRef.current();
      }, LONG_PRESS_DELAY_MS);
    },
    [endPress],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      if (!pressActiveRef.current || !startPositionRef.current) return;
      const dx = e.clientX - startPositionRef.current.x;
      const dy = e.clientY - startPositionRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD_PX) endPress();
    },
    [endPress],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      endPress();
    },
    [endPress],
  );
  const onPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      endPress();
    },
    [endPress],
  );

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    if (pressActiveRef.current || longPressFiredRef.current) e.preventDefault();
  }, []);

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (longPressFiredRef.current) {
      e.preventDefault();
      e.stopPropagation();
      longPressFiredRef.current = false;
    }
  }, []);

  useEffect(() => endPress, [endPress]);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onContextMenu, onClickCapture };
}
