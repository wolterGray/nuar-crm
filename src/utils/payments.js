import {normalizePaymentMethod} from "./finance.js";

export const paymentGroups = [
  {key: "cash", label: "Наличные", color: "var(--color-chart-cash)"},
  {key: "card", label: "Карта", color: "var(--color-chart-card)"},
  {key: "ukrainianCard", label: "Укр. карта", color: "var(--color-chart-ukrainian-card)"},
  {key: "mono", label: "Mono", color: "var(--color-chart-mono)"},
  {key: "crypto", label: "Крипта", color: "var(--color-chart-crypto)"},
  {key: "blik", label: "BLIK", color: "var(--color-chart-blik)"},
  {key: "package", label: "Пакет", color: "var(--color-chart-package)"},
  {
    key: "certificate",
    label: "Сертификат",
    color: "var(--color-chart-certificate)",
  },
  {key: "barter", label: "Бартер", color: "var(--color-chart-barter)"},
  {
    key: "unspecified",
    label: "Не указано",
    color: "var(--color-chart-unspecified)",
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

  return `conic-gradient(${stops.length ? stops.join(", ") : "var(--color-chart-empty) 0 100%"})`;
};
