export const formatDuration = (value) => {
  const minutes = Number(value) || 0;
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}ч ${remainder}м` : `${hours}ч`;
};

export const getTimeMinutes = (value) => {
  const [hours = 0, minutes = 0] = String(value ?? "")
    .split(":")
    .map((part) => Number(part));

  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
};

export const getVisitEndMinutes = (entry) =>
  getTimeMinutes(entry?.time ?? entry?.startTime) + Math.max(1, Number(entry?.duration) || 60);

export const getInputDate = (date = new Date()) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
