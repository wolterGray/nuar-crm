import {matchesClientRecord} from "./clientLinks.js";

export const DEFAULT_MESSAGE_LANGUAGE = "Польский";

export const MESSAGE_LANGUAGES = [
  "Русский",
  "Польский",
  "Английский",
  "Украинский",
];

export const MESSAGE_TEMPLATE_PURPOSES = {
  general: {
    label: "Обычный (ручная отправка)",
    legacySetting: "",
  },
  "sms-reminder-24h": {
    label: "SMS за 24 часа",
    legacySetting: "smsReminder24hTemplate",
  },
  "sms-reminder-2h": {
    label: "SMS за 2 часа",
    legacySetting: "smsReminder2hTemplate",
  },
  "review-request": {
    label: "SMS с просьбой об отзыве",
    legacySetting: "reviewRequestTemplate",
  },
  "inactive-14d": {
    label: "SMS: клиент не был 14 дней",
    legacySetting: "inactiveFollowUp14Template",
  },
  "inactive-30d": {
    label: "SMS: клиент не был 30 дней",
    legacySetting: "inactiveFollowUp30Template",
  },
  "inactive-60d": {
    label: "SMS: клиент не был 60 дней",
    legacySetting: "inactiveFollowUp60Template",
  },
  "waitlist-offer": {
    label: "SMS: предложение слота из листа ожидания",
    legacySetting: "waitlistOfferTemplate",
  },
};

const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е");

export const getMessageTemplatePurposeLabel = (purpose) =>
  MESSAGE_TEMPLATE_PURPOSES[purpose]?.label ??
  MESSAGE_TEMPLATE_PURPOSES.general.label;

export const resolveClientMessageLanguage = (client) => {
  const explicit = String(client?.messageLanguage ?? "").trim();

  if (MESSAGE_LANGUAGES.includes(explicit)) {
    return explicit;
  }

  const tags = normalizeText(client?.tags);

  if (tags.includes("english") || tags.includes("англ")) {
    return "Английский";
  }

  if (tags.includes("ukrain") || tags.includes("укр")) {
    return "Украинский";
  }

  if (tags.includes("polish") || tags.includes("polski") || tags.includes("поляк")) {
    return "Польский";
  }

  if (tags.includes("russian") || tags.includes("рус")) {
    return "Русский";
  }

  return DEFAULT_MESSAGE_LANGUAGE;
};

export const resolveLinkedClient = (entry, clientProfiles = []) =>
  clientProfiles.find(
    (client) =>
      (entry?.clientId && String(client.id) === String(entry.clientId)) ||
      matchesClientRecord(entry, clientProfiles, client),
  ) ?? null;

export const resolveMessageTemplateBody = ({
  defaultTemplate = "",
  language = DEFAULT_MESSAGE_LANGUAGE,
  legacyTemplate = "",
  messageTemplates = [],
  purpose = "general",
}) => {
  const smsTemplates = (messageTemplates ?? []).filter(
    (template) =>
      template?.channel === "SMS" &&
      String(template?.purpose ?? "general") === purpose &&
      String(template?.body ?? "").trim(),
  );

  const exactMatch = smsTemplates.find(
    (template) => template.language === language,
  );

  if (exactMatch?.body) {
    return String(exactMatch.body).trim();
  }

  const polishFallback = smsTemplates.find(
    (template) => template.language === DEFAULT_MESSAGE_LANGUAGE,
  );

  if (polishFallback?.body) {
    return String(polishFallback.body).trim();
  }

  if (smsTemplates[0]?.body) {
    return String(smsTemplates[0].body).trim();
  }

  const legacy = String(legacyTemplate ?? "").trim();

  if (legacy) {
    return legacy;
  }

  return String(defaultTemplate ?? "").trim();
};

export const buildDefaultAutomatedMessageTemplates = () => [
  {
    id: "auto-sms-24h-pl",
    name: "Przypomnienie 24h",
    channel: "SMS",
    language: "Польский",
    audience: "Все",
    purpose: "sms-reminder-24h",
    subject: "",
    body: "Dzien dobry, {name}! Przypominamy o wizycie w {studio} jutro {date} o {time}. {service}",
  },
  {
    id: "auto-sms-24h-ru",
    name: "Напоминание 24ч",
    channel: "SMS",
    language: "Русский",
    audience: "Все",
    purpose: "sms-reminder-24h",
    subject: "",
    body: "Здравствуйте, {name}! Напоминаем о визите в {studio} завтра {date} в {time}. {service}",
  },
  {
    id: "auto-sms-24h-en",
    name: "Reminder 24h",
    channel: "SMS",
    language: "Английский",
    audience: "Все",
    purpose: "sms-reminder-24h",
    subject: "",
    body: "Hello, {name}! This is a reminder about your visit at {studio} tomorrow {date} at {time}. {service}",
  },
  {
    id: "auto-sms-2h-pl",
    name: "Przypomnienie 2h",
    channel: "SMS",
    language: "Польский",
    audience: "Все",
    purpose: "sms-reminder-2h",
    subject: "",
    body: "Dzien dobry, {name}! Za 2 godziny czekamy na Ciebie w {studio} o {time}. {master}",
  },
  {
    id: "auto-sms-2h-ru",
    name: "Напоминание 2ч",
    channel: "SMS",
    language: "Русский",
    audience: "Все",
    purpose: "sms-reminder-2h",
    subject: "",
    body: "Здравствуйте, {name}! Через 2 часа ждём вас в {studio} в {time}. Мастер: {master}",
  },
  {
    id: "auto-sms-2h-en",
    name: "Reminder 2h",
    channel: "SMS",
    language: "Английский",
    audience: "Все",
    purpose: "sms-reminder-2h",
    subject: "",
    body: "Hello, {name}! We are expecting you at {studio} in 2 hours, at {time}. {master}",
  },
  {
    id: "auto-review-pl",
    name: "Prośba o opinię",
    channel: "SMS",
    language: "Польский",
    audience: "Все",
    purpose: "review-request",
    subject: "",
    body: "Dziekujemy za wizyte w {studio}, {name}! Bedziemy wdzieczni za opinie: {reviewUrl}",
  },
  {
    id: "auto-review-ru",
    name: "Просьба об отзыве",
    channel: "SMS",
    language: "Русский",
    audience: "Все",
    purpose: "review-request",
    subject: "",
    body: "Спасибо за визит в {studio}, {name}! Будем благодарны за отзыв: {reviewUrl}",
  },
  {
    id: "auto-review-en",
    name: "Review request",
    channel: "SMS",
    language: "Английский",
    audience: "Все",
    purpose: "review-request",
    subject: "",
    body: "Thank you for visiting {studio}, {name}! We would appreciate your review: {reviewUrl}",
  },
  {
    id: "auto-inactive-14-pl",
    name: "Follow-up 14 dni",
    channel: "SMS",
    language: "Польский",
    audience: "Все",
    purpose: "inactive-14d",
    subject: "",
    body: "Czesc {name}! Tesknilismy za Toba w {studio}. Minely juz {days} dni od ostatniej wizyty. Chetnie pomozemy zarezerwowac termin.",
  },
  {
    id: "auto-inactive-14-ru",
    name: "Follow-up 14 дней",
    channel: "SMS",
    language: "Русский",
    audience: "Все",
    purpose: "inactive-14d",
    subject: "",
    body: "Здравствуйте, {name}! Давно не видели вас в {studio}. Прошло {days} дней с последнего визита. Поможем записаться.",
  },
  {
    id: "auto-inactive-30-pl",
    name: "Follow-up 30 dni",
    channel: "SMS",
    language: "Польский",
    audience: "Все",
    purpose: "inactive-30d",
    subject: "",
    body: "Czesc {name}! W {studio} pamietamy o Tobie. Minelo juz {days} dni bez wizyty - odezwij sie, ustalimy dogodny termin.",
  },
  {
    id: "auto-inactive-30-ru",
    name: "Follow-up 30 дней",
    channel: "SMS",
    language: "Русский",
    audience: "Все",
    purpose: "inactive-30d",
    subject: "",
    body: "Здравствуйте, {name}! В {studio} мы о вас помним. Прошло {days} дней без визита — напишите, подберём время.",
  },
  {
    id: "auto-inactive-60-pl",
    name: "Follow-up 60 dni",
    channel: "SMS",
    language: "Польский",
    audience: "Все",
    purpose: "inactive-60d",
    subject: "",
    body: "Czesc {name}! Czekamy na Ciebie w {studio}. Minelo {days} dni od ostatniej wizyty - wroc do regularnych masazy u nas.",
  },
  {
    id: "auto-inactive-60-ru",
    name: "Follow-up 60 дней",
    channel: "SMS",
    language: "Русский",
    audience: "Все",
    purpose: "inactive-60d",
    subject: "",
    body: "Здравствуйте, {name}! Ждём вас в {studio}. Прошло {days} дней с последнего визита — вернитесь к регулярным массажам.",
  },
  {
    id: "auto-waitlist-pl",
    name: "Wolny termin",
    channel: "SMS",
    language: "Польский",
    audience: "Все",
    purpose: "waitlist-offer",
    subject: "",
    body: "Czesc {name}! W {studio} zwolnil sie termin {date} o {time} u {master} ({service}). Chetnie zarezerwujemy go dla Ciebie.",
  },
  {
    id: "auto-waitlist-ru",
    name: "Свободный слот",
    channel: "SMS",
    language: "Русский",
    audience: "Все",
    purpose: "waitlist-offer",
    subject: "",
    body: "Здравствуйте, {name}! В {studio} освободилось время {date} в {time}, мастер {master} ({service}). Запишем вас?",
  },
  {
    id: "auto-waitlist-en",
    name: "Open slot",
    channel: "SMS",
    language: "Английский",
    audience: "Все",
    purpose: "waitlist-offer",
    subject: "",
    body: "Hello, {name}! A slot opened at {studio} on {date} at {time} with {master} ({service}). Shall we book it for you?",
  },
];

export const mergeAutomatedMessageTemplates = (templates = []) => {
  const current = Array.isArray(templates) ? templates : [];
  const defaults = buildDefaultAutomatedMessageTemplates();
  const missing = defaults.filter(
    (template) =>
      !current.some(
        (item) =>
          String(item?.purpose ?? "general") === template.purpose &&
          item.language === template.language,
      ),
  );

  return missing.length ? [...current, ...missing] : current;
};

export const resolveAutomatedMessageTemplate = ({
  appSettings = {},
  client = null,
  defaultTemplate = "",
  messageTemplates = [],
  purpose,
}) => {
  const legacySetting = MESSAGE_TEMPLATE_PURPOSES[purpose]?.legacySetting;
  const legacyTemplate = legacySetting
    ? String(appSettings?.[legacySetting] ?? "")
    : "";

  return resolveMessageTemplateBody({
    defaultTemplate,
    language: resolveClientMessageLanguage(client),
    legacyTemplate,
    messageTemplates,
    purpose,
  });
};
