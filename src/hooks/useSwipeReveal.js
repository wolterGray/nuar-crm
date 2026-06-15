import {useCallback, useRef, useState} from "react";

export function useSwipeReveal({enabled = true, maxOffset = 112, openThreshold = 56} = {}) {
  const [offset, setOffset] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const startXRef = useRef(null);
  const startOffsetRef = useRef(0);

  const close = useCallback(() => {
    setIsOpen(false);
    setOffset(0);
  }, []);

  const onTouchStart = useCallback(
    (event) => {
      if (!enabled) return;
      startXRef.current = event.touches[0]?.clientX ?? null;
      startOffsetRef.current = offset;
    },
    [enabled, offset],
  );

  const onTouchMove = useCallback(
    (event) => {
      if (!enabled || startXRef.current == null) return;

      const delta = (event.touches[0]?.clientX ?? startXRef.current) - startXRef.current;
      const nextOffset = Math.max(-maxOffset, Math.min(0, startOffsetRef.current + delta));
      setOffset(nextOffset);
    },
    [enabled, maxOffset],
  );

  const onTouchEnd = useCallback(() => {
    if (!enabled) return;

    startXRef.current = null;
    if (offset <= -openThreshold) {
      setIsOpen(true);
      setOffset(-maxOffset);
      return;
    }

    setIsOpen(false);
    setOffset(0);
  }, [enabled, maxOffset, offset, openThreshold]);

  return {
    close,
    isOpen,
    offset,
    swipeHandlers: enabled
      ? {onTouchEnd, onTouchMove, onTouchStart}
      : {},
  };
}
