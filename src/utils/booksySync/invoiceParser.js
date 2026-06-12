import {getMoneyValuesFromText, normalizeBooksyText} from "./booksyGmailParser.js";

const getSenderSource = (from) => {
  const domain = from.match(/@([a-z0-9.-]+)/i)?.[1] ?? "Поставщик";
  return domain.replace(/^mail\./, "").split(".")[0].toUpperCase();
};

const createDocument = (email, source) => ({
  id: email.id,
  type: "document",
  source,
  subject: email.subject,
  amount: getMoneyValuesFromText(`${email.subject}\n${email.text}`).at(-1) ?? 0,
  receivedAt: email.receivedAt,
  attachments: email.attachments ?? [],
  gmailUrl: `https://mail.google.com/mail/u/0/#search/rfc822msgid:${encodeURIComponent(
    email.messageId ?? email.id,
  )}`,
});

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

  if (sender.includes("booksy") && (sender.includes("invoice@") || (hasPdf && combined.includes("faktur")))) {
    return createDocument(email, "Booksy");
  }

  if (
    sender.includes("allegro") &&
    (hasPdf || combined.includes("faktur") || combined.includes("покупк"))
  ) {
    return createDocument(email, "Allegro");
  }

  if ((sender.includes("ipos") || combined.includes("ipos")) && (hasPdf || combined.includes("faktur"))) {
    return createDocument(email, "iPOS");
  }

  if (
    hasPdf &&
    (combined.includes("faktur") ||
      combined.includes("invoice") ||
      combined.includes("рахунок") ||
      combined.includes("rachunek"))
  ) {
    return createDocument(email, getSenderSource(from));
  }

  return null;
};
