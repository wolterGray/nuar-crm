export const BOOKSY_SYNC_STATUSES = {
  NOT_SENT: "not_sent",
  PENDING: "pending",
  SYNCED: "synced",
  FAILED: "failed",
  RETRYING: "retrying",
};

export const BOOKSY_SYNC_STATUS_LABELS = {
  [BOOKSY_SYNC_STATUSES.NOT_SENT]: "Не отправлено",
  [BOOKSY_SYNC_STATUSES.PENDING]: "В очереди Booksy",
  [BOOKSY_SYNC_STATUSES.SYNCED]: "Синхронизировано",
  [BOOKSY_SYNC_STATUSES.FAILED]: "Ошибка Booksy",
  [BOOKSY_SYNC_STATUSES.RETRYING]: "Повторная попытка",
};

export const getBooksySyncStatus = (entry) =>
  entry?.booksySyncStatus || BOOKSY_SYNC_STATUSES.NOT_SENT;

export const getBooksySyncStatusLabel = (entry) =>
  BOOKSY_SYNC_STATUS_LABELS[getBooksySyncStatus(entry)] ||
  BOOKSY_SYNC_STATUS_LABELS[BOOKSY_SYNC_STATUSES.NOT_SENT];

export const canEnqueueBooksySync = (entry) => {
  if (!entry || entry.kind !== "visit") {
    return false;
  }

  const status = getBooksySyncStatus(entry);
  return ![BOOKSY_SYNC_STATUSES.PENDING, BOOKSY_SYNC_STATUSES.SYNCED].includes(status);
};

export const canRetryBooksySync = (entry) =>
  Boolean(entry?.kind === "visit" && getBooksySyncStatus(entry) === BOOKSY_SYNC_STATUSES.FAILED);

export const applyBooksySyncPatchToEntry = (entry, patch = {}) => ({
  ...entry,
  ...patch,
});

export const patchCalendarEntryInList = (entries, entryId, patch) =>
  entries.map((entry) =>
    String(entry.id) === String(entryId) ? applyBooksySyncPatchToEntry(entry, patch) : entry,
  );
