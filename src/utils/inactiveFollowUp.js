import {buildInactiveClients} from "./alertCenter.js";
import {isCalendarVisitPlanned} from "./calendarVisitStatus.js";
import {getClientMessageName} from "./clientMessageName.js";
import {matchesClientRecord} from "./clientLinks.js";
import {resolveAutomatedMessageTemplate} from "./messageTemplates.js";
import {normalizePhoneForSms, personalizeSmsTemplate} from "./smsReminders.js";

export const INACTIVE_FOLLOW_UP_KINDS = ["14d", "30d", "60d"];

export const INACTIVE_FOLLOW_UP_TIER_DAYS = {
  "14d": 14,
  "30d": 30,
  "60d": 60,
};

export const defaultInactiveFollowUpTemplates = {
  "14d":
    "Czesc {name}! Tesknilismy za Toba w {studio}. Minely juz {days} dni od ostatniej wizyty. Chetnie pomozemy zarezerwowac termin.",
  "30d":
    "Czesc {name}! W {studio} pamietamy o Tobie. Minelo juz {days} dni bez wizyty - odezwij sie, ustalimy dogodny termin.",
  "60d":
    "Czesc {name}! Czekamy na Ciebie w {studio}. Minelo {days} dni od ostatniej wizyty - wroc do regularnych masazy u nas.",
};

export const buildInactiveFollowUpKey = (clientId, kind) =>
  `inactive:${clientId}:${kind}`;

export const wasInactiveFollowUpSent = (inactiveFollowUpLog, clientId, kind) => {
  const key = buildInactiveFollowUpKey(clientId, kind);

  return (inactiveFollowUpLog ?? []).some(
    (item) =>
      item.key === key ||
      (String(item.clientId) === String(clientId) &&
        item.kind === kind &&
        item.status === "sent"),
  );
};

export const isInactiveFollowUpTierEnabled = (appSettings = {}, kind) => {
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

export const resolveInactiveFollowUpTemplate = (
  appSettings = {},
  kind,
  {client = null, messageTemplates = []} = {},
) => {
  const purposeMap = {
    "14d": "inactive-14d",
    "30d": "inactive-30d",
    "60d": "inactive-60d",
  };

  return resolveAutomatedMessageTemplate({
    appSettings,
    client,
    defaultTemplate: defaultInactiveFollowUpTemplates[kind] ?? "",
    messageTemplates,
    purpose: purposeMap[kind] ?? "general",
  });
};

export const resolveNextInactiveFollowUpKind = ({
  appSettings = {},
  client,
  inactiveFollowUpLog = [],
}) => {
  const daysAbsent = Number(client?.daysAbsent);

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

export const clientHasUpcomingVisit = ({
  calendarEntries = [],
  client,
  clientProfiles = [],
  now = new Date(),
}) =>
  calendarEntries.some(
    (entry) =>
      entry?.kind === "visit" &&
      matchesClientRecord(entry, clientProfiles, client) &&
      isCalendarVisitPlanned(entry, now),
  );

export const buildDueInactiveFollowUps = ({
  appSettings = {},
  calendarEntries = [],
  clientProfiles = [],
  inactiveFollowUpLog = [],
  messageTemplates = [],
  now = new Date(),
  visits = [],
}) => {
  if (!appSettings.inactiveFollowUpEnabled) {
    return [];
  }

  const studioName = appSettings.studioName || "NUAR";
  const inactiveClients = buildInactiveClients({
    calendarEntries,
    clientProfiles,
    inactiveClientDays: 14,
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
      const template = resolveInactiveFollowUpTemplate(appSettings, kind, {
        client,
        messageTemplates,
      });
      const message = personalizeSmsTemplate(template, {
        clientName: getClientMessageName(client),
        date: client.lastVisit,
        studio: studioName,
        time: "",
        service: "",
        master: "",
      }).replaceAll("{days}", String(client.daysAbsent ?? ""));
      const telegram = String(client.telegram ?? "").trim();

      if (clientHasUpcomingVisit({
        calendarEntries,
        client,
        clientProfiles,
        now,
      })) {
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
      const kindDiff =
        INACTIVE_FOLLOW_UP_KINDS.indexOf(left.kind) -
        INACTIVE_FOLLOW_UP_KINDS.indexOf(right.kind);

      if (kindDiff !== 0) {
        return kindDiff;
      }

      return (right.daysAbsent ?? 0) - (left.daysAbsent ?? 0);
    });
};
