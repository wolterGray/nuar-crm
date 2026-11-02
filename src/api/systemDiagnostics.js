import {getAuthToken, notifyAuthTokenRejected} from "../hooks/useAuth.js";
import {API_URL} from "./config.js";

export async function fetchBackupStatus() {
  const token = await getAuthToken?.();
  const response = await fetch(`${API_URL}/api/backup/status`, {
    headers: token ? {Authorization: `Bearer ${token}`} : {},
  });
  if (!response.ok) {
    if (response.status === 401) notifyAuthTokenRejected();
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Не удалось проверить резервные копии (${response.status})`);
  }
  return response.json();
}
