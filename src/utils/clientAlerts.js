export const getUpcomingBirthday = (birthday) => {
  const [, month, day] = String(birthday ?? "").split("-").map(Number);

  if (!month || !day) {
    return null;
  }

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let nextBirthday = new Date(today.getFullYear(), month - 1, day);

  if (nextBirthday < startOfToday) {
    nextBirthday = new Date(today.getFullYear() + 1, month - 1, day);
  }

  const daysLeft = Math.round((nextBirthday - startOfToday) / (24 * 60 * 60 * 1000));

  return {
    daysLeft,
    label: daysLeft === 0 ? "Сегодня" : `Через ${daysLeft} дн.`,
    date: nextBirthday.toLocaleDateString("ru-RU", {day: "2-digit", month: "2-digit"}),
  };
};
