import {isCalendarVisitCompleted} from "./calendarVisitStatus.js";
import {matchesClientRecord, normalizeClientName} from "./clientLinks.js";
import {getLatestDisplayDate, toDisplayDate} from "./formatters.jsx";

export const normalizeSearchPhone = (value) =>
  String(value ?? "").replace(/\D/g, "");

export const normalizeTelegramHandle = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https:\/\/t\.me\//, "")
    .replace(/^@/, "");

export const buildClientSearchIndex = ({
  calendarEntries = [],
  clientProfiles = [],
  visits = [],
}) =>
  clientProfiles.map((client) => {
    const clientVisits = visits.filter(
      (visit) =>
        matchesClientRecord(visit, clientProfiles, client) &&
        visit.recordType !== "operation",
    );
    const completedCalendarDates = calendarEntries
      .filter(
        (entry) =>
          entry.kind === "visit" &&
          matchesClientRecord(entry, clientProfiles, client) &&
          isCalendarVisitCompleted(entry),
      )
      .map((entry) => toDisplayDate(entry.date));
    const lastVisit =
      getLatestDisplayDate([
        ...clientVisits.map((visit) => visit.date),
        ...completedCalendarDates,
      ]) || "—";

    return {
      ...client,
      lastVisit,
    };
  });

export const getClientMatchScore = (client, query) => {
  const normalizedQuery = String(query ?? "").trim().toLowerCase();

  if (!normalizedQuery) {
    return 0;
  }

  const normalizedName = normalizeClientName(client.name);
  const queryName = normalizeClientName(normalizedQuery);
  let score = 0;

  if (normalizedName === queryName) {
    score += 120;
  } else if (normalizedName.startsWith(queryName)) {
    score += 90;
  } else if (normalizedName.includes(queryName)) {
    score += 60;
  }

  const queryDigits = normalizeSearchPhone(normalizedQuery);

  if (queryDigits.length >= 3) {
    const phoneDigits = normalizeSearchPhone(client.phone);

    if (phoneDigits === queryDigits) {
      score += 110;
    } else if (phoneDigits.endsWith(queryDigits)) {
      score += 80;
    } else if (phoneDigits.includes(queryDigits)) {
      score += 50;
    }
  }

  const email = String(client.email ?? "").trim().toLowerCase();

  if (email && email === normalizedQuery) {
    score += 100;
  } else if (email && email.includes(normalizedQuery)) {
    score += 45;
  }

  const telegram = normalizeTelegramHandle(client.telegram);
  const queryTelegram = normalizeTelegramHandle(normalizedQuery);

  if (telegram && queryTelegram) {
    if (telegram === queryTelegram) {
      score += 95;
    } else if (telegram.includes(queryTelegram)) {
      score += 40;
    }
  }

  return score;
};

export const clientMatchesQuery = (client, query) =>
  getClientMatchScore(client, query) > 0;

export const searchClients = ({
  clients = [],
  limit = 8,
  query = "",
}) => {
  const trimmedQuery = String(query ?? "").trim();

  if (!trimmedQuery) {
    return [];
  }

  return clients
    .filter((client) => clientMatchesQuery(client, trimmedQuery))
    .sort(
      (left, right) =>
        getClientMatchScore(right, trimmedQuery) -
          getClientMatchScore(left, trimmedQuery) ||
        String(left.name).localeCompare(String(right.name), "ru"),
    )
    .slice(0, limit);
};
