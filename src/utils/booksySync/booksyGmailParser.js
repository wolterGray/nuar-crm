const monthNumbers = {
  січня: "01",
  stycznia: "01",
  лютого: "02",
  lutego: "02",
  березня: "03",
  marca: "03",
  квітня: "04",
  kwietnia: "04",
  травня: "05",
  maja: "05",
  червня: "06",
  czerwca: "06",
  липня: "07",
  lipca: "07",
  серпня: "08",
  sierpnia: "08",
  вересня: "09",
  września: "09",
  жовтня: "10",
  października: "10",
  листопада: "11",
  listopada: "11",
  грудня: "12",
  grudnia: "12",
};

const employeeAliases = {
  helga: "Ольга",
  olha: "Ольга",
  ольга: "Ольга",
  max: "Максим",
  максим: "Максим",
};

export const BOOKSY_GMAIL_QUERY = "newer_than:365d from:booksy.com";

/** Один запрос — fallback; основной поиск идёт несколькими узкими запросами (см. GMAIL_SYNC_QUERIES). */
export const GMAIL_SYNC_QUERY = BOOKSY_GMAIL_QUERY;

export const GMAIL_SYNC_QUERIES = [
  "newer_than:365d from:booksy.com",
  "newer_than:365d from:allegro.pl",
  "newer_than:365d (from:ipos.pl OR subject:ipos)",
  "newer_than:365d subject:(faktura OR faktur OR invoice OR \"twoja faktura\" OR \"faktura VAT\")",
];

export const normalizeBooksyText = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[''ʼ`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const ignoredEmailPattern =
  /(?:no-?reply|noreply|donotreply|booksy|lavandi|nuar)@/i;

export const getClientEmailFromMessage = ({
  replyTo = "",
  from = "",
  bodyText = "",
} = {}) => {
  const candidates = [
    ...String(replyTo).matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi),
    ...String(bodyText).matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi),
    ...String(from).matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi),
  ].map((match) => match[0]);

  return (
    candidates.find((email) => !ignoredEmailPattern.test(email)) ?? ""
  );
};

export const getPhoneFromText = (text) =>
  text.match(/(?:\+?\d|\(\d{2,4}\))[\d\s()-]{6,}\d/)?.[0]?.trim() ?? "";

export const getEmailFromText = (text) =>
  text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] ?? "";

export const getDateMatchesFromText = (text) =>
  [
    ...text.matchAll(
      /(\d{1,2})\s+([a-zа-яąćęłńóśźżіїєґ]+)\s+(\d{4})(?:\s*(?:r\.|р\.|rok))?/gi,
    ),
  ]
    .map((match) => {
      const month = monthNumbers[normalizeBooksyText(match[2])];
      return month
        ? `${match[3]}-${month}-${String(match[1]).padStart(2, "0")}`
        : "";
    })
    .filter(Boolean);

export const getTimeRangesFromText = (text) =>
  [...text.matchAll(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/g)].map(
    (match) => ({start: match[1], end: match[2]}),
  );

export const getAppointmentTimeFromText = (text) => {
  const ranges = getTimeRangesFromText(text);
  if (ranges.length > 0) {
    return ranges.at(-1) ?? null;
  }

  const singleTime =
    text.match(/(?:^|[\s,.])(?:o|о|at|godz\.?|r\.?\s*o)\s*(\d{1,2}:\d{2})/i)?.[1] ??
    text.match(/\b(\d{1,2}:\d{2})\b/)?.[1];

  if (!singleTime) {
    return null;
  }

  return {start: singleTime, end: null};
};

export const getDurationFromRange = (range) => {
  if (!range?.end) {
    return 60;
  }

  const toMinutes = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  return Math.max(15, toMinutes(range.end) - toMinutes(range.start));
};

export const getMoneyValuesFromText = (text) =>
  [...text.matchAll(/(\d[\d\s]*[.,]\d{2})\s*(?:zł|злотих|pln)/gi)].map(
    (match) => Number(match[1].replace(/\s/g, "").replace(",", ".")),
  );

export const resolveServiceName = (text, services = []) =>
  services.find((service) =>
    normalizeBooksyText(text).includes(normalizeBooksyText(service.name)),
  )?.name ?? "";

export const resolveStaffName = (text, employees = []) => {
  const rawMaster =
    text.match(/(?:працівник|pracownik|employee|staff)\s*:\s*([^\n]+)/i)?.[1]?.trim() ??
    "";
  const alias = employeeAliases[normalizeBooksyText(rawMaster)] ?? rawMaster;
  return (
    employees.find(
      (employee) =>
        normalizeBooksyText(employee.name) === normalizeBooksyText(alias),
    )?.name ?? alias
  );
};

export const getClientNameFromEmail = (subject, text) => {
  const subjectName = subject.split(":")[0]?.trim();
  if (subjectName && !normalizeBooksyText(subjectName).includes("booksy")) {
    return subjectName;
  }

  return text.match(/^([A-ZА-ЯІЇЄŁŚŻŹĆŃÓ][^\n]{2,48})$/m)?.[1]?.trim() ?? "";
};

export const getClientNoteFromText = (text) =>
  text.match(/(?:коментар|komentarz|note|uwagi)\s*:\s*([^\n]+)/i)?.[1]?.trim() ??
  "";

const detectBooksyEventType = (text) => {
  if (
    text.includes("anulow") ||
    text.includes("cancel") ||
    text.includes("odwoł") ||
    text.includes("скасов")
  ) {
    return "cancelled";
  }

  if (
    text.includes("переніс") ||
    text.includes("змінив") ||
    text.includes("przełoży") ||
    text.includes("zmienion") ||
    text.includes("reschedul")
  ) {
    return "changed";
  }

  if (text.includes("підтвердив") || text.includes("potwierdzi")) {
    return "confirmed";
  }

  if (
    text.includes("нове бронювання") ||
    text.includes("nowa rezerwacja") ||
    text.includes("new booking")
  ) {
    return "new";
  }

  return "new";
};

export const isBooksyGmailMessage = ({from = "", subject = "", bodyText = ""}) => {
  const haystack = normalizeBooksyText(`${from}\n${subject}\n${bodyText}`);
  return haystack.includes("booksy") || haystack.includes("booksy.com");
};

export const isBooksyInvoiceMessage = ({from = "", subject = "", bodyText = ""} = {}) => {
  const haystack = normalizeBooksyText(`${from}\n${subject}\n${bodyText}`);
  if (!haystack.includes("booksy")) {
    return false;
  }

  return (
    haystack.includes("invoice@") ||
    haystack.includes("twoja faktura") ||
    haystack.includes("fakturę vat") ||
    haystack.includes("faktura vat") ||
    (haystack.includes("faktur") &&
      !haystack.includes("rezerwacja") &&
      !haystack.includes("бронювання") &&
      !haystack.includes("booking"))
  );
};

export const shouldSkipBooksyMessage = (text) =>
  text.includes("відгук") ||
  text.includes("opini") ||
  isBooksyInvoiceMessage({subject: text, bodyText: text});

const buildMissingFields = (event) => {
  const missing = [];

  if (!event.client_name) missing.push("client_name");
  if (!event.appointment_date) missing.push("appointment_date");
  if (!event.start_time) missing.push("start_time");
  if (!event.staff_name) missing.push("staff_name");
  if (!event.service_name) missing.push("service_name");

  return missing;
};

export const scoreExtractionConfidence = (event) => {
  const weights = {
    client_name: 18,
    client_phone: 10,
    client_email: 8,
    service_name: 18,
    staff_name: 16,
    appointment_date: 18,
    start_time: 12,
  };

  let score = 0;

  Object.entries(weights).forEach(([field, weight]) => {
    if (event[field]) {
      score += weight;
    }
  });

  if (event.duration_minutes) score += 5;
  if (event.price) score += 5;

  return Math.max(0, Math.min(100, score));
};

export const parseBooksyGmailMessage = (
  message,
  {employees = [], services = []} = {},
) => {
  const subject = String(message.subject ?? "");
  const bodyText = String(message.body_text ?? message.text ?? "");
  const from = String(message.from_address ?? message.from ?? "");
  const replyTo = String(message.reply_to ?? message.replyTo ?? "");
  const combined = `${subject}\n${bodyText}`;

  if (!isBooksyGmailMessage({from, subject, bodyText})) {
    return null;
  }

  const normalized = normalizeBooksyText(combined);

  if (shouldSkipBooksyMessage(normalized)) {
    return null;
  }

  const dates = getDateMatchesFromText(`${subject}\n${bodyText}`);
  const currentRange = getAppointmentTimeFromText(`${subject}\n${bodyText}`);
  const eventStatus = detectBooksyEventType(normalized);
  const serviceName =
    resolveServiceName(combined, services) ||
    combined.match(/(?:usługa|service|послуга)\s*:\s*([^\n]+)/i)?.[1]?.trim() ||
    "";

  const extracted = {
    source: "booksy_gmail",
    client_name: getClientNameFromEmail(subject, combined),
    client_phone: getPhoneFromText(combined),
    client_email: getClientEmailFromMessage({replyTo, from, bodyText: combined}),
    service_name: serviceName,
    staff_name: resolveStaffName(combined, employees),
    appointment_date: dates.at(-1) || null,
    start_time: currentRange?.start || null,
    end_time: currentRange?.end || null,
    duration_minutes: getDurationFromRange(currentRange),
    price: getMoneyValuesFromText(combined)[0] ?? null,
    currency: "PLN",
    status: eventStatus,
    client_note: getClientNoteFromText(combined),
  };

  extracted.missing_fields = buildMissingFields(extracted);
  extracted.confidence_score = scoreExtractionConfidence(extracted);

  return extracted;
};

export const extractedEventToLegacyImportItem = (extracted, messageMeta = {}) => {
  const service = messageMeta.services?.find(
    (item) => normalizeBooksyText(item.name) === normalizeBooksyText(extracted.service_name),
  );

  return {
    id: messageMeta.gmail_message_id ?? messageMeta.id,
    type:
      extracted.status === "changed"
        ? "booksy-reschedule"
        : extracted.status === "confirmed"
          ? "booksy-confirmation"
          : extracted.status === "cancelled"
            ? "booksy-cancel"
            : "booksy-booking",
    source: "Booksy",
    subject: messageMeta.subject ?? "",
    receivedAt: messageMeta.received_at ?? messageMeta.receivedAt ?? "",
    client: {
      name: extracted.client_name,
      phone: extracted.client_phone,
      email: extracted.client_email,
    },
    booking: {
      date: extracted.appointment_date ?? "",
      previousDate: extracted.status === "changed" ? extracted.appointment_date ?? "" : "",
      time: extracted.start_time ?? "",
      previousTime: "",
      duration: extracted.duration_minutes ?? 60,
      service: extracted.service_name,
      serviceId: service?.id ?? "",
      amount: extracted.price ?? 0,
      master: extracted.staff_name,
      status:
        extracted.status === "cancelled"
          ? "cancelled"
          : extracted.status === "confirmed"
            ? "confirmed"
            : "scheduled",
      note: extracted.client_note ?? "",
    },
    extractedEventId: messageMeta.extracted_event_id ?? null,
    confidenceScore: extracted.confidence_score,
    missingFields: extracted.missing_fields,
  };
};
