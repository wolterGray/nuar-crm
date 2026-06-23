import {
  addDays,
  format,
  isAfter,
  isBefore,
  isValid,
  parse,
  parseISO,
  startOfDay,
} from "https://esm.sh/date-fns@4.1.0";

const APP_DATE_FORMAT = "dd.MM.yyyy";
const INPUT_DATE_FORMAT = "yyyy-MM-dd";
export const DIGEST_TIMEZONE = "Europe/Warsaw";

type DigestPayload = {
  appSettings?: Record<string, unknown>;
  calendarEntries?: Array<Record<string, unknown>>;
  certificates?: Array<Record<string, unknown>>;
  clientPackages?: Array<Record<string, unknown>>;
  clients?: Array<Record<string, unknown>>;
  employees?: Array<Record<string, unknown>>;
  visits?: Array<Record<string, unknown>>;
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

const formatInputDate = (value: unknown) => {
  const parsedDate = parseAppDate(value);

  return parsedDate ? format(parsedDate, INPUT_DATE_FORMAT) : "";
};

const formatDisplayDate = (value: unknown) => {
  const parsedDate = parseAppDate(value);

  return parsedDate ? format(parsedDate, APP_DATE_FORMAT) : "";
};

const toInputDate = (value: unknown) => {
  const parsed = parseAppDate(value);

  if (parsed) {
    return format(parsed, INPUT_DATE_FORMAT);
  }

  const raw = String(value ?? "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  return "";
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
  lastRunAt: unknown,
  now = new Date(),
  timeZone = DIGEST_TIMEZONE,
) => {
  if (!lastRunAt) {
    return false;
  }

  const last = new Date(String(lastRunAt));

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

const getUpcomingBirthday = (birthday: unknown) => {
  const [, month, day] = String(birthday ?? "").split("-").map(Number);

  if (!month || !day) {
    return null;
  }

  const today = new Date();
  const startOfToday = startOfDay(today);
  let nextBirthday = new Date(today.getFullYear(), month - 1, day);

  if (nextBirthday < startOfToday) {
    nextBirthday = new Date(today.getFullYear() + 1, month - 1, day);
  }

  const daysLeft = Math.round(
    (nextBirthday.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000),
  );

  return {
    daysLeft,
    label: daysLeft === 0 ? "Сегодня" : `Через ${daysLeft} дн.`,
  };
};

const isActiveClientPackage = (item: Record<string, unknown>) =>
  item?.archived !== true && Number(item?.remainingVisits) > 0;

const isActiveCertificate = (item: Record<string, unknown>) => {
  const status = String(item?.status ?? "active").toLowerCase();

  return status === "active" && Number(item?.remainingBalance) > 0;
};

const isCertificateExpired = (item: Record<string, unknown>) => {
  const expiryInput = toInputDate(item?.expiryDate);

  if (!expiryInput) {
    return false;
  }

  const todayInput = getDateInputInTimezone(new Date(), DIGEST_TIMEZONE);

  return expiryInput < todayInput;
};

const getCertificateRemainingPercent = (item: Record<string, unknown>) => {
  const nominal = Number(item?.nominal) || 0;
  const remaining = Number(item?.remainingBalance) || 0;

  if (nominal <= 0) {
    return 0;
  }

  return Math.round((remaining / nominal) * 100);
};

const shiftAppDate = (value: string, days: number) => {
  const parsedDate = parseAppDate(value);

  return parsedDate ? format(addDays(parsedDate, days), INPUT_DATE_FORMAT) : "";
};

const toFinanceNumber = (value: unknown) => {
  const normalizedValue =
    typeof value === "string"
      ? value.replace(/\s+/g, "").replace(",", ".")
      : value;
  const number = Number(normalizedValue);

  return Number.isFinite(number) ? number : 0;
};

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е");

const normalizePaymentMethod = (method: unknown) => {
  const value = normalizeText(method);

  if (
    value.includes("package") ||
    value.includes("pakiet") ||
    value.includes("пакет")
  ) {
    return "package";
  }

  if (
    value.includes("certificate") ||
    value.includes("certyfikat") ||
    value.includes("сертификат")
  ) {
    return "certificate";
  }

  if (value.includes("barter") || value.includes("бартер")) {
    return "barter";
  }

  return "cash";
};

const isCancelledVisit = (visit: Record<string, unknown>) =>
  ["cancelled", "canceled", "no_show"].includes(
    normalizeText(visit?.status).replace("-", "_"),
  );

const isVisitInPeriod = (
  visit: Record<string, unknown>,
  startDate: string,
  endDate: string,
) => {
  const visitDate = parseAppDate(visit?.date);
  const start = parseAppDate(startDate);
  const end = parseAppDate(endDate);

  if (!visitDate || !start || !end) {
    return false;
  }

  return !isBefore(visitDate, start) && !isAfter(visitDate, end);
};

const isFutureVisit = (visit: Record<string, unknown>, now = new Date()) => {
  const visitDate = parseAppDate(visit?.date);

  if (!visitDate) {
    return false;
  }

  const [hours = 23, minutes = 59] = String(visit?.time || "23:59")
    .split(":")
    .map(Number);
  const visitDateTime = new Date(visitDate);
  visitDateTime.setHours(hours, minutes, 0, 0);

  return visitDateTime.getTime() > now.getTime();
};

const isCompletedVisit = (visit: Record<string, unknown>, now = new Date()) => {
  if (isCancelledVisit(visit)) {
    return false;
  }

  if (visit?.recordType === "operation") {
    return true;
  }

  if (visit?.status === "completed" || visit?.isPlanned === false) {
    return true;
  }

  return !isFutureVisit(visit, now);
};

const getVisitGrossAmount = (visit: Record<string, unknown>) =>
  toFinanceNumber(visit?.amount);

const getVisitDiscountAmount = (visit: Record<string, unknown>) =>
  getVisitGrossAmount(visit) * (toFinanceNumber(visit?.discount) / 100);

const getVisitDiscountedAmount = (visit: Record<string, unknown>) =>
  getVisitGrossAmount(visit) - getVisitDiscountAmount(visit);

const getVisitDebtAmount = (visit: Record<string, unknown>) =>
  Math.max(0, toFinanceNumber(visit?.debt));

const getVisitTipAmount = (visit: Record<string, unknown>) =>
  Math.max(0, toFinanceNumber(visit?.tip));

const getVisitExtraAmount = (visit: Record<string, unknown>) =>
  Math.max(0, toFinanceNumber(visit?.extra));

const toMinutes = (time: unknown) => {
  const [hours, minutes] = String(time ?? "00:00").split(":").map(Number);

  return (
    (Number.isFinite(hours) ? hours : 0) * 60 +
    (Number.isFinite(minutes) ? minutes : 0)
  );
};

const toClockTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;

const getExpectedVisitAmount = (entry: Record<string, unknown>) => {
  const amount = toFinanceNumber(entry?.amount);
  const discount = amount * (toFinanceNumber(entry?.discount) / 100);

  return Math.max(0, amount - discount);
};

const buildDigestFreeSlots = ({
  appSettings = {},
  calendarEntries = [],
  employees = [],
  minSlotMinutes = 60,
  now = new Date(),
  todayInput,
}: {
  appSettings?: Record<string, unknown>;
  calendarEntries?: Array<Record<string, unknown>>;
  employees?: Array<Record<string, unknown>>;
  minSlotMinutes?: number;
  now?: Date;
  todayInput: string;
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
  const freeSlots: Array<Record<string, unknown>> = [];

  masters.forEach((employee) => {
    const master = String(employee.name ?? "").trim();
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

const getVisitServiceReceivedAmount = (visit: Record<string, unknown>) => {
  const payment = normalizePaymentMethod(visit?.payment);

  if (
    isCancelledVisit(visit) ||
    payment === "package" ||
    payment === "certificate" ||
    payment === "barter"
  ) {
    return 0;
  }

  if (visit?.paidAmount !== undefined && visit?.paidAmount !== null) {
    return Math.max(0, toFinanceNumber(visit.paidAmount));
  }

  return Math.max(0, getVisitDiscountedAmount(visit) - getVisitDebtAmount(visit));
};

const getVisitReceivedAmount = (visit: Record<string, unknown>) => {
  if (isCancelledVisit(visit)) {
    return 0;
  }

  if (visit?.recordType === "operation") {
    return Math.max(0, getVisitExtraAmount(visit) || getVisitGrossAmount(visit));
  }

  return (
    getVisitServiceReceivedAmount(visit) +
    getVisitTipAmount(visit) +
    getVisitExtraAmount(visit)
  );
};

const getYesterdayReceivedRevenue = ({
  clientPackages = [],
  now = new Date(),
  visits = [],
  yesterdayInput,
}: {
  clientPackages?: Array<Record<string, unknown>>;
  now?: Date;
  visits?: Array<Record<string, unknown>>;
  yesterdayInput: string;
}) => {
  const completedVisits = visits.filter(
    (visit) =>
      isCompletedVisit(visit, now) &&
      isVisitInPeriod(visit, yesterdayInput, yesterdayInput),
  );
  const serviceReceived = completedVisits
    .filter((visit) => visit.recordType !== "operation")
    .reduce((sum, visit) => sum + getVisitReceivedAmount(visit), 0);
  const operationsIncome = completedVisits
    .filter((visit) => visit.recordType === "operation")
    .reduce((sum, visit) => sum + getVisitReceivedAmount(visit), 0);
  const packageIncome = clientPackages
    .filter((item) => isVisitInPeriod({date: item.purchaseDate}, yesterdayInput, yesterdayInput))
    .reduce((sum, item) => sum + Math.max(0, toFinanceNumber(item.price)), 0);

  return serviceReceived + operationsIncome + packageIncome;
};

const formatMoney = (value: number) =>
  `${Math.round(Number(value) || 0).toLocaleString("ru-RU")} zł`;

const sortByTime = (
  left: Record<string, unknown>,
  right: Record<string, unknown>,
) => String(left.time ?? "00:00").localeCompare(String(right.time ?? "00:00"));

export const buildTelegramDigestSections = ({
  appSettings = {},
  calendarEntries = [],
  certificates = [],
  clientPackages = [],
  clientProfiles = [],
  employees: _employees = [],
  now = new Date(),
  visits = [],
}: DigestPayload & {appSettings?: Record<string, unknown>; now?: Date}) => {
  const todayInput = getDateInputInTimezone(now, DIGEST_TIMEZONE);
  const todayDisplay = formatDisplayDate(todayInput);
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
      debt: getVisitDebtAmount(entry),
      duration: Number(entry.duration) || 60,
      master: entry.master || "—",
      service: entry.service || "—",
      time: entry.time || "—",
    }));

  const todayExpectedRevenue = visitsToday.reduce(
    (sum, entry) => sum + Number(entry.amount || 0),
    0,
  );
  const todayDebtAlerts = visitsToday
    .filter((entry) => Number(entry.debt) > 0)
    .map((entry) => ({
      amount: entry.debt,
      client: entry.client,
      service: entry.service,
      time: entry.time,
    }));
  const freeSlots = buildDigestFreeSlots({
    appSettings,
    calendarEntries,
    employees: _employees,
    now,
    todayInput,
  });

  const birthdayReminderDays = Math.max(
    0,
    Number(appSettings.birthdayReminderDays) || 7,
  );

  const birthdays = clientProfiles
    .map((client) => ({
      ...client,
      birthdayInfo: getUpcomingBirthday(client.birthday),
    }))
    .filter(
      (client) =>
        client.birthdayInfo &&
        client.birthdayInfo.daysLeft <= birthdayReminderDays,
    )
    .map((client) => ({
      daysLeft: client.birthdayInfo?.daysLeft ?? 0,
      label: client.birthdayInfo?.label ?? "",
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
    Number(appSettings.certificateExpiryReminderDays) || 30,
  );
  const lowBalancePercent = Math.max(
    1,
    Number(appSettings.certificateLowBalancePercent) || 20,
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

  const yesterdayRevenue = getYesterdayReceivedRevenue({
    clientPackages,
    now,
    visits,
    yesterdayInput,
  });

  return {
    certificateAlerts,
    lowPackages,
    studioName,
    todayBirthdays: birthdays.filter((item) => item.daysLeft === 0),
    todayDebtAlerts,
    todayDisplay,
    todayExpectedRevenue,
    todayFreeSlots: freeSlots,
    upcomingBirthdays: birthdays.filter((item) => item.daysLeft > 0),
    visitsToday,
    yesterdayDisplay: formatDisplayDate(yesterdayInput),
    yesterdayRevenue,
  };
};

export const formatTelegramDigestMessage = (sections: Record<string, unknown>) => {
  const lines = [
    `📋 ${sections.studioName} · ${sections.todayDisplay}`,
    "",
  ];

  const visitsToday = Array.isArray(sections.visitsToday)
    ? sections.visitsToday
    : [];

  lines.push(`🗓 Записи сегодня (${visitsToday.length})`);

  if (visitsToday.length === 0) {
    lines.push("Нет активных записей");
  } else {
    visitsToday.forEach((entry: Record<string, unknown>) => {
      lines.push(
        `${entry.time} · ${entry.client} · ${entry.service} · ${entry.master}`,
      );
    });
  }

  lines.push("");

  lines.push(
    `💵 План на сегодня: ${formatMoney(Number(sections.todayExpectedRevenue) || 0)}`,
  );

  const todayFreeSlots = Array.isArray(sections.todayFreeSlots)
    ? sections.todayFreeSlots
    : [];

  if (todayFreeSlots.length > 0) {
    lines.push("🟢 Свободные окна");
    todayFreeSlots.forEach((slot: Record<string, unknown>) => {
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
    todayDebtAlerts.forEach((item: Record<string, unknown>) => {
      lines.push(
        `${item.time} · ${item.client} · ${formatMoney(Number(item.amount) || 0)}`,
      );
    });
    lines.push("");
  }

  const todayBirthdays = Array.isArray(sections.todayBirthdays)
    ? sections.todayBirthdays
    : [];

  if (todayBirthdays.length > 0) {
    lines.push("🎂 Дни рождения сегодня");
    todayBirthdays.forEach((item: Record<string, unknown>) => {
      lines.push(String(item.name));
    });
    lines.push("");
  }

  const upcomingBirthdays = Array.isArray(sections.upcomingBirthdays)
    ? sections.upcomingBirthdays
    : [];

  if (upcomingBirthdays.length > 0) {
    lines.push("🎂 Скоро день рождения");
    upcomingBirthdays.forEach((item: Record<string, unknown>) => {
      lines.push(`${item.name} · ${item.label}`);
    });
    lines.push("");
  }

  const lowPackages = Array.isArray(sections.lowPackages)
    ? sections.lowPackages
    : [];

  if (lowPackages.length > 0) {
    lines.push("📦 Пакеты на исходе");
    lowPackages.forEach((item: Record<string, unknown>) => {
      lines.push(
        `${item.client} · ${item.packageName}: ${item.remainingVisits} сеанс.`,
      );
    });
    lines.push("");
  }

  const certificateAlerts = Array.isArray(sections.certificateAlerts)
    ? sections.certificateAlerts
    : [];

  if (certificateAlerts.length > 0) {
    lines.push("🎁 Сертификаты");
    certificateAlerts.forEach((item: Record<string, unknown>) => {
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
    `💰 Вчера (${sections.yesterdayDisplay}): ${formatMoney(Number(sections.yesterdayRevenue) || 0)}`,
  );

  const message = lines.join("\n").trim();

  if (message.length <= 4096) {
    return message;
  }

  return `${message.slice(0, 4090).trim()}…`;
};

export const buildTelegramDigestMessage = (payload: DigestPayload & {now?: Date}) => {
  const appSettings = payload.appSettings ?? {};
  const sections = buildTelegramDigestSections({
    appSettings,
    calendarEntries: payload.calendarEntries ?? [],
    certificates: payload.certificates ?? [],
    clientPackages: payload.clientPackages ?? [],
    clientProfiles: payload.clients ?? [],
    employees: payload.employees ?? [],
    now: payload.now,
    visits: payload.visits ?? [],
  });

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
}: {
  appSettings?: Record<string, unknown>;
  force?: boolean;
  lastRunAt?: unknown;
  now?: Date;
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
      digestTime: String(appSettings.telegramDigestTime ?? "08:00"),
      now,
    })
  ) {
    return {allowed: false, reason: "not_time"};
  }

  return {allowed: true, reason: "scheduled"};
};
