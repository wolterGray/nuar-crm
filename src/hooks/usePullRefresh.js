import {useCallback, useEffect, useRef, useState} from "react";

const PULL_THRESHOLD = 64;
const PULL_HOLD_DISTANCE = 54;
const PULL_MAX_DISTANCE = 104;
const MIN_REFRESH_FEEDBACK_MS = 420;
const DIRECTION_LOCK_DISTANCE = 10;
const VERTICAL_GESTURE_RATIO = 1.35;

function getElasticDistance(delta) {
  if (delta <= 0) return 0;
  return Math.min(
    PULL_MAX_DISTANCE,
    Math.round(PULL_MAX_DISTANCE * (1 - Math.exp(-delta / 118))),
  );
}

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
    pulling: false,
    ready: false,
    refreshing: false,
  });
  const pullStartYRef = useRef(0);
  const pullStartXRef = useRef(0);
  const pullTrackingRef = useRef(false);
  const pullDirectionRef = useRef(null);

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
      pullDirectionRef.current = null;
      pullStartXRef.current = event.touches[0]?.clientX ?? 0;
      pullStartYRef.current = event.touches[0]?.clientY ?? 0;
    },
    [getScrollableParent, isBlocked, pullRefresh.refreshing],
  );

  const handlePullRefreshMove = useCallback((event) => {
    if (!pullTrackingRef.current) {
      return;
    }

    const touch = event.touches[0];
    const currentX = touch?.clientX ?? 0;
    const currentY = touch?.clientY ?? 0;
    const deltaX = currentX - pullStartXRef.current;
    const delta = currentY - pullStartYRef.current;

    if (!pullDirectionRef.current) {
      if (Math.max(Math.abs(deltaX), Math.abs(delta)) < DIRECTION_LOCK_DISTANCE) return;

      if (Math.abs(delta) < Math.abs(deltaX) * VERTICAL_GESTURE_RATIO || delta <= 0) {
        pullDirectionRef.current = "horizontal";
        pullTrackingRef.current = false;
        return;
      }

      pullDirectionRef.current = "vertical";
    }

    if (pullDirectionRef.current !== "vertical") return;

    if (delta <= 0) {
      setPullRefresh((current) =>
        current.distance || current.ready
          ? {...current, distance: 0, ready: false}
          : current,
      );
      return;
    }

    if (delta > 6) {
      event.preventDefault();
    }

    const distance = getElasticDistance(delta);
    setPullRefresh((current) => ({
      ...current,
      distance,
      pulling: true,
      ready: distance >= PULL_THRESHOLD,
    }));
  }, []);

  const handlePullRefreshEnd = useCallback((event) => {
    if (!pullTrackingRef.current) {
      return;
    }

    pullTrackingRef.current = false;
    pullDirectionRef.current = null;
    if (event?.type === "touchcancel") {
      setPullRefresh({distance: 0, pulling: false, ready: false, refreshing: false});
      return;
    }

    setPullRefresh((current) => {
      if (current.ready) {
        const finishRefresh = async () => {
          try {
            const reloaded = await reloadIfNewFrontendBundle();
            if (reloaded) return;
            if (onRefresh) {
              await Promise.all([
                onRefresh(),
                new Promise((resolve) => window.setTimeout(resolve, MIN_REFRESH_FEEDBACK_MS)),
              ]);
            } else {
              window.location.reload();
            }
          } finally {
            setPullRefresh({distance: 0, pulling: false, ready: false, refreshing: false});
          }
        };

        window.setTimeout(() => {
          finishRefresh();
        }, 180);

        return {distance: PULL_HOLD_DISTANCE, pulling: false, ready: true, refreshing: true};
      }

      return {distance: 0, pulling: false, ready: false, refreshing: false};
    });
  }, [onRefresh]);

  return {
    handlePullRefreshEnd,
    handlePullRefreshMove,
    handlePullRefreshStart,
    pullRefresh: {
      ...pullRefresh,
      progress: Math.min(1, pullRefresh.distance / PULL_THRESHOLD),
    },
  };
}
