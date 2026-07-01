import {getAuthToken, notifyAuthTokenRejected} from "../hooks/useAuth.js";

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://192.168.18.2:3001";

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

export const createDayCloseRecord = (record) =>
  request("/api/day-close-records", {
    body: record,
    label: "Create day close record",
    method: "POST",
  });

export const updateDayCloseRecord = (id, record) =>
  request(`/api/day-close-records/${id}`, {
    body: record,
    label: "Update day close record",
    method: "PUT",
  });

export const deleteDayCloseRecord = (id) =>
  request(`/api/day-close-records/${id}`, {
    label: "Delete day close record",
    method: "DELETE",
  });

export const createPayrollRecord = (record) =>
  request("/api/payroll-records", {
    body: record,
    label: "Create payroll record",
    method: "POST",
  });

export const updatePayrollRecord = (id, record) =>
  request(`/api/payroll-records/${id}`, {
    body: record,
    label: "Update payroll record",
    method: "PUT",
  });

export const deletePayrollRecord = (id) =>
  request(`/api/payroll-records/${id}`, {
    label: "Delete payroll record",
    method: "DELETE",
  });
