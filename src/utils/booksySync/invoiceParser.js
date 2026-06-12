import {
  getDateMatchesFromText,
  getMoneyValuesFromText,
  normalizeBooksyText,
} from "./booksyGmailParser.js";

const getSenderSource = (from) => {
  const domain = from.match(/@([a-z0-9.-]+)/i)?.[1] ?? "Поставщик";
  return domain.replace(/^mail\./, "").split(".")[0].toUpperCase();
};

export const parseEmailFromHeader = (from = "") => {
  const trimmed = String(from).trim();
  const wrapped = trimmed.match(/^(.+?)\s*<([^>]+)>$/);

  if (wrapped) {
    return {
      fromLabel: wrapped[1].replace(/^["']|["']$/g, "").trim(),
      fromAddress: wrapped[2].trim(),
    };
  }

  if (trimmed.includes("@")) {
    return {fromLabel: trimmed.split("@")[0], fromAddress: trimmed};
  }

  return {fromLabel: trimmed || "Неизвестный отправитель", fromAddress: ""};
};

export const extractInvoiceNumber = ({subject = "", text = "", attachments = []} = {}) => {
  const combined = `${subject}\n${text}`;

  const booksyNumber =
    combined.match(/\bFV\/[A-Z]+\/\d{4}\/\d{2}\/\d+\b/i)?.[0] ??
    combined.match(/\bFV\/[A-Z0-9/_-]{6,}\b/i)?.[0];
  if (booksyNumber) {
    return booksyNumber.toUpperCase();
  }

  const labeledNumber = combined.match(
    /(?:faktura|invoice|rachunek|numer)\s*(?:vat\s*)?(?:nr|no\.?|#|:)\s*([A-Z0-9][A-Z0-9/_-]{2,})/i,
  )?.[1];
  if (labeledNumber) {
    return labeledNumber.toUpperCase();
  }

  for (const attachment of attachments) {
    const filename = String(attachment.filename ?? "");
    const fromFilename =
      filename.match(/\bFV[A-Z0-9/_-]{6,}\b/i)?.[0] ??
      filename.match(/Faktura[_-]([A-Z0-9/_-]+)\.pdf/i)?.[1];
    if (fromFilename) {
      return fromFilename.replace(/\.pdf$/i, "").toUpperCase();
    }
  }

  const subjectTail = subject.match(/(?:faktura|invoice)\s+([A-Z0-9][A-Z0-9/_-]{4,})/i)?.[1];
  return subjectTail?.toUpperCase() ?? "";
};

export const extractInvoiceDate = ({
  subject = "",
  text = "",
  attachments = [],
  receivedAt = "",
} = {}) => {
  const combined = `${subject}\n${text}`;

  const booksyPeriod = combined.match(/\bFV\/[A-Z]+\/(\d{4})\/(\d{2})\/\d+\b/i);
  if (booksyPeriod) {
    return `${booksyPeriod[1]}-${booksyPeriod[2]}-01`;
  }

  const isoDate = combined.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)?.[0];
  if (isoDate) {
    return isoDate;
  }

  const dottedDate = combined.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
  if (dottedDate) {
    return `${dottedDate[3]}-${String(dottedDate[2]).padStart(2, "0")}-${String(dottedDate[1]).padStart(2, "0")}`;
  }

  for (const attachment of attachments) {
    const filename = String(attachment.filename ?? "");
    const monthToken = filename.match(/(?:^|[_-])(20\d{2})[-_](\d{2})(?:[_-]|\.)/i);
    if (monthToken) {
      return `${monthToken[1]}-${monthToken[2]}-01`;
    }
  }

  const textDates = getDateMatchesFromText(combined);
  if (textDates.length > 0) {
    return textDates.at(-1) ?? "";
  }

  if (receivedAt) {
    return receivedAt.slice(0, 10);
  }

  return "";
};

export const extractInvoicePeriod = ({text = "", subject = ""} = {}) => {
  const combined = `${subject}\n${text}`;

  return (
    combined.match(
      /(?:za okres|for period|w okresie)\s+([^\n.]{8,100})/i,
    )?.[1]?.trim() ??
    combined.match(/(\d{1,2}\s+[a-ząćęłńóśźż]+(?:\s+\d{4})?\s*[-–]\s*\d{1,2}\s+[a-ząćęłńóśźż]+(?:\s+\d{4})?)/i)?.[1]?.trim() ??
    ""
  );
};

export const extractInvoiceDescription = ({source = "", text = "", subject = ""} = {}) => {
  const combined = `${subject}\n${text}`.replace(/\s+/g, " ").trim();
  const period = extractInvoicePeriod({text, subject});

  if (period) {
    return `Период: ${period}`;
  }

  const sentence =
    combined.match(
      /(?:przesyłamy|twoja|w załączniku znajduje|faktura vat)[^.!\n]{0,120}\./i,
    )?.[0] ?? "";

  if (sentence) {
    return sentence.trim();
  }

  if (subject) {
    return subject.replace(/^(booksy\s*[-–:]\s*)?/i, "").trim();
  }

  return source ? `Фактура ${source}` : "Фактура";
};

export const extractInvoiceAmount = ({subject = "", text = ""} = {}) => {
  const values = getMoneyValuesFromText(`${subject}\n${text}`);
  return values.at(-1) ?? 0;
};

const buildDocumentFields = (email, source) => {
  const from = String(email.from ?? email.from_address ?? "");
  const subject = String(email.subject ?? "");
  const text = String(email.text ?? email.body_text ?? "");
  const attachments = email.attachments ?? [];
  const receivedAt = email.receivedAt ?? "";
  const {fromLabel, fromAddress} = parseEmailFromHeader(from);
  const meta = {subject, text, attachments, receivedAt, source};

  return {
    invoiceNumber: extractInvoiceNumber(meta),
    invoiceDate: extractInvoiceDate(meta),
    period: extractInvoicePeriod(meta),
    description: extractInvoiceDescription({...meta, source}),
    fromLabel,
    fromAddress,
    currency: "PLN",
  };
};

const createDocument = (email, source) => {
  const subject = String(email.subject ?? "");
  const text = String(email.text ?? email.body_text ?? "");
  const fields = buildDocumentFields(email, source);

  return {
    id: email.id,
    type: "document",
    source,
    subject,
    summary: fields.description,
    ...fields,
    amount: extractInvoiceAmount({subject, text}),
    receivedAt: email.receivedAt ?? "",
    attachments: email.attachments ?? [],
    gmailUrl: `https://mail.google.com/mail/u/0/#search/rfc822msgid:${encodeURIComponent(
      email.messageId ?? email.id,
    )}`,
  };
};

export const enrichImportDocument = (document = {}) => {
  if (!document || document.type !== "document") {
    return document;
  }

  const subject = String(document.subject ?? "");
  const text = String(document.summary ?? document.description ?? "");
  const attachments = document.attachments ?? [];
  const receivedAt = document.receivedAt ?? "";
  const source = document.source ?? "";
  const meta = {subject, text, attachments, receivedAt, source};
  const {fromLabel, fromAddress} = parseEmailFromHeader(
    document.fromAddress
      ? `${document.fromLabel ?? ""} <${document.fromAddress}>`.trim()
      : document.fromLabel ?? "",
  );

  return {
    ...document,
    summary: document.summary || extractInvoiceDescription({...meta, source}),
    description: document.description || extractInvoiceDescription({...meta, source}),
    invoiceNumber: document.invoiceNumber || extractInvoiceNumber(meta),
    invoiceDate: document.invoiceDate || extractInvoiceDate(meta),
    period: document.period || extractInvoicePeriod(meta),
    fromLabel: document.fromLabel || fromLabel,
    fromAddress: document.fromAddress || fromAddress,
    currency: document.currency || "PLN",
    amount:
      Number(document.amount) > 0
        ? Number(document.amount)
        : extractInvoiceAmount({subject, text: document.text ?? text}),
  };
};

export const parseImportDocument = (email) => {
  const from = String(email.from ?? email.from_address ?? "");
  const subject = String(email.subject ?? "");
  const text = String(email.text ?? email.body_text ?? "");
  const sender = normalizeBooksyText(from);
  const combined = normalizeBooksyText(`${subject}\n${text}`);
  const attachments = email.attachments ?? [];
  const hasPdf = attachments.some((attachment) =>
    String(attachment.filename ?? "").toLowerCase().endsWith(".pdf"),
  );
  const mentionsInvoice =
    combined.includes("faktur") ||
    combined.includes("invoice") ||
    combined.includes("рахунок") ||
    combined.includes("rachunek") ||
    combined.includes("vat");

  if (
    sender.includes("booksy") &&
    (sender.includes("invoice@") ||
      combined.includes("twoja faktura") ||
      (mentionsInvoice && !combined.includes("rezerwacja") && !combined.includes("бронювання")))
  ) {
    return createDocument(email, "Booksy");
  }

  if (sender.includes("allegro") && (hasPdf || mentionsInvoice || combined.includes("покупk"))) {
    return createDocument(email, "Allegro");
  }

  if (
    (sender.includes("ipos") || combined.includes("ipos")) &&
    (hasPdf || combined.includes("faktur"))
  ) {
    return createDocument(email, "iPOS");
  }

  if (hasPdf && mentionsInvoice) {
    return createDocument(email, getSenderSource(from));
  }

  if (mentionsInvoice && (combined.includes("groupon") || sender.includes("groupon"))) {
    return createDocument(email, "Groupon");
  }

  return null;
};
