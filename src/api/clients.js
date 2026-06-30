import {getAuthToken} from "../hooks/useAuth.js";

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const authHeaders = async () => {
  const token = await getAuthToken?.();
  return token ? {Authorization: `Bearer ${token}`} : {};
};

export const fetchClients = async () => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/clients`, {
    method: "GET",
    headers: {"Content-Type": "application/json", ...headers},
  });

  if (!response.ok) {
    throw new Error(`Clients API request failed: ${response.status}`);
  }

  return response.json();
};
