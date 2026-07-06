import {API_URL} from "../api/config.js";
import {getAuthToken, notifyAuthTokenRejected} from "../hooks/useAuth.js";

const PENDING_SITE_BOOKINGS_LIMIT = 25;
const RECENT_SITE_BOOKINGS_LIMIT = 25;
const SITE_BOOKING_CACHE_TTL_MS = 60_000;

const requestCache = new Map();

const getCached = (key) => {
  const cached = requestCache.get(key);

  if (!cached || Date.now() - cached.cachedAt > SITE_BOOKING_CACHE_TTL_MS) {
    requestCache.delete(key);
    return null;
  }

  return cached.data;
};

const setCached = (key, data) => {
  requestCache.set(key, {cachedAt: Date.now(), data});
};

export const clearSiteBookingCache = () => {
  requestCache.clear();
};

const authHeaders = async () => {
  const token = await getAuthToken?.();
  return token ? {Authorization: `Bearer ${token}`} : {};
};

const handleResponse = async (response, label) => {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.success === false) {
    if (response.status === 401) {
      notifyAuthTokenRejected();
    }
    throw new Error(payload?.error || payload?.message || `${label} API request failed`);
  }

  return payload?.data ?? payload;
};

const backendRequest = async (path, {body, label, method = "GET", publicRequest = false} = {}) => {
  if (!API_URL) {
    throw new Error("Backend не настроен");
  }

  const headers = publicRequest ? {} : await authHeaders();
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {"Content-Type": "application/json", ...headers},
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });

  return handleResponse(response, label ?? path);
};

export const fetchPendingSiteBookings = async () => {
  const cached = getCached("pending");

  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    limit: String(PENDING_SITE_BOOKINGS_LIMIT),
    status: "pending",
  });
  const requests = await backendRequest(`/api/site-bookings?${params.toString()}`, {
    label: "Site bookings",
  });

  setCached("pending", requests);
  return requests;
};

export const fetchRecentSiteBookings = async ({limit = RECENT_SITE_BOOKINGS_LIMIT} = {}) => {
  const cacheKey = `recent:${limit}`;
  const cached = getCached(cacheKey);

  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({limit: String(limit)});
  const requests = await backendRequest(`/api/site-bookings?${params.toString()}`, {
    label: "Recent site bookings",
  });

  setCached(cacheKey, requests);
  return requests;
};

export const updateSiteBookingRequest = async (id, patch) => {
  const request = await backendRequest(`/api/site-bookings/${encodeURIComponent(id)}`, {
    body: patch,
    label: "Update site booking",
    method: "PATCH",
  });

  clearSiteBookingCache();
  return request;
};

export const submitSiteBookingRequest = async (payload) =>
  backendRequest("/api/public/site-booking-submit", {
    body: payload,
    label: "Submit site booking",
    method: "POST",
    publicRequest: true,
  });
