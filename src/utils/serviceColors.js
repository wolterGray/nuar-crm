export const serviceColorPalette = [
  "#7c6cf2",
  "#00c2ff",
  "#2dd4bf",
  "#22c55e",
  "#a3e635",
  "#f43f5e",
  "#ec4899",
  "#d946ef",
  "#3b82f6",
  "#14b8a6",
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
