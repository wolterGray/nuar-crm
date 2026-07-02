import {getAuthToken, notifyAuthTokenRejected} from "../hooks/useAuth.js";
import {API_URL} from "./config.js";

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

export const fetchWaitlist = async () => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/waitlist`, {
    method: "GET",
    headers: {"Content-Type": "application/json", ...headers},
  });

  return handleResponse(response, "Waitlist");
};

export const createWaitlistEntry = async (entry) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/waitlist`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(entry),
  });

  return handleResponse(response, "Create waitlist entry");
};

export const updateWaitlistEntry = async (id, entry) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/waitlist/${id}`, {
    method: "PUT",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(entry),
  });

  return handleResponse(response, "Update waitlist entry");
};

export const deleteWaitlistEntry = async (id) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/waitlist/${id}`, {
    method: "DELETE",
    headers: {"Content-Type": "application/json", ...headers},
  });

  return handleResponse(response, "Delete waitlist entry");
};
