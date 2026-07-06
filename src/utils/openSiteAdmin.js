import {getAuthToken} from "../hooks/useAuth.js";

const PRODUCTION_SITE_URL = "https://nuarr.pl";

function getSiteBaseUrl() {
  const configured = import.meta.env.VITE_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:5174";
  return PRODUCTION_SITE_URL;
}

export async function openSiteAdmin(path = "/admin/login") {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Сессия CRM не найдена. Войдите заново.");
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const hash = new URLSearchParams({
    crm_token: token,
    token_type: "bearer",
  }).toString();

  window.open(`${getSiteBaseUrl()}${normalizedPath}#${hash}`, "_blank", "noopener");
}

export function getPublicSiteUrl() {
  return getSiteBaseUrl();
}
