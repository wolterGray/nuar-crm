const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

const compactMoneyFormatter = new Intl.NumberFormat("ru-RU", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const toMoneyNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
};

export const formatMoney = (value) => `${moneyFormatter.format(toMoneyNumber(value))} zł`;

export const formatCompactMoney = (value) =>
  `${compactMoneyFormatter.format(toMoneyNumber(value))} zł`;

export const toInputDate = (date) => {
  const [day, month, year] = date.split(".");
  return `${year}-${month}-${day}`;
};

export const toDisplayDate = (date) => {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const parseDisplayDate = (date) => {
  const [day, month, year] = String(date ?? "").split(".").map(Number);

  if (!day || !month || !year) {
    return null;
  }

  const timestamp = Date.UTC(year, month - 1, day);
  const parsedDate = new Date(timestamp);

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    return null;
  }

  return parsedDate;
};

export const getLatestDisplayDate = (dates) =>
  dates.reduce((latestDate, date) => {
    const parsedDate = parseDisplayDate(date);
    const parsedLatestDate = parseDisplayDate(latestDate);

    return !parsedLatestDate || (parsedDate && parsedDate > parsedLatestDate)
      ? date
      : latestDate;
  }, "");

export const getDaysSinceDisplayDate = (date, today = new Date()) => {
  const parsedDate = parseDisplayDate(date);

  if (!parsedDate) {
    return null;
  }

  const todayTimestamp = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  return Math.max(0, Math.floor((todayTimestamp - parsedDate.getTime()) / DAY_IN_MS));
};
