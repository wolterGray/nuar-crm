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

export const fetchTasks = async () => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/tasks`, {
    method: "GET",
    headers: {"Content-Type": "application/json", ...headers},
  });

  return handleResponse(response, "Tasks");
};

export const createTask = async (task) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/tasks`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(task),
  });

  return handleResponse(response, "Create task");
};

export const updateTask = async (id, task) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/tasks/${id}`, {
    method: "PUT",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(task),
  });

  return handleResponse(response, "Update task");
};

export const deleteTask = async (id) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/tasks/${id}`, {
    method: "DELETE",
    headers: {"Content-Type": "application/json", ...headers},
  });

  return handleResponse(response, "Delete task");
};
