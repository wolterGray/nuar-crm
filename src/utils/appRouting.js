import {navItems} from "../constants/navigation.js";

export const APP_PAGE_PATHS = {
  today: "/today",
  calendar: "/calendar",
  clients: "/clients",
  payments: "/payments",
  operations: "/operations",
  services: "/services",
  packages: "/packages",
  masters: "/masters",
  templates: "/templates",
  import: "/import",
  statistics: "/statistics",
  settings: "/settings",
  site: "/site",
};

const PATH_TO_PAGE = Object.fromEntries(
  Object.entries(APP_PAGE_PATHS).map(([page, path]) => [path, page]),
);

export const KNOWN_APP_PAGES = new Set([
  ...navItems.map((item) => item.page),
  "site",
]);

export const isKnownAppPage = (page) => KNOWN_APP_PAGES.has(page);

export const normalizeAppPath = (pathname = "") => {
  const trimmed = String(pathname ?? "").trim();

  if (!trimmed || trimmed === "/") {
    return "/";
  }

  return trimmed.replace(/\/+$/, "") || "/";
};

export const getPathFromPage = (page) => {
  if (!isKnownAppPage(page)) {
    return APP_PAGE_PATHS.calendar;
  }

  return APP_PAGE_PATHS[page] ?? APP_PAGE_PATHS.calendar;
};

export const getPageFromPath = (pathname = "") => {
  const normalized = normalizeAppPath(pathname);

  if (normalized === "/") {
    return null;
  }

  return PATH_TO_PAGE[normalized] ?? null;
};

export const resolveInitialPage = ({
  pathname = window.location.pathname,
  storedPage = "calendar",
} = {}) => getPageFromPath(pathname) ?? storedPage;
