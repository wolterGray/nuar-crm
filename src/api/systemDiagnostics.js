import {getAuthToken, notifyAuthTokenRejected} from "../hooks/useAuth.js";
import {API_URL} from "./config.js";
import {authenticatedFetch} from "./authenticatedFetch.js";

export async function fetchBackupStatus() {
  const token = await getAuthToken?.();
  const response = await authenticatedFetch(`${API_URL}/api/backup/status`, {
    headers: token ? {Authorization: `Bearer ${token}`} : {},
  });
  if (!response.ok) {
    if (response.status === 401) notifyAuthTokenRejected();
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Не удалось проверить резервные копии (${response.status})`);
  }
  return response.json();
}

export async function fetchDataIntegrityStatus() {
  const token = await getAuthToken?.();
  const response = await authenticatedFetch(`${API_URL}/api/data-integrity/status`, {
    headers: token ? {Authorization: `Bearer ${token}`} : {},
  });
  if (!response.ok) {
    if (response.status === 401) notifyAuthTokenRejected();
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Не удалось проверить целостность данных (${response.status})`);
  }
  return response.json();
}
