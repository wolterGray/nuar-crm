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

const request = async (path, {body, label, method = "GET"} = {}) => {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {"Content-Type": "application/json", ...headers},
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });

  return handleResponse(response, label ?? path);
};

const buildPeriodQuery = ({endDate, startDate} = {}) => {
  const params = new URLSearchParams();
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  const query = params.toString();
  return query ? `?${query}` : "";
};

export const fetchEmployeeEarningsSummary = (period) =>
  request(`/api/employee-earnings/summary${buildPeriodQuery(period)}`, {
    label: "Employee earnings summary",
  });

export const fetchEmployeeEarningsDetail = (employeeId, period) =>
  request(`/api/employee-earnings/employees/${employeeId}${buildPeriodQuery(period)}`, {
    label: "Employee earnings detail",
  });

export const createEmployeePayout = (payload) =>
  request("/api/employee-payouts", {
    body: payload,
    label: "Create employee payout",
    method: "POST",
  });

export const fetchEmployeePayouts = () =>
  request("/api/employee-payouts", {label: "Employee payouts"});

export const fetchEmployeePayout = (id) =>
  request(`/api/employee-payouts/${id}`, {label: "Employee payout"});

export const cancelEmployeePayout = (id, payload = {}) =>
  request(`/api/employee-payouts/${id}/cancel`, {
    body: payload,
    label: "Cancel employee payout",
    method: "POST",
  });

export const deleteEmployeePayout = (id) =>
  request(`/api/employee-payouts/${id}`, {
    label: "Delete employee payout",
    method: "DELETE",
  });
