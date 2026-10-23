import {normalizeClientName} from "./clientLinks.js";
import {toDisplayDate} from "./formatters.jsx";

export const WAITLIST_STATUSES = ["active", "offered", "closed"];

export const defaultWaitlistOfferTemplate =
  "Witaj {name}! Zwolnil sie termin {date} o {time} u {master} ({service}). Czy jestes zainteresowana?";

export const getWaitlistMinutes = (time) => {
  const [hours, minutes] = String(time ?? "00:00").split(":").map(Number);

  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
};

export const normalizeWaitlistService = (value) =>
  normalizeClientName(String(value ?? "").trim());

export const buildWaitlistEntry = ({
  client,
  clientProfiles = [],
  createId,
  note = "",
  preferredDate = "",
  preferredMaster = "",
  preferredService = "",
  preferredTimeFrom = "",
  preferredTimeTo = "",
}) => {
  const linkedClient =
    clientProfiles.find((item) => String(item.id) === String(client?.id)) ??
    clientProfiles.find(
      (item) => normalizeClientName(item.name) === normalizeClientName(client?.name),
    ) ??
    client;

  if (!linkedClient?.id) {
    return null;
  }

  return {
    clientId: linkedClient.id,
    clientName: linkedClient.name || "Клиент",
    createdAt: new Date().toISOString(),
    id: createId(),
    note: String(note ?? "").trim(),
    preferredDate: String(preferredDate ?? "").trim(),
    preferredMaster: String(preferredMaster ?? "").trim(),
    preferredService: String(preferredService ?? "").trim(),
    preferredTimeFrom: String(preferredTimeFrom ?? "").trim(),
    preferredTimeTo: String(preferredTimeTo ?? "").trim(),
    status: "active",
  };
};

export const matchesWaitlistPreferences = (entry, slot = {}) => {
  if (entry?.status !== "active") {
    return false;
  }

  const slotDate = String(slot.date ?? "").trim();
  const preferredDate = String(entry.preferredDate ?? "").trim();

  if (preferredDate && preferredDate !== slotDate) {
    return false;
  }

  const preferredMaster = String(entry.preferredMaster ?? "").trim();
  const slotMaster = String(slot.master ?? "").trim();

  if (preferredMaster && preferredMaster !== slotMaster) {
    return false;
  }

  const preferredService = normalizeWaitlistService(entry.preferredService);
  const slotService = normalizeWaitlistService(slot.service);

  if (preferredService && preferredService !== slotService) {
    return false;
  }

  const preferredTimeFrom = String(entry.preferredTimeFrom ?? "").trim();
  const preferredTimeTo = String(entry.preferredTimeTo ?? "").trim();

  if (!preferredTimeFrom && !preferredTimeTo) {
    return true;
  }

  const slotStart = getWaitlistMinutes(slot.time);
  const from = preferredTimeFrom ? getWaitlistMinutes(preferredTimeFrom) : 0;
  const to = preferredTimeTo ? getWaitlistMinutes(preferredTimeTo) : 24 * 60;

  return slotStart >= from && slotStart <= to;
};

export const findWaitlistMatches = ({
  excludeClientId = "",
  slot = {},
  waitlistEntries = [],
}) =>
  (waitlistEntries ?? [])
    .filter(
      (entry) =>
        entry?.status === "active" &&
        String(entry.clientId) !== String(excludeClientId ?? "") &&
        matchesWaitlistPreferences(entry, slot),
    )
    .sort(
      (left, right) =>
        new Date(left.createdAt || 0).getTime() -
        new Date(right.createdAt || 0).getTime(),
    );

export const buildFreedCalendarSlot = (entry = {}) => ({
  date: entry.date,
  duration: Number(entry.duration) || 60,
  master: entry.master || "",
  service: entry.service || "",
  time: entry.time || "",
});

export const formatWaitlistSlotLabel = (slot = {}) => {
  const date = toDisplayDate(slot.date) || slot.date || "—";
  const time = slot.time || "—";
  const master = slot.master || "любой мастер";
  const service = slot.service || "любая услуга";

  return `${date} · ${time} · ${master} · ${service}`;
};

export const personalizeWaitlistOfferTemplate = (
  template,
  {clientName, master, service, slot = {}, studio = "NUAR"},
) =>
  String(template ?? defaultWaitlistOfferTemplate)
    .replaceAll("{name}", clientName || "kliencie")
    .replaceAll("{date}", toDisplayDate(slot.date) || slot.date || "")
    .replaceAll("{time}", slot.time || "")
    .replaceAll("{master}", master || slot.master || "zespol NUAR")
    .replaceAll("{service}", service || slot.service || "wizyta")
    .replaceAll("{studio}", studio)
    .trim();

export const isWaitlistEntryDeleted = (entry) => {
  if (!entry) return false;
  const status = String(entry.status ?? "").trim().toLowerCase();
  return status === "deleted" || Boolean(entry.payload?.deletedAt);
};

export const isWaitlistEntryCompleted = (entry) => {
  if (!entry || isWaitlistEntryDeleted(entry)) return false;
  const status = String(entry.status ?? "").trim().toLowerCase();
  return ["booked", "completed", "closed", "done"].includes(status);
};

export const isWaitlistEntryOffered = (entry) => {
  if (!entry || isWaitlistEntryDeleted(entry)) return false;
  const status = String(entry.status ?? "").trim().toLowerCase();
  return status === "offered";
};

export const isWaitlistEntryActive = (entry) => {
  if (!entry || isWaitlistEntryDeleted(entry) || isWaitlistEntryCompleted(entry)) return false;
  const status = String(entry.status ?? "").trim().toLowerCase();
  if (status === "offered") return false;
  return status === "active" || !status;
};

export const parseWaitlistEntryDetails = (entry = {}, clientProfiles = []) => {
  const note = String(entry.note ?? "").trim();
  const payload = (entry.payload && typeof entry.payload === "object" ? entry.payload : {}) || {};

  // Extract phone
  const phoneMatch = note.match(/(?:Телефон|Phone|Tel):\s*([^\n\r]+)/i);
  let clientPhone = payload.clientPhone || (phoneMatch ? phoneMatch[1].trim() : "");

  // Extract email
  const emailMatch = note.match(/(?:Email|E-mail|Почта):\s*([^\n\r]+)/i);
  let clientEmail = payload.clientEmail || (emailMatch ? emailMatch[1].trim() : "");

  // Extract request ID
  const requestMatch = note.match(/(?:Заявка сайта|Site booking):\s*([a-f0-9-]+)/i);
  const siteBookingRequestId = payload.siteBookingRequestId || (requestMatch ? requestMatch[1].trim() : null);

  // Extract human comment
  let clientComment = "";
  const commentMatch = note.match(/(?:Комментарий|Comment|Uwagi|Заметка):\s*([\s\S]+?)(?=\n(?:Заявка сайта|Телефон|Email|$))/i);
  if (commentMatch) {
    clientComment = commentMatch[1].trim();
  } else if (!phoneMatch && !emailMatch && !requestMatch) {
    clientComment = note;
  }

  // Linked client fallback
  const linkedClient = clientProfiles.find((item) =>
    String(item.id) === String(entry.clientId) ||
    normalizeClientName(item.name) === normalizeClientName(entry.clientName)
  );

  if (!clientPhone && linkedClient?.phone) {
    clientPhone = linkedClient.phone;
  }
  if (!clientEmail && linkedClient?.email) {
    clientEmail = linkedClient.email;
  }

  // Determine source
  const isSiteBooking = Boolean(
    payload.source === "site-booking" ||
    siteBookingRequestId ||
    /Заявка сайта:/i.test(note)
  );
  const source = isSiteBooking ? "site" : "manual";
  const sourceLabel = isSiteBooking ? "Запись с сайта" : "Лист ожидания";

  // Calculate duration
  let durationMinutes = Number(payload.durationMinutes) || 0;
  if (!durationMinutes && entry.preferredTimeFrom && entry.preferredTimeTo) {
    const diff = getWaitlistMinutes(entry.preferredTimeTo) - getWaitlistMinutes(entry.preferredTimeFrom);
    if (diff > 0 && diff <= 300) {
      durationMinutes = diff;
    }
  }
  if (!durationMinutes) {
    durationMinutes = 60;
  }
  const rawBookedPrice = payload.bookedPrice ?? payload.finalPrice;
  const bookedPrice = Number(rawBookedPrice);
  const hasBookedPrice = Number.isFinite(bookedPrice) && bookedPrice > 0;

  const isDeleted = isWaitlistEntryDeleted(entry);
  const isCompleted = isWaitlistEntryCompleted(entry);
  const isOffered = isWaitlistEntryOffered(entry);
  const isActive = isWaitlistEntryActive(entry);

  let statusBadge = { label: "Новая", variant: "info" };
  if (isDeleted) {
    statusBadge = { label: "Удалена", variant: "neutral" };
  } else if (isCompleted) {
    statusBadge = { label: "Записан", variant: "success" };
  } else if (isOffered) {
    statusBadge = { label: "Предложено", variant: "warning" };
  }

  return {
    bookedPrice: hasBookedPrice ? bookedPrice : null,
    clientComment,
    clientEmail,
    clientName: entry.clientName || linkedClient?.name || "Клиент",
    clientPhone,
    createdAt: entry.createdAt || null,
    durationMinutes,
    id: entry.id,
    isActive,
    isCompleted,
    isDeleted,
    isOffered,
    isSiteBooking,
    linkedClient,
    preferredDate: entry.preferredDate || "",
    preferredMaster: entry.preferredMaster || "",
    preferredService: entry.preferredService || "",
    preferredTimeFrom: entry.preferredTimeFrom || "",
    preferredTimeTo: entry.preferredTimeTo || "",
    rawEntry: entry,
    siteBookingRequestId,
    source,
    sourceLabel,
    status: entry.status || "active",
    statusBadge,
  };
};

export const formatWaitlistDisplayDate = (dateStr) => {
  if (!dateStr) return "Любая дата";
  try {
    const d = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(d.getTime())) return dateStr;
    const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(d);
    const dayMonth = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(d);
    return `${dayMonth} (${weekday})`;
  } catch {
    return dateStr;
  }
};

export const formatWaitlistDisplayTime = (timeFrom, timeTo) => {
  if (!timeFrom && !timeTo) return "Любое время";
  if (timeFrom && timeTo) return `${timeFrom} — ${timeTo}`;
  return timeFrom ? `с ${timeFrom}` : `до ${timeTo}`;
};

export const summarizeWaitlistEntry = (entry = {}) => {
  const parts = [];

  if (entry.preferredDate) {
    parts.push(toDisplayDate(entry.preferredDate) || entry.preferredDate);
  } else {
    parts.push("любая дата");
  }

  if (entry.preferredMaster) {
    parts.push(entry.preferredMaster);
  }

  if (entry.preferredService) {
    parts.push(entry.preferredService);
  }

  if (entry.preferredTimeFrom || entry.preferredTimeTo) {
    parts.push(
      `${entry.preferredTimeFrom || "…"}–${entry.preferredTimeTo || "…"}`,
    );
  }

  return parts.join(" · ");
};

export const getActiveWaitlistEntries = (waitlistEntries = []) =>
  (waitlistEntries ?? []).filter(isWaitlistEntryActive);

export const getDeletedWaitlistEntries = (waitlistEntries = []) =>
  (waitlistEntries ?? []).filter(isWaitlistEntryDeleted);

export const getOfferedWaitlistEntries = (waitlistEntries = []) =>
  (waitlistEntries ?? []).filter(isWaitlistEntryOffered);
