const monthNumbers: Record<string, string> = {
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

const employeeAliases: Record<string, string> = {
  helga: "Ольга",
  olha: "Ольга",
  ольга: "Ольга",
  max: "Максим",
  максим: "Максим",
};

export const BOOKSY_GMAIL_QUERY =
  "newer_than:30d (from:booksy OR subject:Booksy) (appointment OR booking OR reservation OR wizyta OR rezerwacja OR cancelled OR changed OR rescheduled OR anulowana OR zmieniona OR potwierdzi OR nowa)";

export type ParsedBooksyEvent = {
  source: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  service_name: string;
  staff_name: string;
  appointment_date: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number;
  price: number | null;
  currency: string;
  status: "new" | "changed" | "cancelled" | "confirmed";
  client_note: string;
  missing_fields: string[];
  confidence_score: number;
};

const normalizeBooksyText = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const getPhoneFromText = (text: string) =>
  text.match(/(?:\+?\d|\(\d{2,4}\))[\d\s()-]{6,}\d/)?.[0]?.trim() ?? "";

const getEmailFromText = (text: string) =>
  text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] ?? "";

const getDateMatchesFromText = (text: string) =>
  [...text.matchAll(/(\d{1,2})\s+([a-zа-яąćęłńóśźżіїєґ]+)\s+(\d{4})/gi)]
    .map((match) => {
      const month = monthNumbers[normalizeBooksyText(match[2])];
      return month
        ? `${match[3]}-${month}-${String(match[1]).padStart(2, "0")}`
        : "";
    })
    .filter(Boolean);

const getTimeRangesFromText = (text: string) =>
  [...text.matchAll(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/g)].map(
    (match) => ({start: match[1], end: match[2]}),
  );

const getDurationFromRange = (range?: {start: string; end: string}) => {
  if (!range) return 60;
  const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };
  return Math.max(15, toMinutes(range.end) - toMinutes(range.start));
};

const getMoneyValuesFromText = (text: string) =>
  [...text.matchAll(/(\d[\d\s]*[.,]\d{2})\s*(?:zł|злотих|pln)/gi)].map(
    (match) => Number(match[1].replace(/\s/g, "").replace(",", ".")),
  );

const resolveServiceName = (
  text: string,
  services: Array<{name?: string}> = [],
) =>
  services.find((service) =>
    normalizeBooksyText(text).includes(normalizeBooksyText(service.name)),
  )?.name ?? "";

const resolveStaffName = (
  text: string,
  employees: Array<{name?: string}> = [],
) => {
  const rawMaster =
    text.match(/(?:працівник|pracownik|employee|staff)\s*:\s*([^\n]+)/i)?.[1]
      ?.trim() ?? "";
  const alias = employeeAliases[normalizeBooksyText(rawMaster)] ?? rawMaster;
  return (
    employees.find(
      (employee) =>
        normalizeBooksyText(employee.name) === normalizeBooksyText(alias),
    )?.name ?? alias
  );
};

const getClientNameFromEmail = (subject: string, text: string) => {
  const subjectName = subject.split(":")[0]?.trim();
  if (subjectName && !normalizeBooksyText(subjectName).includes("booksy")) {
    return subjectName;
  }

  return text.match(/^([A-ZА-ЯІЇЄŁŚŻŹĆŃÓ][^\n]{2,48})$/m)?.[1]?.trim() ?? "";
};

const getClientNoteFromText = (text: string) =>
  text.match(/(?:коментар|komentarz|note|uwagi)\s*:\s*([^\n]+)/i)?.[1]?.trim() ??
  "";

const detectBooksyEventType = (
  text: string,
): ParsedBooksyEvent["status"] => {
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

  return "new";
};

export const isBooksyGmailMessage = ({
  from = "",
  subject = "",
  bodyText = "",
}: {
  from?: string;
  subject?: string;
  bodyText?: string;
}) => normalizeBooksyText(`${from}\n${subject}\n${bodyText}`).includes("booksy");

const shouldSkipBooksyMessage = (text: string) =>
  text.includes("відгук") ||
  text.includes("opini") ||
  (text.includes("faktur") && text.includes("invoice@"));

const buildMissingFields = (event: Partial<ParsedBooksyEvent>) => {
  const missing: string[] = [];
  if (!event.client_name) missing.push("client_name");
  if (!event.appointment_date) missing.push("appointment_date");
  if (!event.start_time) missing.push("start_time");
  if (!event.staff_name) missing.push("staff_name");
  if (!event.service_name) missing.push("service_name");
  return missing;
};

export const scoreExtractionConfidence = (event: Partial<ParsedBooksyEvent>) => {
  const weights: Record<string, number> = {
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
    if (event[field as keyof ParsedBooksyEvent]) score += weight;
  });
  if (event.duration_minutes) score += 5;
  if (event.price) score += 5;
  return Math.max(0, Math.min(100, score));
};

export const isAppointmentDateInSyncWindow = (appointmentDate: string | null) => {
  if (!appointmentDate) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 90);

  const parsed = new Date(`${appointmentDate}T00:00:00`);
  return parsed >= today && parsed <= maxDate;
};

export const parseBooksyGmailMessage = (
  message: {
    subject?: string;
    body_text?: string;
    from_address?: string;
    from?: string;
  },
  {employees = [], services = []}: {
    employees?: Array<{name?: string}>;
    services?: Array<{name?: string}>;
  } = {},
): ParsedBooksyEvent | null => {
  const subject = String(message.subject ?? "");
  const bodyText = String(message.body_text ?? "");
  const from = String(message.from_address ?? message.from ?? "");
  const combined = `${subject}\n${bodyText}`;

  if (!isBooksyGmailMessage({from, subject, bodyText})) return null;

  const normalized = normalizeBooksyText(combined);
  if (shouldSkipBooksyMessage(normalized)) return null;

  const dates = getDateMatchesFromText(combined);
  const timeRanges = getTimeRangesFromText(combined);
  const currentRange = timeRanges.at(-1);
  const eventStatus = detectBooksyEventType(normalized);
  const serviceName =
    resolveServiceName(combined, services) ||
    combined.match(/(?:usługa|service|послуга)\s*:\s*([^\n]+)/i)?.[1]?.trim() ||
    "";

  const extracted: ParsedBooksyEvent = {
    source: "booksy_gmail",
    client_name: getClientNameFromEmail(subject, combined),
    client_phone: getPhoneFromText(combined),
    client_email: getEmailFromText(combined),
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
    missing_fields: [],
    confidence_score: 0,
  };

  extracted.missing_fields = buildMissingFields(extracted);
  extracted.confidence_score = scoreExtractionConfidence(extracted);

  return extracted;
};

export const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
};

export const extractGmailBodies = (payload: Record<string, unknown>) => {
  let bodyText = "";
  let bodyHtml = "";

  const walk = (part: Record<string, unknown>) => {
    const mimeType = String(part.mimeType ?? "");
    const body = part.body as {data?: string} | undefined;
    const data = body?.data ? decodeBase64Url(body.data) : "";

    if (mimeType === "text/plain" && data) bodyText += `${data}\n`;
    if (mimeType === "text/html" && data) bodyHtml += data;

    const parts = part.parts as Array<Record<string, unknown>> | undefined;
    parts?.forEach(walk);
  };

  walk(payload);
  return {bodyText: bodyText.trim(), bodyHtml};
};

export const getGmailHeader = (
  headers: Array<{name?: string; value?: string}> = [],
  name: string,
) => headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
