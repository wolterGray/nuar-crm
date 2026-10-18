export const CANONICAL_CATEGORIES = [
  "Массажи",
  "Комплексы",
  "Body Wrapping",
];

export const normalizeCategory = (cat) => {
  const s = String(cat ?? "").trim();
  if (!s) return "Без категории";
  const lower = s.toLowerCase();
  if (lower === "массаж" || lower === "массажи") return "Массажи";
  if (lower === "комплексы" || lower === "комплекс") return "Комплексы";
  if (lower === "body wrapping" || lower === "bodywrapping") return "Body Wrapping";
  return s;
};

export const MASSAGE_SUBTYPES = [
  "Классический",
  "Расслабляющий",
  "Спортивный",
  "Лимфодренажный",
  "Антицеллюлитный",
  "Авторский",
  "Парный",
  "Лицо и голова",
  "Детский",
  "Другой",
];

export const inferMassageSubType = (service) => {
  if (service?.subType && service.subType !== "Другой") {
    return service.subType;
  }
  const name = String(service?.name ?? "").toLowerCase();
  if (name.includes("klasyczn") || name.includes("классическ")) return "Классический";
  if (name.includes("relaks") || name.includes("расслабляющ") || name.includes("релакс")) return "Расслабляющий";
  if (name.includes("sport") || name.includes("спортивн")) return "Спортивный";
  if (
    name.includes("limfat") ||
    name.includes("drenaż") ||
    name.includes("drenaz") ||
    name.includes("лимфо") ||
    name.includes("дренаж")
  ) {
    return "Лимфодренажный";
  }
  if (name.includes("antycellul") || name.includes("антицеллюлит")) return "Антицеллюлитный";
  if (name.includes("autorsk") || name.includes("авторск")) return "Авторский";
  if (name.includes("dwojga") || name.includes("парный")) return "Парный";
  if (name.includes("twarz") || name.includes("glow") || name.includes("лицо") || name.includes("голов")) return "Лицо и голова";
  if (name.includes("dzieci") || name.includes("детск")) return "Детский";
  return service?.subType || null;
};

export const formatServiceCountRu = (count) => {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return "услуг";
  if (n1 > 1 && n1 < 5) return "услуги";
  if (n1 === 1) return "услуга";
  return "услуг";
};
