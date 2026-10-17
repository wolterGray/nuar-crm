/**
 * Multi-language translations and dictionary for NUAR Price List
 * Languages supported: PL (Polski, default), RU (Русский), EN (English), UA (Українська)
 */

export const PRICE_LIST_LANGUAGES = [
  { code: "pl", label: "PL", name: "Polski" },
  { code: "ru", label: "RU", name: "Русский" },
  { code: "en", label: "EN", name: "English" },
  { code: "ua", label: "UA", name: "Українська" },
];

export const UI_LABELS = {
  pl: {
    docTitle: "CENNIK USŁUG",
    brandSubtitle: "SALON MASAŻU & SPA · WARSZAWA",
    fromPrice: "od",
    minUnit: "min",
    currency: "zł",
    onlineBooking: "Rezerwacja online",
    addressLabel: "Adres",
    phoneLabel: "Telefon",
    instagramLabel: "Instagram",
    validFrom: "Aktualny cennik",
    website: "nuarr.pl",
    address: "Warszawa, ul. Kolejowa 45A/U10",
    phone: "+48 572 201 114",
    instagram: "@nuarr_pl",
    note: "Wszystkie ceny zawierają podatek VAT.",
    comboBadge: "Pakiet",
    masterBadge: "Top-Master",
    otherCategory: "Pozostałe usługi",
  },
  ru: {
    docTitle: "ПРАЙС-ЛИСТ",
    brandSubtitle: "САЛОН МАССАЖА & SPA · ВАРШАВА",
    fromPrice: "от",
    minUnit: "мин",
    currency: "zł",
    onlineBooking: "Онлайн-запись",
    addressLabel: "Адрес",
    phoneLabel: "Телефон",
    instagramLabel: "Instagram",
    validFrom: "Актуальный прайс",
    website: "nuarr.pl",
    address: "Варшава, ul. Kolejowa 45A/U10",
    phone: "+48 572 201 114",
    instagram: "@nuarr_pl",
    note: "Все цены указаны в польских злотых (PLN).",
    comboBadge: "Комплекс",
    masterBadge: "Топ-Мастер",
    otherCategory: "Другие услуги",
  },
  en: {
    docTitle: "PRICE LIST",
    brandSubtitle: "MASSAGE & SPA SALON · WARSAW",
    fromPrice: "from",
    minUnit: "min",
    currency: "zł",
    onlineBooking: "Online booking",
    addressLabel: "Address",
    phoneLabel: "Phone",
    instagramLabel: "Instagram",
    validFrom: "Current price list",
    website: "nuarr.pl",
    address: "Warsaw, Kolejowa 45A/U10",
    phone: "+48 572 201 114",
    instagram: "@nuarr_pl",
    note: "All prices include VAT.",
    comboBadge: "Package",
    masterBadge: "Top Master",
    otherCategory: "Other Services",
  },
  ua: {
    docTitle: "ПРАЙС-ЛИСТ",
    brandSubtitle: "САЛОН МАСАЖУ & SPA · ВАРШАВА",
    fromPrice: "від",
    minUnit: "хв",
    currency: "zł",
    onlineBooking: "Онлайн-запис",
    addressLabel: "Адреса",
    phoneLabel: "Телефон",
    instagramLabel: "Instagram",
    validFrom: "Актуальний прайс",
    website: "nuarr.pl",
    address: "Варшава, ul. Kolejowa 45A/U10",
    phone: "+48 572 201 114",
    instagram: "@nuarr_pl",
    note: "Всі ціни вказані у польських злотих (PLN).",
    comboBadge: "Комплекс",
    masterBadge: "Топ-Майстер",
    otherCategory: "Інші послуги",
  },
};

export const CATEGORY_TRANSLATIONS = {
  "Массажи": {
    pl: "Masaże",
    ru: "Массажи",
    en: "Massages",
    ua: "Масажі",
  },
  "Массаж": {
    pl: "Masaże",
    ru: "Массажи",
    en: "Massages",
    ua: "Масажі",
  },
  "Комплексы": {
    pl: "Rytuały i Kompleksy",
    ru: "Ритуалы и Комплексы",
    en: "Rituals & Packages",
    ua: "Ритуали та Комплекси",
  },
  "Комплекс": {
    pl: "Rytuały i Kompleksy",
    ru: "Ритуалы и Комплексы",
    en: "Rituals & Packages",
    ua: "Ритуали та Комплекси",
  },
  "Body Wrapping": {
    pl: "Body Wrapping",
    ru: "Body Wrapping (Обёртывания)",
    en: "Body Wrapping",
    ua: "Body Wrapping (Обгортання)",
  },
  "Без категории": {
    pl: "Pozostałe usługi",
    ru: "Другие услуги",
    en: "Other Services",
    ua: "Інші послуги",
  },
};

/**
 * Normalized translation lookup by service name keywords or exact name
 */
export const SERVICE_NAME_DICTIONARY = [
  {
    matches: ["klasyczn", "классическ", "classic"],
    names: {
      pl: "Masaż klasyczny",
      ru: "Классический массаж",
      en: "Classic Massage",
      ua: "Класичний масаж",
    },
    descriptions: {
      pl: "Głębokie rozluźnienie mięśni, redukcja napięć i poprawa krążenia.",
      ru: "Глубокое расслабление мышц, снятие напряжения и улучшение кровообращения.",
      en: "Deep muscle relaxation, tension relief and improved circulation.",
      ua: "Глибоке розслаблення м'язів, зняття напруги та покращення кровообігу.",
    },
  },
  {
    matches: ["relaks", "расслабляющ", "relax"],
    names: {
      pl: "Masaż relaksacyjny",
      ru: "Расслабляющий массаж",
      en: "Relaxing Massage",
      ua: "Розслабляючий масаж",
    },
    descriptions: {
      pl: "Delikatny, odprężający masaż z ciepłymi olejkami aromaterapeutycznymi.",
      ru: "Нежный, снимающий стресс массаж с теплыми ароматическими маслами.",
      en: "Gentle, de-stressing massage with warm aromatherapy oils.",
      ua: "Ніжний, заспокійливий масаж з теплими ароматичними оліями.",
    },
  },
  {
    matches: ["sport", "спортивн"],
    names: {
      pl: "Masaż sportowy",
      ru: "Спортивный массаж",
      en: "Sports Massage",
      ua: "Спортивний масаж",
    },
    descriptions: {
      pl: "Intensywna praca z powięzią i punktami spustowymi dla szybkiej regeneracji.",
      ru: "Интенсивная проработка фасций и триггерных точек для быстрого восстановления.",
      en: "Intensive work on fascia and trigger points for fast recovery.",
      ua: "Інтенсивне опрацювання фасцій та тригерних точок для швидкого відновлення.",
    },
  },
  {
    matches: ["limfat", "лимфо", "drenaż", "drenaz", "drainage"],
    names: {
      pl: "Masaż limfatyczny",
      ru: "Лимфодренажный массаж",
      en: "Lymphatic Drainage Massage",
      ua: "Лімфодренажний масаж",
    },
    descriptions: {
      pl: "Usuwanie obrzęków, stymulacja przepływu limfy i detoksykacja organizmu.",
      ru: "Устранение отеков, стимуляция лимфотока и детоксикация организма.",
      en: "Removal of swelling, lymphatic stimulation and detoxification.",
      ua: "Усунення набряків, стимуляція лімфотоку та детоксикація організму.",
    },
  },
  {
    matches: ["antycellul", "антицеллюлит", "cellulite"],
    names: {
      pl: "Masaż antycellulitowy",
      ru: "Антицеллюлитный массаж",
      en: "Anti-Cellulite Massage",
      ua: "Антицелюлітний масаж",
    },
    descriptions: {
      pl: "Modelowanie sylwetki, wygładzenie skóry i redukcja tkanki tłuszczowej.",
      ru: "Моделирование силуэта, разглаживание кожи и уменьшение жировых отложений.",
      en: "Body contouring, skin smoothing and fat tissue reduction.",
      ua: "Моделювання силуету, розгладження шкіри та зменшення жирових відкладень.",
    },
  },
  {
    matches: ["twarz", "twarzy", "glow", "лицо", "голов", "face", "head"],
    names: {
      pl: "Masaż twarzy i głowy",
      ru: "Массаж лица и головы",
      en: "Face & Head Massage",
      ua: "Масаж обличчя та голови",
    },
    descriptions: {
      pl: "Liftingujący masaż twarzy, szyi, dekoltu i głowy usuwający napięcia mimiczne.",
      ru: "Лифтинг-массаж лица, шеи, декольте и головы, снимающий мимическое напряжение.",
      en: "Lifting massage for face, neck, décolleté and head, relieving facial tension.",
      ua: "Ліфтинг-масаж обличчя, шиї, декольте та голови, що знімає мімічну напругу.",
    },
  },
  {
    matches: ["kobido", "кобидо", "кобідо"],
    names: {
      pl: "Japoński masaż twarzy Kobido",
      ru: "Японский массаж лица Кобидо",
      en: "Japanese Kobido Facial Massage",
      ua: "Японський масаж обличчя Кобідо",
    },
    descriptions: {
      pl: "Nieinwazyjny lifting twarzy, stymulacja produkcji kolagenu i wygładzenie zmarszczek.",
      ru: "Безоперационный лифтинг лица, выработка коллагена и разглаживание морщин.",
      en: "Non-invasive facial lifting, collagen stimulation and wrinkle smoothing.",
      ua: "Безопераційний ліфтинг обличчя, вироблення колагену та розгладження зморшок.",
    },
  },
  {
    matches: ["autorsk", "авторск", "signature"],
    names: {
      pl: "Masaż autorski NUAR",
      ru: "Авторский массаж NUAR",
      en: "NUAR Signature Massage",
      ua: "Авторський масаж NUAR",
    },
    descriptions: {
      pl: "Indywidualnie dobrana kompozycja najlepszych technik masażu dla maksymalnego efektu.",
      ru: "Индивидуальная комбинация лучших техник массажа для максимального эффекта.",
      en: "Custom combination of the finest massage techniques for maximum benefit.",
      ua: "Індивідуальна комбінація найкращих технік масажу для максимального результату.",
    },
  },
  {
    matches: ["dzieci", "детск", "kids", "children"],
    names: {
      pl: "Masaż dla dzieci",
      ru: "Детский массаж",
      en: "Kids Massage",
      ua: "Дитячий масаж",
    },
    descriptions: {
      pl: "Łagodny masaż wspierający prawidłową postawę i wyciszenie układu nerwowego.",
      ru: "Мягкий массаж для правильной осанки и гармонизации нервной системы ребенка.",
      en: "Gentle massage supporting healthy posture and nervous system relaxation.",
      ua: "М'який масаж для гармонізації постави та заспокоєння нервової системи дитини.",
    },
  },
  {
    matches: ["kamien", "gorąc", "камн", "горяч", "stone"],
    names: {
      pl: "Masaż gorącymi kamieniami",
      ru: "Массаж горячими камнями",
      en: "Hot Stone Massage",
      ua: "Масаж гарячим камінням",
    },
    descriptions: {
      pl: "Rozgrzewający rytuał wulkanicznymi kamieniami bazaltowymi.",
      ru: "Согревающий ритуал базальтовыми вулканическими камнями.",
      en: "Warming ritual with volcanic basalt stones.",
      ua: "Зігріваючий ритуал вулканічними базальтовими каменями.",
    },
  },
  {
    matches: ["dwojga", "паро", "двоих", "двох", "couple"],
    names: {
      pl: "Masaż dla dwojga",
      ru: "Массаж для двоих",
      en: "Couples Massage",
      ua: "Масаж для двох",
    },
    descriptions: {
      pl: "Równoczesny relaks w jednym gabinecie z lampką prosecco i owocami.",
      ru: "Одновременный сеанс в одном кабинете с бокалом просекко и фруктами.",
      en: "Simultaneous session in a private suite with prosecco and fruits.",
      ua: "Одночасний сеанс в одному кабінеті з келихом просекко та фруктами.",
    },
  },
  {
    matches: ["rytuał", "ритуал", "ritual"],
    names: {
      pl: "Rytuał Nuar",
      ru: "Ритуал Nuar",
      en: "NUAR Ritual",
      ua: "Ритуал Nuar",
    },
    descriptions: {
      pl: "Pełny rytuał spa: peeling ciała, aromatyczny masaż i pielęgnacja twarzy.",
      ru: "Комплексный спа-ритуал: пилинг тела, аромамассаж и уход за лицом.",
      en: "Full spa ritual: body peeling, aroma massage and facial treatment.",
      ua: "Комплексний спа-ритуал: пілінг тіла, аромамасаж та догляд за обличчям.",
    },
  },
  {
    matches: ["wrapping", "обертыван", "обгортан"],
    names: {
      pl: "Body Wrapping",
      ru: "Body Wrapping",
      en: "Body Wrapping",
      ua: "Body Wrapping",
    },
    descriptions: {
      pl: "Zabieg ujędrniający i drenujący z profesjonalnymi bandażami modelującymi.",
      ru: "Укрепляющая и дренажная процедура с моделирующими бандажами.",
      en: "Firming and draining treatment with sculpting cosmetic wraps.",
      ua: "Зміцнююча та дренажна процедура з моделюючими бандажами.",
    },
  },
];

/**
 * Returns localized category title
 */
export function getTranslatedCategory(categoryName, lang = "pl") {
  if (!categoryName) return UI_LABELS[lang]?.otherCategory || "Pozostałe usługi";
  const cat = String(categoryName).trim();
  if (CATEGORY_TRANSLATIONS[cat]?.[lang]) {
    return CATEGORY_TRANSLATIONS[cat][lang];
  }
  // Try case-insensitive matching
  const lower = cat.toLowerCase();
  for (const [key, trans] of Object.entries(CATEGORY_TRANSLATIONS)) {
    if (key.toLowerCase() === lower && trans[lang]) {
      return trans[lang];
    }
  }
  return cat;
}

/**
 * Returns localized service name and optional description
 */
export function getTranslatedService(service, lang = "pl") {
  if (!service) return { name: "", description: "" };

  // 1. Direct explicit translation from service object if present
  if (service.translations?.[lang]?.name) {
    return {
      name: service.translations[lang].name,
      description: service.translations[lang].description || service.description || "",
    };
  }

  // Check language-specific keys on service object
  const langKey = `name${lang.charAt(0).toUpperCase() + lang.slice(1)}`;
  if (service[langKey]) {
    return {
      name: service[langKey],
      description: service[`desc${lang.charAt(0).toUpperCase() + lang.slice(1)}`] || service.description || "",
    };
  }

  const rawName = String(service.name ?? "").trim();
  const lowerName = rawName.toLowerCase();

  // 2. Dictionary match
  for (const entry of SERVICE_NAME_DICTIONARY) {
    if (entry.matches.some((kw) => lowerName.includes(kw))) {
      return {
        name: entry.names[lang] || rawName,
        description: entry.descriptions?.[lang] || service.description || "",
      };
    }
  }

  // 3. Fallback to original service name
  return {
    name: rawName,
    description: service.description || "",
  };
}
