import {getAuthToken, notifyAuthTokenRejected} from "../hooks/useAuth.js";

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://192.168.18.2:3001";

export const SYSTEM_STATE_KEYS = {
  alertSnoozes: "alertSnoozes",
  appSettings: "appSettings",
  autoCompletedCalendarEntryIds: "autoCompletedCalendarEntryIds",
  dismissedClientAlertIds: "dismissedClientAlertIds",
  importDocuments: "importDocuments",
  importedMailIds: "importedMailIds",
  inactiveFollowUpLog: "inactiveFollowUpLog",
  notificationInbox: "notificationInbox",
  reviewRequestLog: "reviewRequestLog",
  smsReminderLog: "smsReminderLog",
};

const authHeaders = async () => {
  const token = await getAuthToken?.();
  return token ? {Authorization: `Bearer ${token}`} : {};
};

const handleResponse = async (response, label) => {
  if (!response.ok) {
    if (response.status === 401) {
      notifyAuthTokenRejected();
    }

    let message = `${label} API request failed: ${response.status}`;
    try {
      const payload = await response.json();
      message = payload?.error || payload?.message || message;
    } catch {
      // Keep the status-based message.
    }

    throw new Error(message);
  }

  return response.json();
};

export const fetchSystemState = async () => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/system-state`, {
    method: "GET",
    headers: {"Content-Type": "application/json", ...headers},
  });

  return handleResponse(response, "System state");
};

export const saveSystemStateEntries = async (entries) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/system-state`, {
    method: "PUT",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify({entries}),
  });

  return handleResponse(response, "Save system state");
};

export const saveSystemStateEntry = async (key, payload) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/system-state/${key}`, {
    method: "PUT",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify({payload}),
  });

  return handleResponse(response, `Save system state ${key}`);
};
