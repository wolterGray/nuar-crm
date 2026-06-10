import {isSupabaseConfigured, supabase} from "../lib/supabase.js";

const PRODUCTION_SITE_URL = "https://nuarr.pl";

function getSiteBaseUrl() {
  const configured = import.meta.env.VITE_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:5174";
  return PRODUCTION_SITE_URL;
}

export async function openSiteAdmin(path = "/admin") {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase не настроен.");
  }

  const {
    data: {session},
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  if (!session?.access_token || !session?.refresh_token) {
    throw new Error("Сессия CRM не найдена. Войдите заново.");
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const hash = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: String(session.expires_in ?? 3600),
    token_type: "bearer",
    type: "crm_sso",
  }).toString();

  window.open(`${getSiteBaseUrl()}${normalizedPath}#${hash}`, "_blank", "noopener");
}

export function getPublicSiteUrl() {
  return getSiteBaseUrl();
}
