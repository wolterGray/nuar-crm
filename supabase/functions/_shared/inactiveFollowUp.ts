import {
  differenceInCalendarDays,
  isValid,
  parse,
  parseISO,
  startOfDay,
} from "https://esm.sh/date-fns@4.1.0";
import {normalizePhoneForSms, personalizeSmsTemplate} from "./visitReminders.ts";
import {getClientMessageName} from "./clientMessageName.ts";

const APP_DATE_FORMAT = "dd.MM.yyyy";
const INACTIVE_FOLLOW_UP_KINDS = ["14d", "30d", "60d"] as const;
const INACTIVE_FOLLOW_UP_TIER_DAYS: Record<string, number> = {
  "14d": 14,
  "30d": 30,
  "60d": 60,
};

type CalendarEntry = {
  id?: string;
  kind?: string;
  status?: string;
  client?: string;
  clientId?: string | number;
  date?: string;
  time?: string;
  duration?: number;
};

type ClientProfile = {
  id?: string | number;
  name?: string;
  phone?: string;
  telegram?: string;
};

type Visit = {
  client?: string;
  date?: string;
  recordType?: string;
};

type FollowUpLogItem = {
  key?: string;
  clientId?: string | number;
  kind?: string;
  status?: string;
};

export const defaultInactiveFollowUpTemplates = {
  "14d":
    "Czesc {name}! Tesknilismy za Toba w {studio}. Minely juz {days} dni od ostatniej wizyty. Chetnie pomozemy zarezerwowac termin.",
  "30d":
    "Czesc {name}! W {studio} pamietamy o Tobie. Minelo juz {days} dni bez wizyty - odezwij sie, ustalimy dogodny termin.",
  "60d":
    "Czesc {name}! Czekamy na Ciebie w {studio}. Minelo {days} dni od ostatniej wizyty - wroc do regularnych masazy u nas.",
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

const parseDisplayDate = (value: unknown) => parseAppDate(value);

const toDisplayDate = (value: unknown) => {
  const parsed = parseAppDate(value);

  if (!parsed) {
    return String(value ?? "");
  }

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();

  return `${day}.${month}.${year}`;
};

const getDaysSinceDisplayDate = (date: unknown, today = new Date()) => {
  const parsedDate = parseDisplayDate(date);

  if (!parsedDate) {
    return null;
  }

  return Math.max(0, differenceInCalendarDays(startOfDay(today), parsedDate));
};

const getLatestDisplayDate = (dates: string[] = []) =>
  dates
    .filter(Boolean)
    .sort((left, right) => {
      const leftDate = parseDisplayDate(left);
      const rightDate = parseDisplayDate(right);

      if (!leftDate || !rightDate) {
        return 0;
      }

      return rightDate.getTime() - leftDate.getTime();
    })[0] ?? "";

const normalizeClientName = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е");

const matchesClientRecord = (
  record: {client?: string; clientId?: string | number},
  clients: ClientProfile[],
  client: ClientProfile,
) =>
  (record.clientId && String(record.clientId) === String(client.id)) ||
  normalizeClientName(record.client) === normalizeClientName(client.name);

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

const isCalendarVisitPlanned = (entry: CalendarEntry, now = new Date()) => {
  if (["completed", "cancelled", "no_show"].includes(String(entry.status ?? ""))) {
    return false;
  }

  const today = getTodayFromNow(now);
  const entryDate = String(entry.date ?? today);

  if (entryDate < today) {
    return false;
  }

  if (entryDate > today) {
    return true;
  }

  const endMinutes =
    getMinutesFromTime(entry.time) + (Number(entry.duration) || 0);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return endMinutes > nowMinutes;
};

const buildInactiveFollowUpKey = (clientId: unknown, kind: string) =>
  `inactive:${clientId}:${kind}`;

const wasInactiveFollowUpSent = (
  inactiveFollowUpLog: FollowUpLogItem[],
  clientId: unknown,
  kind: string,
) => {
  const key = buildInactiveFollowUpKey(clientId, kind);

  return inactiveFollowUpLog.some(
    (item) =>
      item.key === key ||
      (String(item.clientId) === String(clientId) &&
        item.kind === kind &&
        item.status === "sent"),
  );
};

const isInactiveFollowUpTierEnabled = (
  appSettings: Record<string, unknown>,
  kind: string,
) => {
  if (!appSettings.inactiveFollowUpEnabled) {
    return false;
  }

  switch (kind) {
    case "14d":
      return appSettings.inactiveFollowUp14Enabled !== false;
    case "30d":
      return appSettings.inactiveFollowUp30Enabled !== false;
    case "60d":
      return appSettings.inactiveFollowUp60Enabled !== false;
    default:
      return false;
  }
};

const resolveInactiveFollowUpTemplate = (
  appSettings: Record<string, unknown>,
  kind: string,
) => {
  switch (kind) {
    case "14d":
      return String(
        appSettings.inactiveFollowUp14Template ??
          defaultInactiveFollowUpTemplates["14d"],
      );
    case "30d":
      return String(
        appSettings.inactiveFollowUp30Template ??
          defaultInactiveFollowUpTemplates["30d"],
      );
    case "60d":
      return String(
        appSettings.inactiveFollowUp60Template ??
          defaultInactiveFollowUpTemplates["60d"],
      );
    default:
      return "";
  }
};

const resolveNextInactiveFollowUpKind = ({
  appSettings,
  client,
  inactiveFollowUpLog = [],
}: {
  appSettings: Record<string, unknown>;
  client: ClientProfile & {daysAbsent?: number | null};
  inactiveFollowUpLog?: FollowUpLogItem[];
}) => {
  const daysAbsent = Number(client.daysAbsent);

  if (!Number.isFinite(daysAbsent)) {
    return null;
  }

  for (const kind of INACTIVE_FOLLOW_UP_KINDS) {
    const tierDays = INACTIVE_FOLLOW_UP_TIER_DAYS[kind];

    if (
      isInactiveFollowUpTierEnabled(appSettings, kind) &&
      daysAbsent >= tierDays &&
      !wasInactiveFollowUpSent(inactiveFollowUpLog, client.id, kind)
    ) {
      return kind;
    }
  }

  return null;
};

const buildInactiveClients = ({
  calendarEntries = [],
  clientProfiles = [],
  visits = [],
  now = new Date(),
}: {
  calendarEntries?: CalendarEntry[];
  clientProfiles?: ClientProfile[];
  visits?: Visit[];
  now?: Date;
}) =>
  clientProfiles
    .map((client) => {
      const completedCalendarDates = calendarEntries
        .filter(
          (entry) =>
            matchesClientRecord(entry, clientProfiles, client) &&
            isCalendarVisitCompleted(entry, now),
        )
        .map((entry) => toDisplayDate(entry.date));
      const lastVisit =
        getLatestDisplayDate([
          ...visits
            .filter(
              (visit) =>
                matchesClientRecord(visit, clientProfiles, client) &&
                visit.recordType !== "operation",
            )
            .map((visit) => String(visit.date ?? "")),
          ...completedCalendarDates,
        ]) || "";

      return {
        ...client,
        lastVisit,
        daysAbsent: getDaysSinceDisplayDate(lastVisit, now),
      };
    })
    .filter((client) => client.daysAbsent !== null && client.daysAbsent >= 14)
    .sort(
      (firstClient, secondClient) =>
        (secondClient.daysAbsent ?? Number.MAX_SAFE_INTEGER) -
        (firstClient.daysAbsent ?? Number.MAX_SAFE_INTEGER),
    );

const clientHasUpcomingVisit = ({
  calendarEntries = [],
  client,
  clientProfiles = [],
  now = new Date(),
}: {
  calendarEntries?: CalendarEntry[];
  client: ClientProfile;
  clientProfiles?: ClientProfile[];
  now?: Date;
}) =>
  calendarEntries.some(
    (entry) =>
      entry?.kind === "visit" &&
      matchesClientRecord(entry, clientProfiles, client) &&
      isCalendarVisitPlanned(entry, now),
  );

export const buildDueInactiveFollowUps = ({
  appSettings,
  calendarEntries = [],
  clientProfiles = [],
  inactiveFollowUpLog = [],
  now = new Date(),
  visits = [],
}: {
  appSettings: Record<string, unknown>;
  calendarEntries?: CalendarEntry[];
  clientProfiles?: ClientProfile[];
  inactiveFollowUpLog?: FollowUpLogItem[];
  now?: Date;
  visits?: Visit[];
}) => {
  if (!appSettings?.inactiveFollowUpEnabled) {
    return [];
  }

  const studioName = String(appSettings.studioName ?? "NUAR");
  const inactiveClients = buildInactiveClients({
    calendarEntries,
    clientProfiles,
    now,
    visits,
  });

  return inactiveClients
    .map((client) => {
      const kind = resolveNextInactiveFollowUpKind({
        appSettings,
        client,
        inactiveFollowUpLog,
      });

      if (!kind) {
        return null;
      }

      const phone = normalizePhoneForSms(client.phone);
      const template = resolveInactiveFollowUpTemplate(appSettings, kind);
      const message = personalizeSmsTemplate(template, {
        clientName: getClientMessageName(client),
        date: client.lastVisit,
        studio: studioName,
      }).replaceAll("{days}", String(client.daysAbsent ?? ""));
      const telegram = String(client.telegram ?? "").trim();

      if (
        clientHasUpcomingVisit({
          calendarEntries,
          client,
          clientProfiles,
          now,
        })
      ) {
        return {
          client: client.name,
          clientId: client.id,
          daysAbsent: client.daysAbsent,
          error: "upcoming_visit",
          key: buildInactiveFollowUpKey(client.id, kind),
          kind,
          lastVisit: client.lastVisit,
          message,
          phone: "",
          status: "skipped",
          telegram,
        };
      }

      if (!phone) {
        return {
          client: client.name,
          clientId: client.id,
          daysAbsent: client.daysAbsent,
          error: telegram ? "telegram_manual" : "no_phone",
          key: buildInactiveFollowUpKey(client.id, kind),
          kind,
          lastVisit: client.lastVisit,
          message,
          phone: "",
          status: "skipped",
          telegram,
        };
      }

      return {
        client: client.name,
        clientId: client.id,
        daysAbsent: client.daysAbsent,
        key: buildInactiveFollowUpKey(client.id, kind),
        kind,
        lastVisit: client.lastVisit,
        message,
        phone,
        status: "pending",
        telegram,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftKind = String(left?.kind ?? "");
      const rightKind = String(right?.kind ?? "");
      const kindDiff =
        INACTIVE_FOLLOW_UP_KINDS.indexOf(leftKind) -
        INACTIVE_FOLLOW_UP_KINDS.indexOf(rightKind);

      if (kindDiff !== 0) {
        return kindDiff;
      }

      return (
        Number(right?.daysAbsent ?? 0) - Number(left?.daysAbsent ?? 0)
      );
    });
};
