import {differenceInMinutes} from "date-fns";
import {parseAppDate} from "./dateUtils.js";
import {matchesClientRecord} from "./clientLinks.js";
import {resolveClientMessageName} from "./clientMessageName.js";
import {resolveAutomatedMessageTemplate, resolveLinkedClient} from "./messageTemplates.js";

export const SMS_REMINDER_KINDS = ["24h", "2h"];

export const SMS_REMINDER_WINDOWS = {
  "24h": {targetMinutes: 24 * 60, toleranceMinutes: 30},
  "2h": {targetMinutes: 2 * 60, toleranceMinutes: 15},
};

export const defaultSmsReminderTemplates = {
  "24h":
    "Dzien dobry, {name}! Przypominamy o wizycie w {studio} jutro {date} o {time}. {service}",
  "2h":
    "Dzien dobry, {name}! Za 2 godziny czekamy na Ciebie w {studio} o {time}. {master}",
};

export const normalizePhoneForSms = (phone) => {
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

  if (digits.startsWith("380") && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith("380") && digits.length === 11) {
    return digits;
  }

  return digits.length >= 9 ? digits : "";
};

export const getCalendarVisitDateTime = (entry) => {
  const date = parseAppDate(entry?.date);

  if (!date) {
    return null;
  }

  const [hours, minutes] = String(entry?.time ?? "00:00").split(":").map(Number);
  const visitDate = new Date(date);
  visitDate.setHours(hours || 0, minutes || 0, 0, 0);

  return Number.isNaN(visitDate.getTime()) ? null : visitDate;
};

export const buildSmsReminderKey = (entry, kind) =>
  `${entry?.id}:${kind}:${entry?.date}:${entry?.time}`;

export const wasSmsReminderSent = (smsReminderLog, entry, kind) => {
  const key = buildSmsReminderKey(entry, kind);

  return (smsReminderLog ?? []).some(
    (item) =>
      item.key === key ||
      (item.calendarEntryId === entry?.id &&
        item.kind === kind &&
        item.visitDate === entry?.date &&
        item.visitTime === entry?.time &&
        item.status === "sent"),
  );
};

export const isSmsReminderDue = (entry, kind, now = new Date()) => {
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

export const resolveClientPhone = (entry, clients = []) => {
  const linkedClient = clients.find(
    (client) =>
      matchesClientRecord(entry, clients, client) ||
      (entry?.clientId && String(client.id) === String(entry.clientId)),
  );

  return normalizePhoneForSms(linkedClient?.phone ?? entry?.phone);
};

export const personalizeSmsTemplate = (
  template,
  {clientName, date, time, service, master, studio},
) =>
  String(template ?? "")
    .replaceAll("{name}", clientName || "kliencie")
    .replaceAll("{date}", date || "")
    .replaceAll("{time}", time || "")
    .replaceAll("{service}", service || "wizyta")
    .replaceAll("{master}", master || "zespol NUAR")
    .replaceAll("{studio}", studio || "NUAR")
    .trim();

export const buildDueSmsReminders = ({
  appSettings,
  calendarEntries = [],
  clientProfiles = [],
  messageTemplates = [],
  now = new Date(),
  smsReminderLog = [],
}) => {
  if (!appSettings?.smsRemindersEnabled) {
    return [];
  }

  const studioName = appSettings.studioName || "NUAR";
  const due = [];

  calendarEntries
    .filter(
      (entry) =>
        entry?.kind === "visit" &&
        !["completed", "cancelled", "no_show"].includes(entry?.status),
    )
    .forEach((entry) => {
      SMS_REMINDER_KINDS.forEach((kind) => {
        const enabled =
          kind === "24h"
            ? appSettings.smsReminder24hEnabled !== false
            : appSettings.smsReminder2hEnabled !== false;

        if (!enabled) {
          return;
        }

        if (wasSmsReminderSent(smsReminderLog, entry, kind)) {
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
          });
          return;
        }

        const linkedClient = resolveLinkedClient(entry, clientProfiles);
        const template = resolveAutomatedMessageTemplate({
          appSettings,
          client: linkedClient,
          defaultTemplate: defaultSmsReminderTemplates[kind],
          messageTemplates,
          purpose: kind === "24h" ? "sms-reminder-24h" : "sms-reminder-2h",
        });

        due.push({
          calendarEntryId: entry.id,
          client: entry.client,
          date: entry.date,
          kind,
          key: buildSmsReminderKey(entry, kind),
          master: entry.master,
          message: personalizeSmsTemplate(template, {
            clientName: resolveClientMessageName(clientProfiles, entry),
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
