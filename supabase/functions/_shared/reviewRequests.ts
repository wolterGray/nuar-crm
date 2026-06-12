import {differenceInMinutes, isValid, parse, parseISO} from "https://esm.sh/date-fns@4.1.0";

const APP_DATE_FORMAT = "dd.MM.yyyy";
const REVIEW_REQUEST_TOLERANCE_MINUTES = 30;

type CalendarEntry = {
  id?: string;
  kind?: string;
  status?: string;
  client?: string;
  clientId?: string | number;
  date?: string;
  time?: string;
  duration?: number;
  service?: string;
  master?: string;
  phone?: string;
  telegram?: string;
};

type ClientProfile = {
  id?: string | number;
  name?: string;
  phone?: string;
  telegram?: string;
};

type ReviewLogItem = {
  key?: string;
  calendarEntryId?: string;
  status?: string;
  visitDate?: string;
  visitTime?: string;
};

const parseAppDate = (value: unknown) => {
  const date = String(value ?? "").trim();

  if (!date) {
    return null;
  }

  const parsedDate = date.includes("-")
    ? parseISO(date)
    : parse(date, APP_DATE_FORMAT, new Date());

  return isValid(parsedDate) ? parsedDate : null;
};

const getMinutesFromTime = (time: unknown) => {
  const [hours, minutes] = String(time ?? "00:00").split(":").map(Number);

  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
};

const getTodayFromNow = (now: Date) => {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const isCalendarVisitCompleted = (entry: CalendarEntry, now = new Date()) => {
  if (
    entry.kind !== "visit" ||
    ["cancelled", "no_show"].includes(String(entry.status ?? ""))
  ) {
    return false;
  }

  if (entry.status === "completed") {
    return true;
  }

  const today = getTodayFromNow(now);
  const entryDate = String(entry.date ?? today);

  if (entryDate < today) {
    return true;
  }

  if (entryDate > today) {
    return false;
  }

  const endMinutes =
    getMinutesFromTime(entry.time) + (Number(entry.duration) || 0);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return endMinutes <= nowMinutes;
};

const getCalendarVisitDateTime = (entry: CalendarEntry) => {
  const date = parseAppDate(entry?.date);

  if (!date) {
    return null;
  }

  const [hours, minutes] = String(entry?.time ?? "00:00").split(":").map(Number);
  const visitDate = new Date(date);
  visitDate.setHours(hours || 0, minutes || 0, 0, 0);

  return Number.isNaN(visitDate.getTime()) ? null : visitDate;
};

export const getCalendarVisitEndDateTime = (entry: CalendarEntry) => {
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

export const normalizePhoneForSms = (phone: unknown) => {
  const digits = String(phone ?? "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("48") && digits.length === 11) {
    return digits;
  }

  if (digits.length === 9) {
    return `48${digits}`;
  }

  return digits.length >= 9 ? digits : "";
};

const normalizeClientName = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е");

export const buildReviewRequestKey = (entry: CalendarEntry) =>
  `review:${entry?.id}:${entry?.date}:${entry?.time}`;

export const resolveReviewUrls = (appSettings: Record<string, unknown> = {}) => {
  const googleUrl = String(appSettings.reviewGoogleUrl ?? "").trim();
  const booksyUrl = String(appSettings.reviewBooksyUrl ?? "").trim();
  const reviewUrl =
    String(appSettings.reviewPrimaryUrl ?? "").trim() ||
    googleUrl ||
    booksyUrl;

  return {booksyUrl, googleUrl, reviewUrl};
};

export const personalizeReviewTemplate = (
  template: string,
  {
    booksyUrl = "",
    clientName,
    googleUrl = "",
    master,
    reviewUrl = "",
    service,
    studio,
  }: {
    booksyUrl?: string;
    clientName?: string;
    googleUrl?: string;
    master?: string;
    reviewUrl?: string;
    service?: string;
    studio?: string;
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

export const defaultReviewRequestTemplate =
  "Dziekujemy za wizyte w {studio}, {name}! Bedziemy wdzieczni za opinie: {reviewUrl}";

const wasReviewRequestSent = (
  reviewRequestLog: ReviewLogItem[],
  entry: CalendarEntry,
) => {
  const key = buildReviewRequestKey(entry);

  return reviewRequestLog.some(
    (item) =>
      item.key === key ||
      (item.calendarEntryId === entry?.id &&
        item.visitDate === entry?.date &&
        item.visitTime === entry?.time &&
        item.status === "sent"),
  );
};

const isReviewRequestDue = (
  entry: CalendarEntry,
  appSettings: Record<string, unknown>,
  now = new Date(),
) => {
  if (!appSettings.reviewRequestsEnabled) {
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
    Math.abs(minutesSinceEnd - targetMinutes) <= REVIEW_REQUEST_TOLERANCE_MINUTES
  );
};

const resolveClientPhone = (entry: CalendarEntry, clients: ClientProfile[] = []) => {
  const linkedClient =
    clients.find(
      (client) =>
        entry?.clientId &&
        String(client.id) === String(entry.clientId),
    ) ??
    clients.find(
      (client) =>
        normalizeClientName(client.name) === normalizeClientName(entry?.client),
    );

  return normalizePhoneForSms(linkedClient?.phone ?? entry?.phone);
};

export const buildDueReviewRequests = ({
  appSettings,
  calendarEntries = [],
  clientProfiles = [],
  now = new Date(),
  reviewRequestLog = [],
}: {
  appSettings: Record<string, unknown>;
  calendarEntries?: CalendarEntry[];
  clientProfiles?: ClientProfile[];
  now?: Date;
  reviewRequestLog?: ReviewLogItem[];
}) => {
  if (!appSettings.reviewRequestsEnabled) {
    return [];
  }

  const urls = resolveReviewUrls(appSettings);
  const studioName = String(appSettings.studioName ?? "NUAR");

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
        time: entry.time,
      }));
  }

  return calendarEntries
    .filter((entry) => entry?.kind === "visit")
    .filter((entry) => !wasReviewRequestSent(reviewRequestLog, entry))
    .filter((entry) => isReviewRequestDue(entry, appSettings, now))
    .map((entry) => {
      const phone = resolveClientPhone(entry, clientProfiles);
      const message = personalizeReviewTemplate(
        String(appSettings.reviewRequestTemplate ?? defaultReviewRequestTemplate),
        {
          booksyUrl: urls.booksyUrl,
          clientName: entry.client,
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
          error: "no_phone",
          key: buildReviewRequestKey(entry),
          message,
          phone: "",
          status: "skipped",
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
        time: entry.time,
      };
    })
    .sort((left, right) => String(left.time).localeCompare(String(right.time)));
};
