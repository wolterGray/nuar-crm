export const formatMoney = (value) => `${value} zł`;

export const toInputDate = (date) => {
  const [day, month, year] = date.split(".");
  return `${year}-${month}-${day}`;
};

export const toDisplayDate = (date) => {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
};
