import {useCallback, useRef, useState} from "react";

export function usePullRefresh({contentRef, isBlocked}) {
  const [pullRefresh, setPullRefresh] = useState({
    distance: 0,
    refreshing: false,
  });
  const pullStartYRef = useRef(0);
  const pullTrackingRef = useRef(false);

  const getScrollableParent = useCallback((target) => {
    const root = contentRef.current;
    let current = target instanceof Element ? target : null;

    while (current && current !== root && current !== document.body) {
      const style = window.getComputedStyle(current);
      const canScroll =
        /(auto|scroll)/.test(style.overflowY) &&
        current.scrollHeight > current.clientHeight + 1;

      if (canScroll) {
        return current;
      }

      current = current.parentElement;
    }

    return document.scrollingElement || document.documentElement;
  }, [contentRef]);

  const handlePullRefreshStart = useCallback(
    (event) => {
      const target = event.target;
      const tagName = target?.tagName?.toLowerCase();

      if (
        pullRefresh.refreshing ||
        isBlocked ||
        !window.matchMedia("(max-width: 700px)").matches ||
        ["input", "textarea", "select", "button"].includes(tagName)
      ) {
        pullTrackingRef.current = false;
        return;
      }

      const scrollParent = getScrollableParent(target);
      const scrollTop =
        scrollParent === document.scrollingElement ||
        scrollParent === document.documentElement
          ? window.scrollY || scrollParent.scrollTop
          : scrollParent.scrollTop;

      pullTrackingRef.current = scrollTop <= 0;
      pullStartYRef.current = event.touches[0]?.clientY ?? 0;
    },
    [getScrollableParent, isBlocked, pullRefresh.refreshing],
  );

  const handlePullRefreshMove = useCallback((event) => {
    if (!pullTrackingRef.current) {
      return;
    }

    const currentY = event.touches[0]?.clientY ?? 0;
    const delta = currentY - pullStartYRef.current;

    if (delta <= 0) {
      setPullRefresh((current) =>
        current.distance ? {...current, distance: 0} : current,
      );
      return;
    }

    if (delta > 12) {
      event.preventDefault();
    }

    const distance = Math.min(86, Math.round(delta * 0.48));
    setPullRefresh((current) => ({...current, distance}));
  }, []);

  const handlePullRefreshEnd = useCallback(() => {
    if (!pullTrackingRef.current) {
      return;
    }

    pullTrackingRef.current = false;
    setPullRefresh((current) => {
      if (current.distance >= 58) {
        window.setTimeout(() => window.location.reload(), 180);
        return {distance: 68, refreshing: true};
      }

      return {distance: 0, refreshing: false};
    });
  }, []);

  return {
    handlePullRefreshEnd,
    handlePullRefreshMove,
    handlePullRefreshStart,
    pullRefresh,
  };
}
