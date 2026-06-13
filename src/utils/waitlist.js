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
  (waitlistEntries ?? []).filter((entry) => entry.status === "active");
