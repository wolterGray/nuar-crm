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
      // Keep status based message.
    }

    throw new Error(message);
  }

  return response.json();
};

const jsonRequest = async (path, {body, label, method = "GET", publicRequest = false} = {}) => {
  const headers = publicRequest ? {} : await authHeaders();
  const response = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    method,
    headers: {"Content-Type": "application/json", ...headers},
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return handleResponse(response, label || path);
};

export const fetchPublicLoyaltyCard = (token) =>
  jsonRequest(`/api/public/loyalty/${encodeURIComponent(token)}`, {
    label: "Public loyalty card",
    publicRequest: true,
  });

export const fetchClientLoyaltyCard = (clientId) =>
  jsonRequest(`/api/loyalty/cards/client/${clientId}`, {
    label: "Client loyalty card",
  });

export const fetchLoyaltyCards = ({page = 1, pageSize = 50, reward = "all", search = "", status = "all"} = {}) => {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    reward,
    search,
    status,
  });
  return jsonRequest(`/api/loyalty/cards?${params.toString()}`, {
    label: "Loyalty cards",
  });
};

export const createClientLoyaltyCard = (clientId, body) =>
  jsonRequest(`/api/loyalty/cards/${clientId}/create`, {
    body,
    label: "Create loyalty card",
    method: "POST",
  });

export const fetchLoyaltyTransactions = (cardId, {page = 1, pageSize = 25} = {}) =>
  jsonRequest(`/api/loyalty/cards/${cardId}/transactions?page=${page}&pageSize=${pageSize}`, {
    label: "Loyalty transactions",
  });

export const fetchLoyaltyClubDetails = (cardId) =>
  jsonRequest(`/api/loyalty/cards/${cardId}/club`, {
    label: "Loyalty club details",
  });

export const fetchLoyaltyRewardTemplates = () =>
  jsonRequest("/api/loyalty/reward-templates", {
    label: "Loyalty reward templates",
  });

export const createLoyaltyRewardTemplate = (body) =>
  jsonRequest("/api/loyalty/reward-templates", {
    body,
    label: "Create loyalty reward template",
    method: "POST",
  });

export const updateLoyaltyRewardTemplate = (templateId, body) =>
  jsonRequest(`/api/loyalty/reward-templates/${templateId}`, {
    body,
    label: "Update loyalty reward template",
    method: "PATCH",
  });

export const deleteLoyaltyRewardTemplate = (templateId) =>
  jsonRequest(`/api/loyalty/reward-templates/${templateId}`, {
    label: "Delete loyalty reward template",
    method: "DELETE",
  });

export const redeemIssuedLoyaltyReward = (rewardId, body = {}) =>
  jsonRequest(`/api/loyalty/rewards/${rewardId}/redeem`, {
    body,
    label: "Redeem issued loyalty reward",
    method: "POST",
  });

export const earnLoyaltyStamp = (cardId, body) =>
  jsonRequest(`/api/loyalty/cards/${cardId}/earn`, {
    body,
    label: "Earn loyalty stamp",
    method: "POST",
  });

export const redeemLoyaltyReward = (cardId, body) =>
  jsonRequest(`/api/loyalty/cards/${cardId}/redeem`, {
    body,
    label: "Redeem loyalty reward",
    method: "POST",
  });

export const correctLoyaltyBalance = (cardId, body) =>
  jsonRequest(`/api/loyalty/cards/${cardId}/correct`, {
    body,
    label: "Correct loyalty balance",
    method: "POST",
  });

export const reissueLoyaltyLink = (cardId) =>
  jsonRequest(`/api/loyalty/cards/${cardId}/reissue-link`, {
    label: "Reissue loyalty link",
    method: "POST",
  });

export const updateLoyaltyCardLanguage = (cardId, body) =>
  jsonRequest(`/api/loyalty/cards/${cardId}/language`, {
    body,
    label: "Update loyalty card language",
    method: "PATCH",
  });

export const updateLoyaltyCardStatus = (cardId, body) =>
  jsonRequest(`/api/loyalty/cards/${cardId}/status`, {
    body,
    label: "Update loyalty card status",
    method: "PATCH",
  });

export const deleteLoyaltyCard = (cardId) =>
  jsonRequest(`/api/loyalty/cards/${cardId}`, {
    label: "Delete loyalty card",
    method: "DELETE",
  });
