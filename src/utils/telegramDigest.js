import {getUpcomingBirthday} from "./clientAlerts.js";
import {isActiveClientPackage} from "./clientPackages.js";
import {
  getCertificateRemainingPercent,
  isActiveCertificate,
  isCertificateExpired,
} from "./certificates.js";
import {getTodayInput} from "./dateHelpers.js";
import {formatAppDate, shiftAppDate} from "./dateUtils.js";
import {buildFinanceStats} from "./finance.js";
import {toInputDate} from "./formatters.jsx";

export const DIGEST_TIMEZONE = "Europe/Warsaw";

const formatMoney = (value) =>
  `${Math.round(Number(value) || 0).toLocaleString("ru-RU")} zł`;

const toMoneyNumber = (value) => {
  const normalizedValue =
    typeof value === "string"
      ? value.replace(/\s+/g, "").replace(",", ".")
      : value;
  const number = Number(normalizedValue);

  return Number.isFinite(number) ? number : 0;
};

const toMinutes = (time) => {
  const [hours, minutes] = String(time ?? "00:00").split(":").map(Number);

  return (
    (Number.isFinite(hours) ? hours : 0) * 60 +
    (Number.isFinite(minutes) ? minutes : 0)
  );
};

const toClockTime = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;

const getExpectedVisitAmount = (entry) => {
  const amount = toMoneyNumber(entry?.amount);
  const discount = amount * (toMoneyNumber(entry?.discount) / 100);

  return Math.max(0, amount - discount);
};

const getDebtAmount = (entry) => Math.max(0, toMoneyNumber(entry?.debt));

const buildDigestFreeSlots = ({
  appSettings = {},
  calendarEntries = [],
  employees = [],
  minSlotMinutes = 60,
  now = new Date(),
  todayInput,
}) => {
  const masters =
    employees.length > 0
      ? employees
      : [
          ...new Set(
            calendarEntries
              .filter(
                (entry) =>
                  entry.kind === "visit" && toInputDate(entry.date) === todayInput,
              )
              .map((entry) => String(entry.master ?? "").trim())
              .filter(Boolean),
          ),
        ].map((name) => ({name}));
  const currentMinutes = getMinutesInTimezone(now, DIGEST_TIMEZONE);
  const freeSlots = [];

  masters.forEach((employee) => {
    const master = employee.name;
    const shiftStart = toMinutes(
      employee.shiftStart || appSettings.workdayStart || "08:00",
    );
    const shiftEnd = toMinutes(
      employee.shiftEnd || appSettings.workdayEnd || "22:00",
    );
    const windowStart = Math.max(shiftStart, currentMinutes);

    if (!master || windowStart >= shiftEnd) {
      return;
    }

    const occupied = calendarEntries
      .filter(
        (entry) =>
          entry.kind === "visit" &&
          toInputDate(entry.date) === todayInput &&
          entry.master === master &&
          !["cancelled", "no_show"].includes(String(entry.status ?? "")),
      )
      .map((entry) => ({
        start: toMinutes(entry.time),
        end:
          toMinutes(entry.time) +
          Math.max(Number(entry.duration) || 60, minSlotMinutes),
      }))
      .sort((left, right) => left.start - right.start);

    let cursor = windowStart;

    occupied.forEach((interval) => {
      if (interval.start > cursor && interval.start - cursor >= minSlotMinutes) {
        freeSlots.push({
          durationMinutes: interval.start - cursor,
          endTime: toClockTime(interval.start),
          master,
          startTime: toClockTime(cursor),
        });
      }

      cursor = Math.max(cursor, interval.end);
    });

    if (shiftEnd - cursor >= minSlotMinutes) {
      freeSlots.push({
        durationMinutes: shiftEnd - cursor,
        endTime: toClockTime(shiftEnd),
        master,
        startTime: toClockTime(cursor),
      });
    }
  });

  return freeSlots
    .sort(
      (left, right) => toMinutes(left.startTime) - toMinutes(right.startTime),
    )
    .slice(0, 5);
};

export const getDateInputInTimezone = (
  date = new Date(),
  timeZone = DIGEST_TIMEZONE,
) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  });

  return formatter.format(date);
};

export const getMinutesInTimezone = (
  date = new Date(),
  timeZone = DIGEST_TIMEZONE,
) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone,
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );

  return hour * 60 + minute;
};

export const wasDigestSentToday = (
  lastRunAt,
  now = new Date(),
  timeZone = DIGEST_TIMEZONE,
) => {
  if (!lastRunAt) {
    return false;
  }

  const last = new Date(lastRunAt);

  if (!Number.isFinite(last.getTime())) {
    return false;
  }

  return (
    getDateInputInTimezone(last, timeZone) === getDateInputInTimezone(now, timeZone)
  );
};

export const shouldSendDigestNow = ({
  digestTime = "08:00",
  now = new Date(),
  timeZone = DIGEST_TIMEZONE,
  toleranceMinutes = 15,
} = {}) => {
  const [targetHours, targetMinutes] = String(digestTime || "08:00")
    .split(":")
    .map(Number);
  const targetTotal = targetHours * 60 + targetMinutes;
  const currentTotal = getMinutesInTimezone(now, timeZone);

  return Math.abs(currentTotal - targetTotal) <= toleranceMinutes;
};

const sortByTime = (left, right) =>
  String(left.time ?? "00:00").localeCompare(String(right.time ?? "00:00"));

export const buildTelegramDigestSections = ({
  appSettings = {},
  calendarEntries = [],
  certificates = [],
  clientPackages = [],
  clientProfiles = [],
  defaultAppSettings = {},
  employees = [],
  now = new Date(),
  visits = [],
}) => {
  const todayInput =
    getDateInputInTimezone(now, DIGEST_TIMEZONE) || getTodayInput();
  const todayDisplay = formatAppDate(todayInput, "dd.MM.yyyy");
  const yesterdayInput = shiftAppDate(todayInput, -1);
  const studioName = String(appSettings.studioName ?? "NUAR").trim() || "NUAR";

  const visitsToday = calendarEntries
    .filter(
      (entry) =>
        entry.kind === "visit" &&
        toInputDate(entry.date) === todayInput &&
        !["cancelled", "no_show"].includes(String(entry.status ?? "")),
    )
    .sort(sortByTime)
    .map((entry) => ({
      amount: getExpectedVisitAmount(entry),
      client: entry.client || "Клиент",
      debt: getDebtAmount(entry),
      duration: Number(entry.duration) || 60,
      master: entry.master || "—",
      service: entry.service || "—",
      status: entry.status || "scheduled",
      time: entry.time || "—",
    }));

  const todayExpectedRevenue = visitsToday.reduce(
    (sum, entry) => sum + entry.amount,
    0,
  );
  const todayDebtAlerts = visitsToday
    .filter((entry) => entry.debt > 0)
    .map((entry) => ({
      amount: entry.debt,
      client: entry.client,
      service: entry.service,
      time: entry.time,
    }));
  const freeSlots = buildDigestFreeSlots({
    appSettings,
    calendarEntries,
    employees,
    now,
    todayInput,
  });

  const birthdayReminderDays = Math.max(
    0,
    Number(appSettings.birthdayReminderDays) ||
      defaultAppSettings.birthdayReminderDays ||
      7,
  );

  const birthdaysToday = clientProfiles
    .map((client) => ({
      ...client,
      birthdayInfo: getUpcomingBirthday(client.birthday, now),
    }))
    .filter(
      (client) =>
        client.birthdayInfo &&
        client.birthdayInfo.daysLeft <= birthdayReminderDays,
    )
    .map((client) => ({
      daysLeft: client.birthdayInfo.daysLeft,
      label: client.birthdayInfo.label,
      name: client.name || "Клиент",
    }));

  const lowPackages = clientPackages
    .filter(
      (item) =>
        isActiveClientPackage(item) && Number(item.remainingVisits) <= 2,
    )
    .map((item) => ({
      client: item.client || "Клиент",
      packageName: item.packageName || "Пакет",
      remainingVisits: Number(item.remainingVisits) || 0,
    }));

  const expiryReminderDays = Math.max(
    1,
    Number(appSettings.certificateExpiryReminderDays) ||
      defaultAppSettings.certificateExpiryReminderDays ||
      30,
  );
  const lowBalancePercent = Math.max(
    1,
    Number(appSettings.certificateLowBalancePercent) ||
      defaultAppSettings.certificateLowBalancePercent ||
      20,
  );
  const expiryThreshold = shiftAppDate(todayInput, expiryReminderDays);

  const certificateAlerts = certificates
    .filter((item) => isActiveCertificate(item))
    .flatMap((item) => {
      const expiryInput = toInputDate(item.expiryDate);
      const remainingPercent = getCertificateRemainingPercent(item);
      const expirySoon =
        expiryInput &&
        expiryInput <= expiryThreshold &&
        !isCertificateExpired(item);
      const lowBalance =
        Number(item.remainingBalance) > 0 &&
        remainingPercent <= lowBalancePercent &&
        remainingPercent > 0;

      if (!expirySoon && !lowBalance) {
        return [];
      }

      return [
        {
          client: item.client || "—",
          code: item.code || "—",
          expiryDate: item.expiryDate || "",
          kind: expirySoon ? "expiry" : "balance",
          remainingBalance: item.remainingBalance,
          remainingPercent,
        },
      ];
    });

  const yesterdayStats = buildFinanceStats({
    calendarEntries,
    certificates,
    clientPackages,
    employees,
    endDate: yesterdayInput,
    now,
    startDate: yesterdayInput,
    visits,
  });

  return {
    certificateAlerts,
    lowPackages,
    studioName,
    todayBirthdays: birthdaysToday.filter((item) => item.daysLeft === 0),
    todayDebtAlerts,
    todayDisplay,
    todayExpectedRevenue,
    todayFreeSlots: freeSlots,
    upcomingBirthdays: birthdaysToday.filter((item) => item.daysLeft > 0),
    visitsToday,
    yesterdayRevenue: yesterdayStats.receivedRevenue ?? 0,
    yesterdayDisplay: formatAppDate(yesterdayInput, "dd.MM.yyyy"),
  };
};

export const formatTelegramDigestMessage = (sections) => {
  const lines = [
    `📋 ${sections.studioName} · ${sections.todayDisplay}`,
    "",
  ];

  lines.push(`🗓 Записи сегодня (${sections.visitsToday.length})`);

  if (sections.visitsToday.length === 0) {
    lines.push("Нет активных записей");
  } else {
    sections.visitsToday.forEach((entry) => {
      lines.push(
        `${entry.time} · ${entry.client} · ${entry.service} · ${entry.master}`,
      );
    });
  }

  lines.push("");

  lines.push(`💵 План на сегодня: ${formatMoney(sections.todayExpectedRevenue)}`);

  const todayFreeSlots = Array.isArray(sections.todayFreeSlots)
    ? sections.todayFreeSlots
    : [];

  if (todayFreeSlots.length > 0) {
    lines.push("🟢 Свободные окна");
    todayFreeSlots.forEach((slot) => {
      lines.push(
        `${slot.startTime}–${slot.endTime} · ${slot.master} · ${slot.durationMinutes} мин.`,
      );
    });
  } else {
    lines.push("🟢 Свободных окон от 60 мин. нет");
  }

  lines.push("");

  const todayDebtAlerts = Array.isArray(sections.todayDebtAlerts)
    ? sections.todayDebtAlerts
    : [];

  if (todayDebtAlerts.length > 0) {
    lines.push("⚠️ Долги по сегодняшним записям");
    todayDebtAlerts.forEach((item) => {
      lines.push(`${item.time} · ${item.client} · ${formatMoney(item.amount)}`);
    });
    lines.push("");
  }

  if (sections.todayBirthdays.length > 0) {
    lines.push("🎂 Дни рождения сегодня");
    sections.todayBirthdays.forEach((item) => {
      lines.push(`${item.name}`);
    });
    lines.push("");
  }

  if (sections.upcomingBirthdays.length > 0) {
    lines.push("🎂 Скоро день рождения");
    sections.upcomingBirthdays.forEach((item) => {
      lines.push(`${item.name} · ${item.label}`);
    });
    lines.push("");
  }

  if (sections.lowPackages.length > 0) {
    lines.push("📦 Пакеты на исходе");
    sections.lowPackages.forEach((item) => {
      lines.push(
        `${item.client} · ${item.packageName}: ${item.remainingVisits} сеанс.`,
      );
    });
    lines.push("");
  }

  if (sections.certificateAlerts.length > 0) {
    lines.push("🎁 Сертификаты");
    sections.certificateAlerts.forEach((item) => {
      if (item.kind === "expiry") {
        lines.push(`${item.code} · ${item.client} · до ${item.expiryDate}`);
      } else {
        lines.push(
          `${item.code} · ${item.client} · ${item.remainingBalance} zł (${item.remainingPercent}%)`,
        );
      }
    });
    lines.push("");
  }

  lines.push(
    `💰 Вчера (${sections.yesterdayDisplay}): ${formatMoney(sections.yesterdayRevenue)}`,
  );

  const message = lines.join("\n").trim();

  if (message.length <= 4096) {
    return message;
  }

  return `${message.slice(0, 4090).trim()}…`;
};

export const buildTelegramDigestMessage = (input) => {
  const sections = buildTelegramDigestSections(input);

  return {
    message: formatTelegramDigestMessage(sections),
    sections,
  };
};

export const canSendTelegramDigest = ({
  appSettings = {},
  force = false,
  lastRunAt = "",
  now = new Date(),
} = {}) => {
  if (!appSettings.telegramDigestEnabled) {
    return {allowed: false, reason: "disabled"};
  }

  if (force) {
    return {allowed: true, reason: "manual"};
  }

  if (wasDigestSentToday(lastRunAt, now)) {
    return {allowed: false, reason: "already_sent"};
  }

  if (
    !shouldSendDigestNow({
      digestTime: appSettings.telegramDigestTime,
      now,
    })
  ) {
    return {allowed: false, reason: "not_time"};
  }

  return {allowed: true, reason: "scheduled"};
};
