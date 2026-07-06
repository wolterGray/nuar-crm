export const DEFAULT_API_URL = "https://api.nuarr.pl";

export const API_URL = String(
  import.meta.env.VITE_BACKEND_URL || DEFAULT_API_URL,
).replace(/\/$/, "");
