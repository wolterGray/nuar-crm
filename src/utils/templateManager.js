import {toDisplayDate} from "./formatters.jsx";

export const TEMPLATE_CATEGORIES = [
  {id: "all", label: "Все", shortLabel: "Все", icon: "messageText"},
  {id: "booking_confirmation", label: "Запись и подтверждение", shortLabel: "Запись", icon: "calendarClock"},
  {id: "reminders", label: "Напоминания", shortLabel: "Напоминания", icon: "bell"},
  {id: "reschedule_cancel", label: "Перенос и отмена", shortLabel: "Перенос", icon: "calendarRange"},
  {id: "post_visit", label: "После визита", shortLabel: "Отзывы", icon: "sparkles"},
  {id: "reactivation", label: "Возвращение клиентов", shortLabel: "Возврат", icon: "rotateCcw"},
  {id: "promotions", label: "Предложения и акции", shortLabel: "Акции", icon: "gift"},
  {id: "other", label: "Прочее", shortLabel: "Прочее", icon: "message"},
];

export const TEMPLATE_LANGUAGES = [
  {code: "pl", label: "PL", name: "Польский"},
  {code: "ru", label: "RU", name: "Русский"},
  {code: "ua", label: "UA", name: "Украинский"},
  {code: "en", label: "EN", name: "Английский"},
];

export const DYNAMIC_VARIABLES = [
  {key: "{client_name}", label: "Имя клиента", sample: "Анна", hint: "Имя клиента"},
  {key: "{appointment_date}", label: "Дата записи", sample: "24.10.2026", hint: "Дата визита"},
  {key: "{appointment_time}", label: "Время записи", sample: "14:30", hint: "Время начала"},
  {key: "{service_name}", label: "Услуга", sample: "Masaż relaksacyjny całego ciała", hint: "Название услуги"},
  {key: "{master_name}", label: "Мастер", sample: "Natali", hint: "Имя массажиста"},
  {key: "{duration}", label: "Длительность", sample: "60 мин", hint: "Продолжительность сеанса"},
  {key: "{price}", label: "Стоимость", sample: "220 zł", hint: "Стоимость процедуры"},
  {key: "{studio_address}", label: "Адрес студии", sample: "Warszawa, ul. Złota 44", hint: "Адрес массажной студии"},
  {key: "{studio_name}", label: "Студия", sample: "NUAR", hint: "Название студии"},
];

export const VARIABLE_ALIASES = {
  "{name}": "{client_name}",
  "{date}": "{appointment_date}",
  "{time}": "{appointment_time}",
  "{service}": "{service_name}",
  "{master}": "{master_name}",
  "{address}": "{studio_address}",
  "{studio}": "{studio_name}",
};

export const DEFAULT_DEMO_CONTEXT = {
  client_name: "Анна Ковальска",
  appointment_date: "24.10.2026",
  appointment_time: "14:30",
  service_name: "Masaż relaksacyjny całego ciała",
  master_name: "Natali",
  duration: "60 мин",
  price: "220 zł",
  studio_address: "Warszawa, ul. Złota 44",
  studio_name: "NUAR",
};

export const NUAR_STARTER_TEMPLATES = [
  {
    id: "nuar-booking-confirm",
    name: "Подтверждение записи",
    category: "booking_confirmation",
    channel: "SMS",
    archived: false,
    translations: {
      pl: "Dzień dobry, {client_name}! Potwierdzamy wizytę w NUAR na {service_name}: {appointment_date} o {appointment_time}. Masażysta: {master_name}. Adres: {studio_address}. Czekamy na Ciebie! 🖤",
      ru: "Здравствуйте, {client_name}! Подтверждаем вашу запись в студию NUAR на {service_name}: {appointment_date} в {appointment_time}. Мастер: {master_name}. Адрес: {studio_address}. Ждём вас! 🖤",
      ua: "Доброго дня, {client_name}! Підтверджуємо ваш запис у студію NUAR на {service_name}: {appointment_date} о {appointment_time}. Майстер: {master_name}. Адреса: {studio_address}. Чекаємо на вас! 🖤",
      en: "Hello {client_name}! Confirming your visit to NUAR for {service_name}: {appointment_date} at {appointment_time}. Master: {master_name}. Address: {studio_address}. Looking forward to seeing you! 🖤",
    },
  },
  {
    id: "nuar-open-slot",
    name: "Предложение свободного времени",
    category: "booking_confirmation",
    channel: "SMS",
    archived: false,
    translations: {
      pl: "Cześć {client_name}! Mamy wolny termin na masaż w NUAR: {appointment_date} o {appointment_time}. Chcesz zarezerwować dla siebie?",
      ru: "Здравствуйте, {client_name}! У нас появилось свободное окошко на массаж в NUAR: {appointment_date} в {appointment_time}. Забронировать для вас?",
      ua: "Вітаємо, {client_name}! З'явилося вільне віконце на масаж у NUAR: {appointment_date} о {appointment_time}. Забронювати для вас?",
      en: "Hello {client_name}! We have an open slot for a massage at NUAR: {appointment_date} at {appointment_time}. Would you like to book it?",
    },
  },
  {
    id: "nuar-reminder-24h",
    name: "Напоминание о визите (за 24ч)",
    category: "reminders",
    channel: "SMS",
    archived: false,
    translations: {
      pl: "Dzień dobry, {client_name}! Przypominamy o jutrzejszej wizycie w NUAR: {appointment_date} o {appointment_time}. Usługa: {service_name} ({duration}). Jeśli plany uległy zmianie, prosimy o informację. Do zobaczenia!",
      ru: "Здравствуйте, {client_name}! Напоминаем о вашей записи в студию NUAR завтра, {appointment_date} в {appointment_time}. Услуга: {service_name} ({duration}). Если ваши планы изменятся, пожалуйста, предупредите нас. До встречи!",
      ua: "Доброго дня, {client_name}! Нагадуємо про ваш візит до NUAR завтра, {appointment_date} о {appointment_time}. Послуга: {service_name} ({duration}). Якщо плани змінилися, будь ласка, попередьте нас. До зустрічі!",
      en: "Hello {client_name}! Reminder about your appointment at NUAR tomorrow, {appointment_date} at {appointment_time}. Service: {service_name} ({duration}). Please let us know if your plans change. See you!",
    },
  },
  {
    id: "nuar-reminder-2h",
    name: "Напоминание о визите (за 2ч)",
    category: "reminders",
    channel: "SMS",
    archived: false,
    translations: {
      pl: "Dzień dobry, {client_name}! Czekamy na Ciebie za 2 godziny w NUAR o {appointment_time}. Masażysta {master_name} już przygotowuje gabinet. Adres: {studio_address}.",
      ru: "Здравствуйте, {client_name}! Ждём вас через 2 часа в студии NUAR к {appointment_time}. Мастер {master_name} уже готовит кабинет. Наш адрес: {studio_address}.",
      ua: "Доброго дня, {client_name}! Чекаємо на вас через 2 години в студії NUAR о {appointment_time}. Майстер {master_name} вже готує кабінет. Наша адреса: {studio_address}.",
      en: "Hello {client_name}! We look forward to seeing you in 2 hours at NUAR at {appointment_time}. Master {master_name} is preparing your room. Address: {studio_address}.",
    },
  },
  {
    id: "nuar-reschedule-offer",
    name: "Перенос записи на другое время",
    category: "reschedule_cancel",
    channel: "SMS",
    archived: false,
    translations: {
      pl: "Dzień dobry, {client_name}! Zgodnie z ustaleniami przenosimy Twoją wizytę w NUAR. Nowy termin: {appointment_date} o {appointment_time}. Usługa: {service_name}. Dziękujemy za elastyczność!",
      ru: "Здравствуйте, {client_name}! Перенесли вашу запись в студию NUAR на {appointment_date} в {appointment_time}. Услуга: {service_name}. Спасибо за понимание!",
      ua: "Доброго дня, {client_name}! Перенесли ваш запис до студії NUAR на {appointment_date} о {appointment_time}. Послуга: {service_name}. Дякуємо за розуміння!",
      en: "Hello {client_name}! Your appointment at NUAR has been rescheduled to {appointment_date} at {appointment_time}. Service: {service_name}. Thank you for your flexibility!",
    },
  },
  {
    id: "nuar-cancel-confirm",
    name: "Подтверждение отмены записи",
    category: "reschedule_cancel",
    channel: "SMS",
    archived: false,
    translations: {
      pl: "Cześć {client_name}! Potwierdzamy anulowanie Twojej wizyty na {appointment_date}. Będzie nam miło powitać Cię w innym dogodnym terminie. Dobrego dnia!",
      ru: "Здравствуйте, {client_name}! Запись на {appointment_date} отменена. Будем рады подобрать для вас другое удобное время, когда будете готовы. Хорошего дня!",
      ua: "Доброго дня, {client_name}! Запис на {appointment_date} скасовано. Будемо раді підібрати для вас інший зручний час. Гарного дня!",
      en: "Hello {client_name}! Your appointment on {appointment_date} has been cancelled. We'll be happy to welcome you at another convenient time. Have a great day!",
    },
  },
  {
    id: "nuar-post-visit-review",
    name: "Благодарность и отзыв",
    category: "post_visit",
    channel: "SMS",
    archived: false,
    translations: {
      pl: "Dziękujemy za wizytę w NUAR, {client_name}! 🖤 Mamy nadzieję, że masaż przyniósł Ci pełny relaks. Będziemy wdzięczni za krótką opinię o Twoim masażu u {master_name}.",
      ru: "Спасибо за визит в NUAR, {client_name}! 🖤 Надеемся, что массаж подарил вам лёгкость и отдых. Будем очень благодарны за ваш отзыв о визите к мастеру {master_name}!",
      ua: "Дякуємо за візит до NUAR, {client_name}! 🖤 Сподіваємося, масаж подарував вам легкість та відпочинок. Будемо вдячні за відгук про роботу майстра {master_name}!",
      en: "Thank you for visiting NUAR, {client_name}! 🖤 We hope your session was deeply relaxing. We would appreciate a short review of your massage with {master_name}!",
    },
  },
  {
    id: "nuar-post-visit-care",
    name: "Рекомендации после массажа",
    category: "post_visit",
    channel: "SMS",
    archived: false,
    translations: {
      pl: "Cześć {client_name}! Pamiętaj o piciu dużej ilości wody dzisiaj po masażu, aby wspomóc regenerację mięśni. Do zobaczenia w NUAR!",
      ru: "Здравствуйте, {client_name}! Не забудьте пить побольше чистой воды сегодня после массажа, чтобы мышцы быстрее восстановились. До новых встреч в NUAR!",
      ua: "Вітаємо, {client_name}! Не забудьте пити більше води сьогодні після масажу для кращого відновлення м'язів. До зустрічі в NUAR!",
      en: "Hi {client_name}! Remember to drink plenty of water today after your massage to aid muscle recovery. See you again at NUAR!",
    },
  },
  {
    id: "nuar-reactivation",
    name: "Возвращение клиентов",
    category: "reactivation",
    channel: "SMS",
    archived: false,
    translations: {
      pl: "Cześć {client_name}! Dawno nie widzieliśmy się w NUAR. Twoje ciało zasługuje na chwilę wytchnienia i głęboki relaks. Chętnie pomożemy wybrać idealny termin!",
      ru: "Здравствуйте, {client_name}! Давно не виделись в NUAR. Ваше тело заслуживает отдыха и качественной заботы. Будем рады подобрать для вас идеальное время для сеанса!",
      ua: "Доброго дня, {client_name}! Давно не бачилися в NUAR. Ваше тіло заслуговує на якісний відпочинок і релакс. З радістю допоможемо обрати зручний час!",
      en: "Hello {client_name}! We haven't seen you at NUAR for a while. Your body deserves a break and deep relaxation. We would love to help you find a great time to visit!",
    },
  },
  {
    id: "nuar-promo-packages",
    name: "Абонементы и пакеты массажей",
    category: "promotions",
    channel: "SMS",
    archived: false,
    translations: {
      pl: "Cześć {client_name}! Zadbaj o regularną regenerację: pakiety masaży w NUAR to oszczędność do 20% i stała opieka Twojego ulubionego masażysty. Zapytaj nas o szczegóły!",
      ru: "Здравствуйте, {client_name}! Для регулярной заботы о себе в NUAR действуют пакеты массажей с выгодой до 20% и закреплением за вашим любимым мастером. Напишите нам, расскажем подробнее!",
      ua: "Вітаємо, {client_name}! Для регулярної турботи про себе в NUAR є абонементи на масаж з вигодою до 20%. Напишіть нам, з радістю розкажемо деталі!",
      en: "Hi {client_name}! Take regular care of your body: massage packages at NUAR save up to 20% with your preferred master. Message us for details!",
    },
  },
  {
    id: "nuar-location-info",
    name: "Как нас найти (локация и вход)",
    category: "other",
    channel: "SMS",
    archived: false,
    translations: {
      pl: "Cześć {client_name}! Nasze studio NUAR znajduje się pod adresem: {studio_address}. Wejście od strony ulicy, domofon NUAR. Jeśli będziesz mieć problem ze znalezieniem, zadzwoń!",
      ru: "Здравствуйте, {client_name}! Наша студия NUAR находится по адресу: {studio_address}. Вход с фасада, домофон NUAR. Если понадобится помощь с ориентиром — позвоните нам!",
      ua: "Доброго дня, {client_name}! Студія NUAR знаходиться за адресою: {studio_address}. Вхід з фасаду, домофон NUAR. Якщо виникнуть труднощі — телефонуйте!",
      en: "Hello {client_name}! Our NUAR studio is located at: {studio_address}. Entrance from the street, buzzer NUAR. If you need any directions, feel free to call us!",
    },
  },
];

export const mapPurposeToCategory = (purpose) => {
  if (!purpose) return "other";
  const p = String(purpose).toLowerCase();
  if (p.includes("booking") || p.includes("confirm") || p.includes("waitlist")) return "booking_confirmation";
  if (p.includes("24h") || p.includes("2h") || p.includes("reminder")) return "reminders";
  if (p.includes("review")) return "post_visit";
  if (p.includes("inactive")) return "reactivation";
  if (p.includes("promo") || p.includes("package")) return "promotions";
  if (p.includes("reschedule") || p.includes("cancel")) return "reschedule_cancel";
  return "other";
};

export const normalizeTemplate = (template) => {
  if (!template) return null;
  const payload = template.payload || {};
  const rawTranslations = payload.translations || template.translations || {};

  const translations = {
    pl: String(rawTranslations.pl || (template.language === "Польский" ? template.body : "") || "").trim(),
    ru: String(rawTranslations.ru || (template.language === "Русский" ? template.body : "") || "").trim(),
    ua: String(rawTranslations.ua || (template.language === "Украинский" ? template.body : "") || "").trim(),
    en: String(rawTranslations.en || (template.language === "Английский" ? template.body : "") || "").trim(),
  };

  // If no translations but body exists, put into pl or default
  if (!translations.pl && !translations.ru && !translations.ua && !translations.en && template.body) {
    translations.pl = String(template.body).trim();
  }

  const category = payload.category || template.category || mapPurposeToCategory(template.purpose);
  const archived = Boolean(payload.archived || template.archived);

  return {
    ...template,
    category,
    archived,
    translations,
    body: translations.pl || translations.ru || translations.ua || translations.en || template.body || "",
    channel: template.channel || "SMS",
  };
};

export const normalizeTemplateList = (rawList = []) => {
  const current = Array.isArray(rawList) ? rawList.map(normalizeTemplate).filter(Boolean) : [];

  // If list is completely empty, supply our professional starter library
  if (!current.length) {
    return NUAR_STARTER_TEMPLATES.map(normalizeTemplate);
  }

  // Ensure starter templates exist if not yet created by id
  const existingIds = new Set(current.map((t) => String(t.id)));
  const existingNames = new Set(current.map((t) => String(t.name).toLowerCase().trim()));

  const missingStarters = NUAR_STARTER_TEMPLATES.filter(
    (starter) => !existingIds.has(String(starter.id)) && !existingNames.has(String(starter.name).toLowerCase().trim()),
  ).map(normalizeTemplate);

  return [...current, ...missingStarters];
};

export const substituteVariables = (text = "", context = {}) => {
  if (!text) return {text: "", missing: []};

  let normalizedText = text;
  for (const [legacy, canonical] of Object.entries(VARIABLE_ALIASES)) {
    normalizedText = normalizedText.replaceAll(legacy, canonical);
  }

  const missing = [];
  const rendered = normalizedText.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    const canonicalKey = `{${key}}`;
    const val = context[key];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      return String(val);
    }
    if (DYNAMIC_VARIABLES.some((v) => v.key === canonicalKey)) {
      missing.push(canonicalKey);
      return match;
    }
    return match;
  });

  return {
    text: rendered,
    missing: [...new Set(missing)],
  };
};

export const buildClientContext = (client, appointment = null, appSettings = {}) => {
  const context = {
    client_name: client?.name ? String(client.name).trim() : "",
    studio_address: appSettings?.studioAddress || "Warszawa, ul. Złota 44",
    studio_name: appSettings?.studioName || "NUAR",
  };

  if (appointment) {
    const rawDate = appointment.date || appointment.appointmentDate;
    context.appointment_date = rawDate ? toDisplayDate(rawDate) : "";
    context.appointment_time = appointment.time || appointment.start || appointment.appointmentTime || "";
    context.service_name = appointment.service || appointment.serviceName || "";
    context.master_name = appointment.master || appointment.masterName || "";
    context.duration = appointment.duration ? `${appointment.duration} мин` : "60 мин";
    context.price = appointment.price || appointment.amount ? `${appointment.price || appointment.amount} zł` : "";
  }

  return context;
};

export const findClientAppointments = (client, calendarEntries = []) => {
  if (!client || !Array.isArray(calendarEntries)) return [];
  const clientName = String(client.name || "").trim().toLowerCase();
  const clientId = client.id ? String(client.id) : null;

  return calendarEntries
    .filter((entry) => {
      if (!entry) return false;
      if (clientId && String(entry.clientId) === clientId) return true;
      const entryClient = String(entry.client || entry.clientName || "").trim().toLowerCase();
      return Boolean(clientName && entryClient === clientName);
    })
    .sort((a, b) => {
      const dateA = String(a.date || "");
      const dateB = String(b.date || "");
      return dateB.localeCompare(dateA);
    });
};
