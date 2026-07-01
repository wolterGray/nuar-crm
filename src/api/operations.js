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

const request = async (path, {body, label, method = "GET"} = {}) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {"Content-Type": "application/json", ...headers},
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });

  return handleResponse(response, label ?? path);
};

export const fetchOperationsState = () =>
  request("/api/operations-state", {label: "Operations state"});

export const createMessageTemplate = (template) =>
  request("/api/message-templates", {
    body: template,
    label: "Create message template",
    method: "POST",
  });

export const updateMessageTemplate = (id, template) =>
  request(`/api/message-templates/${id}`, {
    body: template,
    label: "Update message template",
    method: "PUT",
  });

export const deleteMessageTemplate = (id) =>
  request(`/api/message-templates/${id}`, {
    label: "Delete message template",
    method: "DELETE",
  });

export const createCommunicationLogEntry = (entry) =>
  request("/api/communication-log", {
    body: entry,
    label: "Create communication log entry",
    method: "POST",
  });

export const updateCommunicationLogEntry = (id, entry) =>
  request(`/api/communication-log/${id}`, {
    body: entry,
    label: "Update communication log entry",
    method: "PUT",
  });

export const deleteCommunicationLogEntry = (id) =>
  request(`/api/communication-log/${id}`, {
    label: "Delete communication log entry",
    method: "DELETE",
  });
