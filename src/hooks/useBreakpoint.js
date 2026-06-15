import {useEffect, useState} from "react";
import {MOBILE_MAX_WIDTH} from "../constants/breakpoints.js";

const TABLET_MAX_WIDTH = 1024;

function getBreakpoint(width) {
  if (width <= MOBILE_MAX_WIDTH) return "mobile";
  if (width <= TABLET_MAX_WIDTH) return "tablet";
  return "desktop";
}

export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState(() =>
    typeof window !== "undefined" ? getBreakpoint(window.innerWidth) : "desktop",
  );

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`);

    const sync = () => setBreakpoint(getBreakpoint(window.innerWidth));

    sync();
    media.addEventListener("change", sync);
    window.addEventListener("orientationchange", sync);

    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  return {
    breakpoint,
    isMobile: breakpoint === "mobile",
    isTablet: breakpoint === "tablet",
    isDesktop: breakpoint === "desktop",
  };
}
