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

export const fetchFinancialState = () =>
  request("/api/financial-state", {label: "Financial state"});

export const createPackage = (packageItem) =>
  request("/api/packages", {body: packageItem, label: "Create package", method: "POST"});

export const updatePackage = (id, packageItem) =>
  request(`/api/packages/${id}`, {body: packageItem, label: "Update package", method: "PUT"});

export const deletePackage = (id) =>
  request(`/api/packages/${id}`, {label: "Delete package", method: "DELETE"});

export const createClientPackage = (clientPackage) =>
  request("/api/client-packages", {
    body: clientPackage,
    label: "Create client package",
    method: "POST",
  });

export const updateClientPackage = (id, clientPackage) =>
  request(`/api/client-packages/${id}`, {
    body: clientPackage,
    label: "Update client package",
    method: "PUT",
  });

export const deleteClientPackage = (id) =>
  request(`/api/client-packages/${id}`, {
    label: "Delete client package",
    method: "DELETE",
  });

export const createCertificate = (certificate) =>
  request("/api/certificates", {
    body: certificate,
    label: "Create certificate",
    method: "POST",
  });

export const sellCertificate = (payload) =>
  request("/api/certificates/sell", {
    body: payload,
    label: "Sell certificate",
    method: "POST",
  });

export const updateCertificate = (id, certificate) =>
  request(`/api/certificates/${id}`, {
    body: certificate,
    label: "Update certificate",
    method: "PUT",
  });

export const deleteCertificate = (id) =>
  request(`/api/certificates/${id}`, {
    label: "Delete certificate",
    method: "DELETE",
  });

export const closeDayRecord = (payload) =>
  request("/api/day-close-records/close", {
    body: payload,
    label: "Close day",
    method: "POST",
  });

export const deleteDayCloseRecord = (id) =>
  request(`/api/day-close-records/${id}`, {
    label: "Delete day close record",
    method: "DELETE",
  });

export const fetchPayrollSummary = ({employeeId, endDate, startDate}) => {
  const params = new URLSearchParams({
    dateFrom: startDate,
    dateTo: endDate,
  });

  if (employeeId) {
    params.set("employeeId", String(employeeId));
  }

  return request(`/api/payroll/summary?${params.toString()}`, {
    label: "Payroll summary",
  });
};

export const markPayrollPaidRecord = (payload) =>
  request("/api/payroll/mark-paid", {
    body: payload,
    label: "Mark payroll paid",
    method: "POST",
  });

export const deletePayrollRecord = (id) =>
  request(`/api/payroll-records/${id}`, {
    label: "Delete payroll record",
    method: "DELETE",
  });
