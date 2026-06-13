import {buildInactiveClients} from "./alertCenter.js";
import {getUpcomingBirthday} from "./clientAlerts.js";
import {getClientMessageName} from "./clientMessageName.js";
import {isActiveClientPackage} from "./clientPackages.js";
import {matchesClientRecord} from "./clientLinks.js";
import {normalizePhoneForSms, personalizeSmsTemplate} from "./smsReminders.js";

export const BULK_SMS_SEGMENTS = [
  {id: "inactive_14", label: "Неактивные 14+ дней", minDays: 14},
  {id: "inactive_30", label: "Неактивные 30+ дней", minDays: 30},
  {id: "inactive_60", label: "Неактивные 60+ дней", minDays: 60},
  {id: "new_clients", label: "Новые клиенты"},
  {id: "active_packages", label: "Активные пакеты"},
  {id: "birthday_7d", label: "День рождения в ближайшие 7 дней"},
  {id: "all_with_phone", label: "Все клиенты с телефоном"},
];

export const defaultBulkSmsTemplate =
  "Czesc {name}! Tesknilismy za Toba w {studio}. Chetnie pomozemy zarezerwowac termin.";

export const getBulkSmsSegment = (segmentId) =>
  BULK_SMS_SEGMENTS.find((segment) => segment.id === segmentId) ?? null;

const clientHasActivePackage = (client, clientPackages = [], clientProfiles = []) =>
  clientPackages.some(
    (packageItem) =>
      isActiveClientPackage(packageItem) &&
      matchesClientRecord(packageItem, clientProfiles, client),
  );

export const buildBulkSmsRecipients = ({
  appSettings = {},
  calendarEntries = [],
  clientPackages = [],
  clientProfiles = [],
  segmentId,
  template = defaultBulkSmsTemplate,
  visits = [],
  now = new Date(),
}) => {
  const segment = getBulkSmsSegment(segmentId);

  if (!segment) {
    return [];
  }

  const studioName = appSettings.studioName || "NUAR";
  let clients = [...clientProfiles];

  if (segment.minDays) {
    clients = buildInactiveClients({
      calendarEntries,
      clientProfiles,
      inactiveClientDays: segment.minDays,
      visits,
    });
  } else if (segmentId === "new_clients") {
    clients = clientProfiles.filter(
      (client) => String(client.status ?? "").trim() === "Новый",
    );
  } else if (segmentId === "active_packages") {
    clients = clientProfiles.filter((client) =>
      clientHasActivePackage(client, clientPackages, clientProfiles),
    );
  } else if (segmentId === "birthday_7d") {
    clients = clientProfiles.filter((client) => {
      const birthday = getUpcomingBirthday(client.birthday, now);

      return birthday && birthday.daysLeft <= 7;
    });
  }

  const seenClientIds = new Set();

  return clients
    .filter((client) => {
      if (seenClientIds.has(String(client.id))) {
        return false;
      }

      seenClientIds.add(String(client.id));
      return true;
    })
    .map((client) => {
      const phone = normalizePhoneForSms(client.phone);
      const message = personalizeBulkSmsMessage(template, {
        appSettings,
        client,
      });

      return {
        clientId: client.id,
        clientName: client.name,
        daysAbsent: client.daysAbsent ?? null,
        lastVisit: client.lastVisit ?? "",
        message,
        phone,
        segmentId,
        status: phone ? "ready" : "no_phone",
        studio: studioName,
      };
    })
    .sort((left, right) =>
      String(left.clientName).localeCompare(String(right.clientName), "ru"),
    );
};

export const personalizeBulkSmsMessage = (
  template,
  {appSettings = {}, client},
) => {
  const clientName = getClientMessageName(client);
  const personalized = personalizeSmsTemplate(template, {
    clientName,
    studio: appSettings.studioName || "NUAR",
  });

  return personalized.replaceAll(
    "{days}",
    client?.daysAbsent != null ? String(client.daysAbsent) : "",
  );
};

export const summarizeBulkSmsRecipients = (recipients = []) => {
  const ready = recipients.filter((item) => item.status === "ready");
  const skipped = recipients.filter((item) => item.status !== "ready");

  return {
    readyCount: ready.length,
    skippedCount: skipped.length,
    totalCount: recipients.length,
  };
};
