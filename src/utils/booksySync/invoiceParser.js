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

  if (sender.includes("allegro") && (hasPdf || mentionsInvoice || combined.includes("покупк"))) {
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
