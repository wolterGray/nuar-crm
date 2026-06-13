const DEFAULT_MESSAGE_LANGUAGE = "Польский";

const MESSAGE_LANGUAGES = ["Русский", "Польский", "Английский", "Украинский"];

const MESSAGE_TEMPLATE_PURPOSES: Record<string, {legacySetting?: string}> = {
  general: {},
  "sms-reminder-24h": {legacySetting: "smsReminder24hTemplate"},
  "sms-reminder-2h": {legacySetting: "smsReminder2hTemplate"},
  "review-request": {legacySetting: "reviewRequestTemplate"},
  "inactive-14d": {legacySetting: "inactiveFollowUp14Template"},
  "inactive-30d": {legacySetting: "inactiveFollowUp30Template"},
  "inactive-60d": {legacySetting: "inactiveFollowUp60Template"},
  "waitlist-offer": {legacySetting: "waitlistOfferTemplate"},
};

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е");

type ClientProfile = {
  messageLanguage?: string;
  tags?: string;
};

type MessageTemplate = {
  body?: string;
  channel?: string;
  language?: string;
  purpose?: string;
};

export const resolveClientMessageLanguage = (client: ClientProfile | null) => {
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

export const resolveMessageTemplateBody = ({
  defaultTemplate = "",
  language = DEFAULT_MESSAGE_LANGUAGE,
  legacyTemplate = "",
  messageTemplates = [],
  purpose = "general",
}: {
  defaultTemplate?: string;
  language?: string;
  legacyTemplate?: string;
  messageTemplates?: MessageTemplate[];
  purpose?: string;
}) => {
  const smsTemplates = (messageTemplates ?? []).filter(
    (template) =>
      template?.channel === "SMS" &&
      String(template?.purpose ?? "general") === purpose &&
      String(template?.body ?? "").trim(),
  );

  const exactMatch = smsTemplates.find((template) => template.language === language);

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

export const resolveAutomatedMessageTemplate = ({
  appSettings = {},
  client = null,
  defaultTemplate = "",
  messageTemplates = [],
  purpose,
}: {
  appSettings?: Record<string, unknown>;
  client?: ClientProfile | null;
  defaultTemplate?: string;
  messageTemplates?: MessageTemplate[];
  purpose: string;
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
