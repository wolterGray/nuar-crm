import {useCallback, useEffect, useRef, useState} from "react";

async function reloadIfNewFrontendBundle() {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const currentAssets = [
    ...Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((el) => el.getAttribute("href") || ""),
    ...Array.from(document.querySelectorAll("script[src]")).map((el) => el.getAttribute("src") || ""),
  ].filter((href) => href.includes("/assets/index-"));
  if (currentAssets.length === 0) return false;
  try {
    const res = await fetch(`/?_v=${Date.now()}`, {
      cache: "no-store",
      headers: {Accept: "text/html"},
    });
    if (!res.ok) return false;
    const html = await res.text();
    const isOutdated = currentAssets.some((asset) => {
      const clean = asset.split("?")[0];
      return clean && !html.includes(clean);
    });
    if (isOutdated) {
      window.location.reload();
      return true;
    }
  } catch {
    // ignore network errors
  }
  return false;
}

export function usePullRefresh({contentRef, isBlocked, onRefresh}) {
  const [pullRefresh, setPullRefresh] = useState({
    distance: 0,
    refreshing: false,
  });
  const pullStartYRef = useRef(0);
  const pullTrackingRef = useRef(false);

  useEffect(() => {
    reloadIfNewFrontendBundle();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        reloadIfNewFrontendBundle();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

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
        (typeof isBlocked === "function" ? isBlocked() : isBlocked) ||
        !window.matchMedia("(max-width: 768px)").matches ||
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
        const finishRefresh = async () => {
          try {
            const reloaded = await reloadIfNewFrontendBundle();
            if (reloaded) return;
            if (onRefresh) {
              await onRefresh();
            } else {
              window.location.reload();
            }
          } finally {
            setPullRefresh({distance: 0, refreshing: false});
          }
        };

        window.setTimeout(() => {
          finishRefresh();
        }, 180);

        return {distance: 68, refreshing: true};
      }

      return {distance: 0, refreshing: false};
    });
  }, [onRefresh]);

  return {
    handlePullRefreshEnd,
    handlePullRefreshMove,
    handlePullRefreshStart,
    pullRefresh,
  };
}
