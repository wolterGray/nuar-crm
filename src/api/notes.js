import {getAuthToken, notifyAuthTokenRejected} from "../hooks/useAuth.js";
import {API_URL} from "./config.js";

const request = async (path, options = {}) => {
  const token = await getAuthToken?.();
  const response = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? {"Content-Type": "application/json"} : {}),
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
      ...(options.headers ?? {}),
    },
  });
  if (response.status === 401) notifyAuthTokenRejected();
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = new Error(payload?.error || `Notes API request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response;
};

export const patchNote = async (id, updates) => {
  const response = await request(`/notes/${id}`, {method: "PATCH", body: JSON.stringify(updates)});
  const payload = await response.json();
  return payload?.data ?? payload;
};

export const fetchNoteRevisions = async (id) => {
  const response = await request(`/notes/${id}/revisions`);
  const payload = await response.json();
  return payload?.data ?? [];
};

export const restoreNoteRevision = async (id, revisionId) => {
  const response = await request(`/notes/${id}/revisions/${revisionId}/restore`, {method: "POST"});
  const payload = await response.json();
  return payload?.data ?? payload;
};

export const fetchNoteAttachments = async (id) => {
  const response = await request(`/notes/${id}/attachments`);
  const payload = await response.json();
  return payload?.data ?? [];
};

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(reader.error || new Error("Не удалось прочитать файл"));
  reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] || "");
  reader.readAsDataURL(file);
});

export const uploadNoteAttachment = async (noteId, file) => {
  const dataBase64 = await fileToBase64(file);
  const response = await request(`/notes/${noteId}/attachments`, {
    method: "POST",
    body: JSON.stringify({
      dataBase64,
      fileName: file.name || `screenshot-${Date.now()}.png`,
      mimeType: file.type,
    }),
  });
  const payload = await response.json();
  return payload?.data ?? payload;
};

export const fetchNoteAttachmentBlob = async (attachmentId) => {
  const response = await request(`/notes/attachments/${attachmentId}/content`);
  return response.blob();
};

export const deleteNoteAttachment = async (attachmentId) => {
  const response = await request(`/notes/attachments/${attachmentId}`, {method: "DELETE"});
  const payload = await response.json();
  return payload?.data ?? payload;
};

export const fetchNotesTrash = async () => {
  const response = await request("/notes-trash");
  const payload = await response.json();
  return payload?.data ?? [];
};

export const restoreDeletedNote = async (id) => {
  const response = await request(`/notes/${id}/restore`, {method: "POST"});
  const payload = await response.json();
  return payload?.data ?? payload;
};

export const deleteNotePermanently = async (id) => {
  const response = await request(`/notes/${id}/permanent`, {method: "DELETE"});
  const payload = await response.json();
  return payload?.data ?? payload;
};
