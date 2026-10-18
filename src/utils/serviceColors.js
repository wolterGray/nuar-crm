export const serviceColorPalette = [
  "#5e6ad2",
  "#4c6fff",
  "#59a8d6",
  "#35b8a6",
  "#56b870",
  "#d97745",
  "#e06c3f",
  "#c15555",
  "#8a8f98",
  "#6f7bd9",
];

const legacyServiceColors = new Set([
  "",
  "#4f8edc",
  "#748091",
  "#d78a42",
  "#c39b6d",
  "#6f6b8f",
]);

const normalizeColor = (color) => String(color ?? "").trim().toLowerCase();

const hashText = (text) =>
  [...String(text ?? "")].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );

export const getRandomServiceColor = () =>
  serviceColorPalette[Math.floor(Math.random() * serviceColorPalette.length)];

export const getStableServiceColor = (service, index = 0) =>
  serviceColorPalette[
    (hashText(`${service?.id ?? index}-${service?.name ?? ""}`) + index) %
      serviceColorPalette.length
  ];

export const shouldRefreshServiceColor = (color) =>
  legacyServiceColors.has(normalizeColor(color));

export const getServiceColor = (service, index = 0) =>
  shouldRefreshServiceColor(service?.color)
    ? getStableServiceColor(service, index)
    : service.color;

export const normalizeServiceColors = (services) =>
  services.map((service, index) => ({
    ...service,
    color: getServiceColor(service, index),
  }));

export const categoryColorMap = {
  "Массаж": "#ef4444",
  "Массажи": "#ef4444",
  "Комплексы": "#38bdf8",
  "Body Wrapping": "#c084fc",
  "Без категории": "#71717a",
  "Другие": "#a1a1aa",
};

export const getCategoryColor = (categoryName) => {
  const normalized = String(categoryName ?? "").trim();
  if (!normalized) return "#71717a";
  if (categoryColorMap[normalized]) {
    return categoryColorMap[normalized];
  }
  return serviceColorPalette[
    [...normalized].reduce((acc, c) => acc + c.charCodeAt(0), 0) % serviceColorPalette.length
  ];
};

export const hexToRgba = (hex, alpha = 1) => {
  if (!hex || typeof hex !== "string") return `rgba(138, 143, 152, ${alpha})`;
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  if (clean.length < 6) return `rgba(138, 143, 152, ${alpha})`;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(138, 143, 152, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const getServiceBadgeStyle = (serviceColor) => {
  const base = serviceColor || "#8a8f98";
  return {
    backgroundColor: hexToRgba(base, 0.14),
    borderColor: hexToRgba(base, 0.28),
    color: base,
  };
};

