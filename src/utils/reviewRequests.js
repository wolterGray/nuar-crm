import {differenceInMinutes} from "date-fns";
import {isCalendarVisitCompleted} from "./calendarVisitStatus.js";
import {resolveClientMessageName} from "./clientMessageName.js";
import {matchesClientRecord} from "./clientLinks.js";
import {
  getCalendarVisitDateTime,
  normalizePhoneForSms,
} from "./smsReminders.js";

export const REVIEW_REQUEST_TOLERANCE_MINUTES = 30;

export const defaultReviewRequestTemplate =
  "Dziekujemy za wizyte w {studio}, {name}! Bedziemy wdzieczni za opinie: {reviewUrl}";

export const buildReviewRequestKey = (entry) =>
  `review:${entry?.id}:${entry?.date}:${entry?.time}`;

export const getCalendarVisitEndDateTime = (entry) => {
  const start = getCalendarVisitDateTime(entry);

  if (!start) {
    return null;
  }

  const end = new Date(start.getTime());
  end.setMinutes(
    end.getMinutes() + Math.max(15, Number(entry?.duration) || 60),
  );

  return Number.isNaN(end.getTime()) ? null : end;
};

export const resolveReviewUrls = (appSettings = {}) => {
  const googleUrl = String(appSettings.reviewGoogleUrl ?? "").trim();
  const booksyUrl = String(appSettings.reviewBooksyUrl ?? "").trim();
  const reviewUrl =
    String(appSettings.reviewPrimaryUrl ?? "").trim() ||
    googleUrl ||
    booksyUrl;

  return {
    booksyUrl,
    googleUrl,
    reviewUrl,
  };
};

export const personalizeReviewTemplate = (
  template,
  {
    booksyUrl = "",
    clientName,
    googleUrl = "",
    master,
    reviewUrl = "",
    service,
    studio,
  },
) =>
  String(template ?? "")
    .replaceAll("{name}", clientName || "kliencie")
    .replaceAll("{service}", service || "wizyta")
    .replaceAll("{master}", master || "zespol NUAR")
    .replaceAll("{studio}", studio || "NUAR")
    .replaceAll("{reviewUrl}", reviewUrl || googleUrl || booksyUrl || "")
    .replaceAll("{googleUrl}", googleUrl || "")
    .replaceAll("{booksyUrl}", booksyUrl || "")
    .trim();

export const wasReviewRequestSent = (reviewRequestLog, entry) => {
  const key = buildReviewRequestKey(entry);

  return (reviewRequestLog ?? []).some(
    (item) =>
      item.key === key ||
      (item.calendarEntryId === entry?.id &&
        item.visitDate === entry?.date &&
        item.visitTime === entry?.time &&
        item.status === "sent"),
  );
};

export const isReviewRequestDue = (entry, appSettings = {}, now = new Date()) => {
  if (!appSettings.reviewRequestsEnabled) {
    return false;
  }

  if (entry?.kind !== "visit") {
    return false;
  }

  if (!isCalendarVisitCompleted(entry, now)) {
    return false;
  }

  const visitEnd = getCalendarVisitEndDateTime(entry);

  if (!visitEnd) {
    return false;
  }

  const delayHours = Math.max(
    1,
    Number(appSettings.reviewRequestDelayHours) || 2,
  );
  const minutesSinceEnd = differenceInMinutes(now, visitEnd);

  if (minutesSinceEnd < 0) {
    return false;
  }

  const targetMinutes = delayHours * 60;

  return (
    Math.abs(minutesSinceEnd - targetMinutes) <=
    REVIEW_REQUEST_TOLERANCE_MINUTES
  );
};

export const resolveClientPhone = (entry, clients = []) => {
  const linkedClient = clients.find(
    (client) =>
      matchesClientRecord(entry, clients, client) ||
      (entry?.clientId && String(client.id) === String(entry.clientId)),
  );

  return normalizePhoneForSms(linkedClient?.phone ?? entry?.phone);
};

export const resolveClientTelegram = (entry, clients = []) => {
  const linkedClient = clients.find(
    (client) =>
      matchesClientRecord(entry, clients, client) ||
      (entry?.clientId && String(client.id) === String(entry.clientId)),
  );

  return String(linkedClient?.telegram ?? entry?.telegram ?? "").trim();
};

export const buildTelegramReviewLink = (telegram, message) => {
  const handle = String(telegram ?? "")
    .trim()
    .replace(/^https:\/\/t\.me\//, "")
    .replace(/^@/, "");

  if (!handle) {
    return "";
  }

  const encodedMessage = encodeURIComponent(String(message ?? "").trim());

  return encodedMessage
    ? `https://t.me/${handle}?text=${encodedMessage}`
    : `https://t.me/${handle}`;
};

export const buildDueReviewRequests = ({
  appSettings = {},
  calendarEntries = [],
  clientProfiles = [],
  now = new Date(),
  reviewRequestLog = [],
}) => {
  if (!appSettings.reviewRequestsEnabled) {
    return [];
  }

  const urls = resolveReviewUrls(appSettings);
  const studioName = appSettings.studioName || "NUAR";

  if (!urls.reviewUrl && !urls.googleUrl && !urls.booksyUrl) {
    return calendarEntries
      .filter(
        (entry) =>
          entry?.kind === "visit" && isReviewRequestDue(entry, appSettings, now),
      )
      .map((entry) => ({
        calendarEntryId: entry.id,
        client: entry.client,
        date: entry.date,
        error: "no_review_url",
        key: buildReviewRequestKey(entry),
        message: "",
        phone: "",
        status: "skipped",
        telegram: resolveClientTelegram(entry, clientProfiles),
        time: entry.time,
      }));
  }

  return calendarEntries
    .filter((entry) => entry?.kind === "visit")
    .filter((entry) => !wasReviewRequestSent(reviewRequestLog, entry))
    .filter((entry) => isReviewRequestDue(entry, appSettings, now))
    .map((entry) => {
      const phone = resolveClientPhone(entry, clientProfiles);
      const telegram = resolveClientTelegram(entry, clientProfiles);
      const message = personalizeReviewTemplate(
        appSettings.reviewRequestTemplate || defaultReviewRequestTemplate,
        {
          booksyUrl: urls.booksyUrl,
          clientName: resolveClientMessageName(clientProfiles, entry),
          googleUrl: urls.googleUrl,
          master: entry.master,
          reviewUrl: urls.reviewUrl,
          service: entry.service,
          studio: studioName,
        },
      );

      if (!phone) {
        return {
          calendarEntryId: entry.id,
          client: entry.client,
          date: entry.date,
          error: telegram ? "telegram_manual" : "no_phone",
          key: buildReviewRequestKey(entry),
          message,
          phone: "",
          status: "skipped",
          telegram,
          telegramLink: buildTelegramReviewLink(telegram, message),
          time: entry.time,
        };
      }

      return {
        calendarEntryId: entry.id,
        client: entry.client,
        date: entry.date,
        key: buildReviewRequestKey(entry),
        message,
        phone,
        status: "pending",
        telegram,
        telegramLink: buildTelegramReviewLink(telegram, message),
        time: entry.time,
      };
    })
    .sort((left, right) => String(left.time).localeCompare(String(right.time)));
};
