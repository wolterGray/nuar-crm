import {endOfMonth, startOfMonth, startOfYear, subMonths} from "date-fns";
import {formatAppDate, parseAppDate} from "../dateUtils.js";
import {formatMoney} from "../formatters.jsx";
import {enrichImportDocument} from "./invoiceParser.js";

const sourceLabels = {
  Booksy: "Booksy",
  Allegro: "Allegro",
  iPOS: "iPOS",
  Groupon: "Groupon",
};

export const IMPORT_DOCUMENT_AMOUNT_FILTERS = {
  all: "all",
  withAmount: "with_amount",
  withoutAmount: "without_amount",
};

export const IMPORT_DOCUMENT_PERIOD_FILTERS = {
  all: "all",
  month: "month",
  quarter: "quarter",
  year: "year",
};

export const DEFAULT_IMPORT_DOCUMENT_FILTERS = {
  search: "",
  source: "all",
  amount: IMPORT_DOCUMENT_AMOUNT_FILTERS.all,
  period: IMPORT_DOCUMENT_PERIOD_FILTERS.all,
};

export const formatImportDocumentDate = (value) => {
  if (!value) {
    return "—";
  }

  const parsed = parseAppDate(value.length === 10 ? value : value.slice(0, 10));

  if (!parsed) {
    return value;
  }

  return formatAppDate(parsed, "dd.MM.yyyy");
};

export const formatImportDocumentDateTime = (value) => {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return formatImportDocumentDate(value);
  }

  return parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getImportDocumentTitle = (document) => {
  const enriched = enrichImportDocument(document);
  return enriched.invoiceNumber || enriched.subject || enriched.source || "Фактура";
};

export const getImportDocumentSourceLabel = (document) =>
  sourceLabels[document.source] ?? document.source ?? "Поставщик";

export const getImportDocumentAmountLabel = (document) => {
  const amount = Number(document.amount);

  if (amount > 0) {
    return formatMoney(amount);
  }

  return "Сумма не указана в письме";
};

export const sortImportDocuments = (documents = []) =>
  [...documents]
    .map((document) => enrichImportDocument(document))
    .sort((first, second) => {
      const firstDate = first.invoiceDate || first.receivedAt || "";
      const secondDate = second.invoiceDate || second.receivedAt || "";
      return secondDate.localeCompare(firstDate);
    });

export const buildImportDocumentSearchText = (document) => {
  const enriched = enrichImportDocument(document);

  return [
    enriched.invoiceNumber,
    enriched.subject,
    enriched.summary,
    enriched.description,
    enriched.fromLabel,
    enriched.fromAddress,
    enriched.source,
    enriched.period,
    ...(enriched.attachments ?? []).map((file) => file.filename),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

export const matchesImportDocumentSearch = (document, search = "") => {
  const query = String(search).trim().toLowerCase();

  if (!query) {
    return true;
  }

  return buildImportDocumentSearchText(document).includes(query);
};

export const matchesImportDocumentSource = (document, source = "all") => {
  if (!source || source === "all") {
    return true;
  }

  return (document.source || "Прочее") === source;
};

export const matchesImportDocumentAmount = (
  document,
  amountFilter = IMPORT_DOCUMENT_AMOUNT_FILTERS.all,
) => {
  if (!amountFilter || amountFilter === IMPORT_DOCUMENT_AMOUNT_FILTERS.all) {
    return true;
  }

  const hasAmount = Number(document.amount) > 0;

  if (amountFilter === IMPORT_DOCUMENT_AMOUNT_FILTERS.withAmount) {
    return hasAmount;
  }

  if (amountFilter === IMPORT_DOCUMENT_AMOUNT_FILTERS.withoutAmount) {
    return !hasAmount;
  }

  return true;
};

export const getImportDocumentFilterDate = (document) => {
  const enriched = enrichImportDocument(document);
  const rawDate = enriched.invoiceDate || enriched.receivedAt || "";

  return parseAppDate(rawDate.slice(0, 10));
};

export const matchesImportDocumentPeriod = (
  document,
  periodFilter = IMPORT_DOCUMENT_PERIOD_FILTERS.all,
  today = new Date(),
) => {
  if (!periodFilter || periodFilter === IMPORT_DOCUMENT_PERIOD_FILTERS.all) {
    return true;
  }

  const date = getImportDocumentFilterDate(document);

  if (!date) {
    return false;
  }

  if (periodFilter === IMPORT_DOCUMENT_PERIOD_FILTERS.month) {
    return date >= startOfMonth(today) && date <= endOfMonth(today);
  }

  if (periodFilter === IMPORT_DOCUMENT_PERIOD_FILTERS.quarter) {
    return date >= startOfMonth(subMonths(today, 2)) && date <= endOfMonth(today);
  }

  if (periodFilter === IMPORT_DOCUMENT_PERIOD_FILTERS.year) {
    return date >= startOfYear(today) && date <= endOfMonth(today);
  }

  return true;
};

export const getImportDocumentSourceOptions = (documents = []) => {
  const counts = new Map();

  sortImportDocuments(documents).forEach((document) => {
    const source = document.source || "Прочее";
    counts.set(source, (counts.get(source) ?? 0) + 1);
  });

  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: getImportDocumentSourceLabel({source: value}),
      count,
    }))
    .sort((first, second) => first.label.localeCompare(second.label, "ru"));
};

export const hasActiveImportDocumentFilters = (filters = DEFAULT_IMPORT_DOCUMENT_FILTERS) =>
  Boolean(filters.search?.trim()) ||
  filters.source !== DEFAULT_IMPORT_DOCUMENT_FILTERS.source ||
  filters.amount !== DEFAULT_IMPORT_DOCUMENT_FILTERS.amount ||
  filters.period !== DEFAULT_IMPORT_DOCUMENT_FILTERS.period;

export const filterImportDocuments = (
  documents = [],
  filters = DEFAULT_IMPORT_DOCUMENT_FILTERS,
) =>
  sortImportDocuments(documents).filter(
    (document) =>
      matchesImportDocumentSearch(document, filters.search) &&
      matchesImportDocumentSource(document, filters.source) &&
      matchesImportDocumentAmount(document, filters.amount) &&
      matchesImportDocumentPeriod(document, filters.period),
  );

export const summarizeImportDocuments = (documents = []) => {
  const sorted = sortImportDocuments(documents);

  return {
    total: sorted.length,
    withAmount: sorted.filter((document) => Number(document.amount) > 0).length,
    amountTotal: sorted.reduce(
      (total, document) => total + (Number(document.amount) || 0),
      0,
    ),
    sources: new Set(sorted.map((document) => document.source)).size,
  };
};

export const getImportDocumentMetaRows = (document) => {
  const enriched = enrichImportDocument(document);
  const attachmentNames = (enriched.attachments ?? [])
    .map((file) => file.filename)
    .filter(Boolean);

  return [
    {
      label: "Дата фактуры",
      value: formatImportDocumentDate(enriched.invoiceDate),
    },
    {
      label: "Письмо получено",
      value: formatImportDocumentDateTime(enriched.receivedAt),
    },
    {
      label: "Сумма",
      value: getImportDocumentAmountLabel(enriched),
      highlight: Number(enriched.amount) > 0,
    },
    {
      label: "Отправитель",
      value: enriched.fromAddress
        ? `${enriched.fromLabel} · ${enriched.fromAddress}`
        : enriched.fromLabel || "—",
    },
    {
      label: "Вложения",
      value: attachmentNames.length ? attachmentNames.join(", ") : "—",
    },
    enriched.period
      ? {
          label: "Период",
          value: enriched.period,
        }
      : null,
  ].filter(Boolean);
};
