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
      // The response body is not JSON; keep the status-based message.
    }

    throw new Error(message);
  }

  return response.json();
};

export const fetchClients = async () => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/clients`, {
    method: "GET",
    headers: {"Content-Type": "application/json", ...headers},
  });

  return handleResponse(response, "Clients");
};

export const createClient = async (client) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/clients`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(client),
  });

  return handleResponse(response, "Create client");
};

export const updateClient = async (id, client) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/clients/${id}`, {
    method: "PUT",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(client),
  });

  return handleResponse(response, "Update client");
};

export const deleteClient = async (id) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/clients/${id}`, {
    method: "DELETE",
    headers: {"Content-Type": "application/json", ...headers},
  });

  return handleResponse(response, "Delete client");
};
