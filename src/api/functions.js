import {getAuthToken} from "../hooks/useAuth.js";

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const authHeaders = async () => {
  const token = await getAuthToken?.();
  return token ? {Authorization: `Bearer ${token}`} : {};
};

export const bulkSms = async (payload) => {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/functions/bulk-sms`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const telegramDigest = async (payload) => {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/functions/telegram-digest`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const smsReminders = async (payload) => {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/functions/sms-reminders`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const ownerNotify = async (payload) => {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/functions/owner-notify`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const reviewRequests = async (payload) => {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/functions/review-requests`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const booksySync = async (payload) => {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/functions/booksy-sync`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(payload),
  });
  return res.json();
};
