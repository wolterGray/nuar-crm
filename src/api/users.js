import {getAuthToken, notifyAuthTokenRejected} from "../hooks/useAuth.js";
import {generateStrongPassword} from "../utils/passwordStrength.js";
import {resetPassword} from "./auth.js";
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
    let payload = null;
    try {
      payload = await response.json();
      message = payload?.error || payload?.message || message;
    } catch {
      // Keep the status-based message.
    }

    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
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

function extractResetToken(resetUrl = "") {
  if (!resetUrl) return "";
  try {
    const parsed = new URL(resetUrl, "https://crm.nuarr.pl");
    return parsed.searchParams.get("token") || "";
  } catch {
    const match = String(resetUrl).match(/[?&]token=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }
}

export const fetchUsers = () => requestUsers();

export const createUser = async (payload = {}) => {
  const desiredPassword = String(
    payload.temporaryPassword || payload.manualPassword || payload.password || "",
  ).trim();

  const res = await requestUsers("", {
    body: {
      ...payload,
      deliveryMethod: payload.deliveryMethod || (desiredPassword ? "manual_temp" : "email"),
      temporaryPassword: desiredPassword || undefined,
    },
    method: "POST",
  });

  // If the remote server is on an older version that returns resetUrl instead of setting temporaryPassword directly,
  // immediately apply the desired password using the generated reset token.
  if (desiredPassword && !res.temporaryPassword && res.resetUrl) {
    const token = extractResetToken(res.resetUrl);
    if (token) {
      await resetPassword({token, newPassword: desiredPassword});
      return {
        ...res,
        temporaryPassword: desiredPassword,
      };
    }
  }

  return res;
};

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

export const resetUserPassword = async (id, payload = {}) => {
  const method = String(
    payload.method || payload.deliveryMethod || "manual_temp",
  )
    .trim()
    .toLowerCase();

  let newPassword = String(
    payload.temporaryPassword || payload.manualPassword || payload.password || "",
  ).trim();

  if (method === "generate_temp" && !newPassword) {
    newPassword = generateStrongPassword({email: payload.email || ""});
  }

  try {
    const res = await requestUsers(`/${id}/reset-password`, {
      body: {
        method,
        deliveryMethod: method,
        temporaryPassword: newPassword || undefined,
        password: newPassword || undefined,
      },
      method: "POST",
    });

    return {
      ...res,
      temporaryPassword: res.temporaryPassword || (newPassword || undefined),
    };
  } catch (error) {
    const is404 =
      error?.status === 404 || String(error?.message || "").includes("404");
    if (!is404) {
      throw error;
    }

    // Fallback when remote backend has /send-reset + /api/auth/reset-password
    const resetRes = await sendUserReset(id);

    if ((method === "email" || method === "link") && !newPassword) {
      return {
        ...resetRes,
        method,
      };
    }

    const token = extractResetToken(resetRes?.resetUrl);
    if (!token) {
      throw new Error("Не удалось получить токен для установки нового пароля", {
        cause: error,
      });
    }

    const passwordToSet =
      newPassword || generateStrongPassword({email: payload.email || ""});

    await resetPassword({
      token,
      newPassword: passwordToSet,
    });

    return {
      success: true,
      method,
      temporaryPassword: passwordToSet,
    };
  }
};
