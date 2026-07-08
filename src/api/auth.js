import {API_URL} from "./config.js";

const parseAuthResponse = async (response) => {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.message || "Auth request failed";
    const error = new Error(message);
    error.payload = payload;
    error.status = response.status;
    throw error;
  }

  return payload;
};

export async function forgotPassword(email) {
  const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({email}),
  });

  return parseAuthResponse(response);
}

export async function resetPassword({token, newPassword}) {
  const response = await fetch(`${API_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({token, newPassword}),
  });

  return parseAuthResponse(response);
}
