export const normalizeSupplyOrderUrl = (value) => {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

export const openSupplyOrderUrl = (value) => {
  const url = normalizeSupplyOrderUrl(value);

  if (!url) {
    return false;
  }

  window.open(url, "_blank", "noopener,noreferrer");
  return true;
};
