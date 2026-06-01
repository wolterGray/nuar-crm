export const paymentGroups = [
  {label: "Наличные", color: "#248a4f", matches: (payment) => payment.includes("Наличные")},
  {label: "Карта", color: "#2364d2", matches: (payment) => payment.includes("Карта")},
  {label: "Крипта", color: "#8f7cff", matches: (payment) => payment.includes("Крипта")},
  {label: "Mono", color: "#d85886", matches: (payment) => payment.includes("Mono")},
  {label: "BLIK", color: "#d07a12", matches: (payment) => payment.includes("BLIK")},
  {label: "Пакет", color: "#6b61b8", matches: (payment) => payment.includes("Пакет")},
  {label: "Бартер", color: "#748091", matches: (payment) => payment.includes("Бартер")},
  {
    label: "Не указано",
    color: "#a0a4ab",
    matches: (payment) => !payment || payment.includes("Не указано"),
  },
  {label: "Другое", color: "#546273", matches: () => true},
];

export const getPaymentGroup = (payment) => {
  const normalizedPayment = String(payment ?? "").trim();
  return paymentGroups.find((group) => group.matches(normalizedPayment));
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
