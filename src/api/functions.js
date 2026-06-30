import {getAuthToken, notifyAuthTokenRejected} from "../hooks/useAuth.js";

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const authHeaders = async () => {
  const token = await getAuthToken?.();
  return token ? {Authorization: `Bearer ${token}`} : {};
};

const parseResponse = async (res) => {
  if (res.status === 401) {
    notifyAuthTokenRejected();
  }

  return res.json();
};

export const bulkSms = async (payload) => {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/functions/bulk-sms`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(payload),
  });
  return parseResponse(res);
};

export const telegramDigest = async (payload) => {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/functions/telegram-digest`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(payload),
  });
  return parseResponse(res);
};

export const smsReminders = async (payload) => {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/functions/sms-reminders`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(payload),
  });
  return parseResponse(res);
};

export const ownerNotify = async (payload) => {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/functions/owner-notify`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(payload),
  });
  return parseResponse(res);
};

export const reviewRequests = async (payload) => {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/functions/review-requests`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(payload),
  });
  return parseResponse(res);
};

export const booksySync = async (payload) => {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/functions/booksy-sync`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(payload),
  });
  return parseResponse(res);
};
