import {differenceInCalendarDays, startOfDay} from "date-fns";
import {formatAppDate, parseAppDate} from "./dateUtils.js";

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
  return formatAppDate(date, "yyyy-MM-dd");
};

export const toDisplayDate = (date) => {
  return formatAppDate(date, "dd.MM.yyyy");
};

export const parseDisplayDate = (date) => {
  return parseAppDate(date);
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

  return Math.max(0, differenceInCalendarDays(startOfDay(today), parsedDate));
};
