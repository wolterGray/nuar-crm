import {useCallback, useEffect, useRef} from "react";
import {
  getPageFromPath,
  getPathFromPage,
  isKnownAppPage,
  resolveInitialPage,
} from "../utils/appRouting.js";

export function useAppRouting(activePage, setActivePage) {
  const hasHydratedFromUrlRef = useRef(false);

  const navigateToPage = useCallback(
    (page) => {
      setActivePage(page);

      if (!isKnownAppPage(page)) {
        return;
      }

      const nextPath = getPathFromPage(page);

      if (window.location.pathname !== nextPath) {
        window.history.pushState({page}, "", nextPath);
      }
    },
    [setActivePage],
  );

  useEffect(() => {
    if (hasHydratedFromUrlRef.current) {
      return;
    }

    hasHydratedFromUrlRef.current = true;
    const initialPage = resolveInitialPage({
      pathname: window.location.pathname,
      storedPage: activePage,
    });

    if (initialPage !== activePage) {
      setActivePage(initialPage);
    }

    const nextPath = getPathFromPage(initialPage);

    if (window.location.pathname !== nextPath) {
      window.history.replaceState({page: initialPage}, "", nextPath);
    }
  }, [activePage, setActivePage]);

  useEffect(() => {
    const handlePopState = () => {
      const pageFromUrl = getPageFromPath(window.location.pathname);
      const nextPage =
        pageFromUrl ??
        window.history.state?.page ??
        resolveInitialPage({storedPage: activePage});

      if (isKnownAppPage(nextPage)) {
        setActivePage(nextPage);
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, [activePage, setActivePage]);

  return navigateToPage;
}
