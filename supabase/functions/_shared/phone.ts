export const normalizeNotifyPhone = (value: unknown) => {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("48") && digits.length === 11) {
    return digits;
  }

  if (digits.length === 9) {
    return `48${digits}`;
  }

  return digits.length >= 9 ? digits : "";
};
