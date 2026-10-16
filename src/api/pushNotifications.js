import {getAuthToken, notifyAuthTokenRejected} from "../hooks/useAuth.js";
import {API_URL} from "./config.js";

const request = async (path, options = {}) => {
  const token = getAuthToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
      ...options.headers,
    },
  });
  if (response.status === 401) notifyAuthTokenRejected();
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const error = new Error(payload.error || "Push request failed");
    error.status = response.status;
    throw error;
  }
  return payload.data;
};

export const fetchPushConfig = () => request("/api/push/config");

export const fetchPushPreferences = () => request("/api/push/preferences");

export const updatePushPreferences = (preferences) =>
  request("/api/push/preferences", {
    method: "PUT",
    body: JSON.stringify(preferences),
  });

export const fetchPushSubscriptionStatus = (endpoint) =>
  request("/api/push/subscription/status", {
    method: "POST",
    body: JSON.stringify({endpoint}),
  });

export const registerPushSubscription = (subscription, metadata = {}) =>
  request("/api/push/subscriptions", {
    method: "POST",
    body: JSON.stringify({subscription: subscription.toJSON(), ...metadata}),
  });

export const disablePushSubscription = (endpoint) =>
  request("/api/push/subscriptions", {
    method: "DELETE",
    body: JSON.stringify({endpoint}),
  });

export const sendTestPushNotification = () =>
  request("/api/push/test", {method: "POST", body: "{}"});
