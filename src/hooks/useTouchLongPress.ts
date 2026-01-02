import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

interface UseTouchLongPressOptions {
  delay?: number;
}

export const useTouchLongPress = (
  onLongPress: () => void,
  { delay = 600 }: UseTouchLongPressOptions = {}
) => {
  const timeoutRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const hoverTriggerRef = useRef(false);

  const clearLongPressTimeout = useCallback(() => {
    if (!timeoutRef.current) {
      return;
    }

    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const startLongPressTimer = useCallback(() => {
    longPressTriggeredRef.current = false;
    clearLongPressTimeout();
    timeoutRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onLongPress();
      if (hoverTriggerRef.current) {
        longPressTriggeredRef.current = false;
      }
      hoverTriggerRef.current = false;
    }, delay);
  }, [clearLongPressTimeout, delay, onLongPress]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.pointerType === 'mouse') {
        return;
      }

      hoverTriggerRef.current = false;
      startLongPressTimer();
    },
    [startLongPressTimer]
  );

  const handlePointerEnter = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.pointerType !== 'mouse') {
        return;
      }

      hoverTriggerRef.current = true;
      startLongPressTimer();
    },
    [startLongPressTimer]
  );

  const handlePointerEnd = useCallback(() => {
    clearLongPressTimeout();
  }, [clearLongPressTimeout]);

  const shouldHandleClick = useCallback(() => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return false;
    }

    return true;
  }, []);

  const resetLongPress = useCallback(() => {
    longPressTriggeredRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      clearLongPressTimeout();
    };
  }, [clearLongPressTimeout]);

  return {
    handlePointerDown,
    handlePointerUp: handlePointerEnd,
    handlePointerLeave: handlePointerEnd,
    handlePointerCancel: handlePointerEnd,
    handlePointerEnter,
    shouldHandleClick,
    resetLongPress,
  } as const;
};
