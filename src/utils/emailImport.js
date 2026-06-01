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

const normalize = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const getPhone = (text) =>
  text.match(/(?:\+?\d|\(\d{2,4}\))[\d\s()-]{6,}\d/)?.[0]?.trim() ?? "";

const getEmail = (text) =>
  text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] ?? "";

const getDateMatches = (text) =>
  [...text.matchAll(/(\d{1,2})\s+([a-zа-яąćęłńóśźżіїєґ]+)\s+(\d{4})/gi)]
    .map((match) => {
      const month = monthNumbers[normalize(match[2])];
      return month
        ? `${match[3]}-${month}-${String(match[1]).padStart(2, "0")}`
        : "";
    })
    .filter(Boolean);

const getTimeRanges = (text) =>
  [...text.matchAll(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/g)].map(
    (match) => ({start: match[1], end: match[2]}),
  );

const getDuration = (range) => {
  if (!range) return 60;
  const toMinutes = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };
  return Math.max(15, toMinutes(range.end) - toMinutes(range.start));
};

const getMoneyValues = (text) =>
  [...text.matchAll(/(\d[\d\s]*[.,]\d{2})\s*(?:zł|злотих)/gi)].map((match) =>
    Number(match[1].replace(/\s/g, "").replace(",", ".")),
  );

const resolveService = (text, services) =>
  services.find((service) => normalize(text).includes(normalize(service.name)));

const resolveMaster = (text, employees) => {
  const rawMaster =
    text.match(/(?:працівник|pracownik)\s*:\s*([^\n]+)/i)?.[1]?.trim() ?? "";
  const alias = employeeAliases[normalize(rawMaster)] ?? rawMaster;
  return employees.find((employee) => normalize(employee.name) === normalize(alias))?.name ?? alias;
};

const getName = (subject, text) => {
  const subjectName = subject.split(":")[0]?.trim();
  if (subjectName && !normalize(subjectName).includes("booksy")) return subjectName;

  return text.match(/^([A-ZА-ЯІЇЄŁŚŻŹĆŃÓ][^\n]{2,48})$/m)?.[1]?.trim() ?? "";
};

const createBooksyEvent = (email, services, employees, type) => {
  const dates = getDateMatches(email.text);
  const timeRanges = getTimeRanges(email.text);
  const currentRange = timeRanges.at(-1);
  const service = resolveService(email.text, services);
  const amountValues = getMoneyValues(email.text);
  const previousTime =
    email.text.match(/(?:попередня дата візиту|poprzednia data wizyty)[\s\S]{0,120}?(\d{1,2}:\d{2})/i)?.[1] ??
    "";

  return {
    id: email.id,
    type,
    source: "Booksy",
    subject: email.subject,
    receivedAt: email.receivedAt,
    client: {
      name: getName(email.subject, email.text),
      phone: getPhone(email.text),
      email: getEmail(email.text),
    },
    booking: {
      date: dates.at(-1) ?? "",
      previousDate: type === "booksy-reschedule" ? dates[0] ?? "" : "",
      time: currentRange?.start ?? "",
      previousTime:
        type === "booksy-reschedule"
          ? previousTime || timeRanges[0]?.start || ""
          : "",
      duration: getDuration(currentRange),
      service: service?.name ?? "",
      serviceId: service?.id ?? "",
      amount: amountValues[0] ?? 0,
      master: resolveMaster(email.text, employees),
      status: type === "booksy-confirmation" ? "confirmed" : "scheduled",
    },
  };
};

const createDocument = (email, source) => ({
  id: email.id,
  type: "document",
  source,
  subject: email.subject,
  amount: getMoneyValues(email.text).at(-1) ?? 0,
  receivedAt: email.receivedAt,
  attachments: email.attachments,
  gmailUrl: `https://mail.google.com/mail/u/0/#search/rfc822msgid:${encodeURIComponent(
    email.messageId ?? email.id,
  )}`,
});

const getSenderSource = (from) => {
  const domain = from.match(/@([a-z0-9.-]+)/i)?.[1] ?? "Поставщик";
  return domain.replace(/^mail\./, "").split(".")[0].toUpperCase();
};

export const parseImportedEmail = (email, services, employees) => {
  const sender = normalize(email.from);
  const text = normalize(`${email.subject}\n${email.text}`);
  const isBooksy = sender.includes("booksy") || text.includes("booksy");
  const hasPdf = email.attachments.some((attachment) =>
    attachment.filename.toLowerCase().endsWith(".pdf"),
  );

  if (isBooksy && (sender.includes("invoice@") || hasPdf && text.includes("faktur"))) {
    return createDocument(email, "Booksy");
  }

  if (sender.includes("allegro") && (hasPdf || text.includes("faktur") || text.includes("покупк"))) {
    return createDocument(email, "Allegro");
  }

  if ((sender.includes("ipos") || text.includes("ipos")) && (hasPdf || text.includes("faktur"))) {
    return createDocument(email, "iPOS");
  }

  if (
    hasPdf &&
    (text.includes("faktur") || text.includes("invoice") || text.includes("рахунок"))
  ) {
    return createDocument(email, getSenderSource(email.from));
  }

  if (!isBooksy) return null;
  if (text.includes("відгук") || text.includes("opini")) return null;
  if (text.includes("нове бронювання") || text.includes("nowa rezerwacja")) {
    return createBooksyEvent(email, services, employees, "booksy-booking");
  }
  if (text.includes("переніс") || text.includes("змінив") || text.includes("przełoży")) {
    return createBooksyEvent(email, services, employees, "booksy-reschedule");
  }
  if (text.includes("підтвердив") || text.includes("potwierdzi")) {
    return createBooksyEvent(email, services, employees, "booksy-confirmation");
  }

  return null;
};
