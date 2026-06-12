import {formatAppDate, parseAppDate} from "../dateUtils.js";
import {formatMoney} from "../formatters.jsx";
import {enrichImportDocument} from "./invoiceParser.js";

const sourceLabels = {
  Booksy: "Booksy",
  Allegro: "Allegro",
  iPOS: "iPOS",
  Groupon: "Groupon",
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
