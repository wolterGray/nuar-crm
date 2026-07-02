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

export const fetchEmployees = async () => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/employees`, {
    method: "GET",
    headers: {"Content-Type": "application/json", ...headers},
  });

  return handleResponse(response, "Employees");
};

export const createEmployee = async (employee) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/employees`, {
    method: "POST",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(employee),
  });

  return handleResponse(response, "Create employee");
};

export const updateEmployee = async (id, employee) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/employees/${id}`, {
    method: "PUT",
    headers: {"Content-Type": "application/json", ...headers},
    body: JSON.stringify(employee),
  });

  return handleResponse(response, "Update employee");
};

export const deleteEmployee = async (id) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/employees/${id}`, {
    method: "DELETE",
    headers: {"Content-Type": "application/json", ...headers},
  });

  return handleResponse(response, "Delete employee");
};
