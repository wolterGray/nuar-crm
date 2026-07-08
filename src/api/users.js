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

const requestUsers = async (path = "", {body, method = "GET"} = {}) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/users${path}`, {
    method,
    headers: {"Content-Type": "application/json", ...headers},
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });

  return handleResponse(response, "Users");
};

export const fetchUsers = () => requestUsers();

export const createUser = (payload) =>
  requestUsers("", {
    body: payload,
    method: "POST",
  });

export const updateUser = (id, payload) =>
  requestUsers(`/${id}`, {
    body: payload,
    method: "PUT",
  });

export const disableUser = (id) =>
  requestUsers(`/${id}/disable`, {
    method: "POST",
  });

export const enableUser = (id) =>
  requestUsers(`/${id}/enable`, {
    method: "POST",
  });

export const sendUserReset = (id) =>
  requestUsers(`/${id}/send-reset`, {
    method: "POST",
  });
