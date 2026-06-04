import {normalizePaymentMethod} from "./finance.js";

export const paymentGroups = [
  {key: "cash", label: "Наличные", color: "#248a4f"},
  {key: "card", label: "Карта", color: "#2364d2"},
  {key: "ukrainianCard", label: "Укр. карта", color: "#d85886"},
  {key: "crypto", label: "Крипта", color: "#8f7cff"},
  {key: "blik", label: "BLIK", color: "#d07a12"},
  {key: "package", label: "Пакет", color: "#6b61b8"},
  {
    key: "certificate",
    label: "Сертификат",
    color: "#b98237",
  },
  {key: "barter", label: "Бартер", color: "#748091"},
  {
    key: "unspecified",
    label: "Не указано",
    color: "#a0a4ab",
  },
];

export const getPaymentGroup = (payment) => {
  const normalizedPayment = normalizePaymentMethod(payment);
  return (
    paymentGroups.find((group) => group.key === normalizedPayment) ||
    paymentGroups.find((group) => group.key === "unspecified")
  );
};

export const createPaymentRingGradient = (payments) => {
  const total = payments.reduce((sum, item) => sum + Math.max(item.value, 0), 0);
  let offset = 0;
  const stops = payments
    .filter((item) => item.value > 0)
    .map((item) => {
      const start = offset;
      offset += (item.value / Math.max(total, 1)) * 100;
      return `${item.color} ${start}% ${offset}%`;
    });

  return `conic-gradient(${stops.length ? stops.join(", ") : "#ececea 0 100%"})`;
};
