import {getAuthToken, notifyAuthTokenRejected} from "../hooks/useAuth.js";

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://192.168.18.2:3001";

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

export const fetchVisitState = async () => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/visit-state`, {
    method: "GET",
    headers: {"Content-Type": "application/json", ...headers},
  });

  return handleResponse(response, "Visit state");
};

export const createCalendarEntry = async (entry) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/calendar-entries`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(entry),
  });

  return handleResponse(response, "Create calendar entry");
};

export const updateCalendarEntry = async (id, entry) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/calendar-entries/${id}`, {
    method: "PUT",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(entry),
  });

  return handleResponse(response, "Update calendar entry");
};

export const deleteCalendarEntry = async (id) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/calendar-entries/${id}`, {
    method: "DELETE",
    headers: {"Content-Type": "application/json", ...headers},
  });

  return handleResponse(response, "Delete calendar entry");
};

export const createVisit = async (visit) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/visits/journal`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(visit),
  });

  return handleResponse(response, "Create visit");
};

export const updateVisit = async (id, visit) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/visits/journal/${id}`, {
    method: "PUT",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(visit),
  });

  return handleResponse(response, "Update visit");
};

export const deleteVisit = async (id) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/visits/journal/${id}`, {
    method: "DELETE",
    headers: {"Content-Type": "application/json", ...headers},
  });

  return handleResponse(response, "Delete visit");
};
