import {getAuthToken, notifyAuthTokenRejected} from "../hooks/useAuth.js";
import {API_URL} from "./config.js";

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
