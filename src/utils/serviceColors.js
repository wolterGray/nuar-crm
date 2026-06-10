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
