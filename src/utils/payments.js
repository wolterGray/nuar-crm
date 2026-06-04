import {normalizePaymentMethod} from "./finance.js";

export const paymentGroups = [
  {key: "cash", label: "Наличные", color: "#7fbea0"},
  {key: "card", label: "Карта", color: "#86a9dc"},
  {key: "ukrainianCard", label: "Укр. карта", color: "#d99cc0"},
  {key: "crypto", label: "Крипта", color: "#a79be2"},
  {key: "blik", label: "BLIK", color: "#d9b07a"},
  {key: "package", label: "Пакет", color: "#9f96d8"},
  {
    key: "certificate",
    label: "Сертификат",
    color: "#cfb489",
  },
  {key: "barter", label: "Бартер", color: "#9da6b3"},
  {
    key: "unspecified",
    label: "Не указано",
    color: "#b7bcc6",
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
