import {getAuthToken, notifyAuthTokenRejected} from "../hooks/useAuth.js";
import {API_URL} from "./config.js";

const authHeaders = async () => {
  const token = await getAuthToken?.();
  return token ? {Authorization: `Bearer ${token}`} : {};
};

const parseResponse = async (res) => {
  if (res.status === 401) {
    notifyAuthTokenRejected();
  }

  const data = await res.json();
  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || "Notification events request failed");
  }

  return data.data;
};

export const fetchNotificationEvents = async ({limit = 50, status = "active"} = {}) => {
  const headers = await authHeaders();
  const params = new URLSearchParams({
    limit: String(limit),
    status,
  });
  const res = await fetch(`${API_URL}/api/notification-events?${params.toString()}`, {
    headers,
  });
  return parseResponse(res);
};

export const generateNotificationEvents = async () => {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/api/notification-events/generate`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify({}),
  });
  return parseResponse(res);
};

export const upsertNotificationEvent = async (event) => {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/api/notification-events`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(event),
  });
  return parseResponse(res);
};

export const planNotificationDeliveries = async ({commit = false, limit = 50} = {}) => {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/api/notification-events/plan-delivery`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify({commit, limit}),
  });
  return parseResponse(res);
};

export const updateNotificationEvent = async (id, patch) => {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/api/notification-events/${id}`, {
    method: "PATCH",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(patch),
  });
  return parseResponse(res);
};
