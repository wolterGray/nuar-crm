import {differenceInMinutes, isValid, parse, parseISO} from "https://esm.sh/date-fns@4.1.0";
import {resolveClientMessageName} from "./clientMessageName.ts";

const APP_DATE_FORMAT = "dd.MM.yyyy";
const SMS_REMINDER_KINDS = ["24h", "2h"] as const;
const SMS_REMINDER_WINDOWS = {
  "24h": {targetMinutes: 24 * 60, toleranceMinutes: 30},
  "2h": {targetMinutes: 2 * 60, toleranceMinutes: 15},
};

type ReminderKind = (typeof SMS_REMINDER_KINDS)[number];

type CalendarEntry = {
  id?: string;
  kind?: string;
  status?: string;
  client?: string;
  clientId?: string | number;
  date?: string;
  time?: string;
  service?: string;
  master?: string;
  phone?: string;
};

type ClientProfile = {
  id?: string | number;
  name?: string;
  phone?: string;
};

type ReminderLogItem = {
  key?: string;
  calendarEntryId?: string;
  kind?: string;
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

const buildSmsReminderKey = (entry: CalendarEntry, kind: ReminderKind) =>
  `${entry?.id}:${kind}:${entry?.date}:${entry?.time}`;

const wasSmsReminderSent = (
  smsReminderLog: ReminderLogItem[],
  entry: CalendarEntry,
  kind: ReminderKind,
) => {
  const key = buildSmsReminderKey(entry, kind);

  return smsReminderLog.some(
    (item) =>
      item.key === key ||
      (item.calendarEntryId === entry?.id &&
        item.kind === kind &&
        item.visitDate === entry?.date &&
        item.visitTime === entry?.time &&
        item.status === "sent"),
  );
};

const isSmsReminderDue = (
  entry: CalendarEntry,
  kind: ReminderKind,
  now = new Date(),
) => {
  const visitDateTime = getCalendarVisitDateTime(entry);
  const window = SMS_REMINDER_WINDOWS[kind];

  if (!visitDateTime || !window) {
    return false;
  }

  const minutesUntilVisit = differenceInMinutes(visitDateTime, now);

  if (minutesUntilVisit <= 0) {
    return false;
  }

  return (
    Math.abs(minutesUntilVisit - window.targetMinutes) <= window.toleranceMinutes
  );
};

const normalizeClientName = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е");

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

export const personalizeSmsTemplate = (
  template: string,
  {
    clientName,
    date,
    time,
    service,
    master,
    studio,
  }: {
    clientName?: string;
    date?: string;
    time?: string;
    service?: string;
    master?: string;
    studio?: string;
  },
) =>
  String(template ?? "")
    .replaceAll("{name}", clientName || "kliencie")
    .replaceAll("{date}", date || "")
    .replaceAll("{time}", time || "")
    .replaceAll("{service}", service || "wizyta")
    .replaceAll("{master}", master || "zespol NUAR")
    .replaceAll("{studio}", studio || "NUAR")
    .trim();

export const defaultSmsReminderTemplates = {
  "24h":
    "Dzien dobry, {name}! Przypominamy o wizycie w {studio} jutro {date} o {time}. {service}",
  "2h":
    "Dzien dobry, {name}! Za 2 godziny czekamy na Ciebie w {studio} o {time}. {master}",
};

export const buildDueSmsReminders = ({
  appSettings,
  calendarEntries = [],
  clientProfiles = [],
  now = new Date(),
  smsReminderLog = [],
}: {
  appSettings: Record<string, unknown>;
  calendarEntries?: CalendarEntry[];
  clientProfiles?: ClientProfile[];
  now?: Date;
  smsReminderLog?: ReminderLogItem[];
}) => {
  if (!appSettings?.smsRemindersEnabled) {
    return [];
  }

  const studioName = String(appSettings.studioName ?? "NUAR");
  const due: Array<Record<string, unknown>> = [];

  calendarEntries
    .filter(
      (entry) =>
        entry?.kind === "visit" &&
        !["completed", "cancelled", "no_show"].includes(String(entry?.status ?? "")),
    )
    .forEach((entry) => {
      SMS_REMINDER_KINDS.forEach((kind) => {
        const enabled =
          kind === "24h"
            ? appSettings.smsReminder24hEnabled !== false
            : appSettings.smsReminder2hEnabled !== false;

        if (!enabled || wasSmsReminderSent(smsReminderLog, entry, kind)) {
          return;
        }

        if (!isSmsReminderDue(entry, kind, now)) {
          return;
        }

        const phone = resolveClientPhone(entry, clientProfiles);

        if (!phone) {
          due.push({
            calendarEntryId: entry.id,
            client: entry.client,
            date: entry.date,
            error: "no_phone",
            kind,
            phone: "",
            service: entry.service,
            status: "skipped",
            time: entry.time,
            key: buildSmsReminderKey(entry, kind),
          });
          return;
        }

        const template =
          kind === "24h"
            ? String(
                appSettings.smsReminder24hTemplate ??
                  defaultSmsReminderTemplates["24h"],
              )
            : String(
                appSettings.smsReminder2hTemplate ??
                  defaultSmsReminderTemplates["2h"],
              );

        due.push({
          calendarEntryId: entry.id,
          client: entry.client,
          date: entry.date,
          kind,
          key: buildSmsReminderKey(entry, kind),
          master: entry.master,
          message: personalizeSmsTemplate(template, {
            clientName: resolveClientMessageName(clientProfiles, {
              client: entry.client,
              clientId: entry.clientId,
            }),
            date: entry.date,
            master: entry.master,
            service: entry.service,
            studio: studioName,
            time: entry.time,
          }),
          phone,
          service: entry.service,
          status: "pending",
          time: entry.time,
        });
      });
    });

  return due.sort((left, right) =>
    String(left.time).localeCompare(String(right.time)),
  );
};
