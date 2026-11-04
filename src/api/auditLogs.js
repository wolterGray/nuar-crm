import {getAuthToken, notifyAuthTokenRejected} from "../hooks/useAuth.js";
import {API_URL} from "./config.js";

const reportedClientErrors = new Set();

export async function reportClientError(error, {componentStack = ""} = {}) {
  const token = await getAuthToken?.();
  if (!token) return false;

  const message = String(error?.message ?? error ?? "Unknown frontend error").slice(0, 500);
  const stack = String(error?.stack ?? "").slice(0, 4000);
  const fingerprint = `${message}\n${stack.slice(0, 500)}\n${window.location.pathname}`;
  if (reportedClientErrors.has(fingerprint)) return false;
  reportedClientErrors.add(fingerprint);

  try {
    const response = await fetch(`${API_URL}/api/client-errors`, {
      body: JSON.stringify({
        componentStack: String(componentStack).slice(0, 4000),
        message,
        path: window.location.pathname.slice(0, 300),
        release: String(import.meta.env.VITE_APP_VERSION ?? "").slice(0, 100),
        stack,
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      keepalive: true,
    });
    return response.ok;
  } catch {
    reportedClientErrors.delete(fingerprint);
    return false;
  }
}

export async function fetchAuditLogs(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      query.set(key, String(value));
    }
  });
  const token = await getAuthToken?.();
  const response = await fetch(`${API_URL}/api/audit-logs?${query}`, {
    headers: token ? {Authorization: `Bearer ${token}`} : {},
  });
  if (!response.ok) {
    if (response.status === 401) notifyAuthTokenRejected();
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Не удалось загрузить историю (${response.status})`);
  }
  return response.json();
}

export async function fetchErrorSummary() {
  const token = await getAuthToken?.();
  const response = await fetch(`${API_URL}/api/error-events/summary`, {
    headers: token ? {Authorization: `Bearer ${token}`} : {},
  });
  if (!response.ok) {
    if (response.status === 401) notifyAuthTokenRejected();
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Не удалось загрузить диагностику (${response.status})`);
  }
  return response.json();
}
