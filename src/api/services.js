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

export const fetchServices = async () => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/services`, {
    method: "GET",
    headers: {"Content-Type": "application/json", ...headers},
  });

  return handleResponse(response, "Services");
};

export const createService = async (service) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/services`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(service),
  });

  return handleResponse(response, "Create service");
};

export const updateService = async (id, service) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/services/${id}`, {
    method: "PUT",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(service),
  });

  return handleResponse(response, "Update service");
};

export const deleteService = async (id) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/services/${id}`, {
    method: "DELETE",
    headers: {"Content-Type": "application/json", ...headers},
  });

  return handleResponse(response, "Delete service");
};
