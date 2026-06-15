/** Primary mobile breakpoint — matches CSS @media (max-width: 768px). */
export const MOBILE_MAX_WIDTH = 768;

/** Tablet / compact shell — bottom nav instead of sidebar. */
export const SHELL_COMPACT_MAX_WIDTH = 1024;

export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`;

export const SHELL_COMPACT_MEDIA_QUERY = `(max-width: ${SHELL_COMPACT_MAX_WIDTH}px)`;

export const isMobileViewport = () =>
  typeof window !== "undefined" && window.innerWidth <= MOBILE_MAX_WIDTH;

export const isShellCompactViewport = () =>
  typeof window !== "undefined" && window.innerWidth <= SHELL_COMPACT_MAX_WIDTH;
