const toCalendarMinutes = (time) => {
  const [hours, minutes] = String(time ?? "00:00").split(":").map(Number);

  return hours * 60 + minutes;
};

export const getCalendarConflicts = (entry, calendarEntries, ignoredId = null) => {
  const entryStart = toCalendarMinutes(entry.time);
  const entryEnd = entryStart + Number(entry.duration);

  return calendarEntries.filter((item) => {
    if (
      item.id === ignoredId ||
      ["completed", "cancelled", "no_show"].includes(item.status)
    ) {
      return false;
    }

    const itemStart = toCalendarMinutes(item.time);
    const itemEnd = itemStart + Number(item.duration);

    return (
      item.date === entry.date &&
      item.master === entry.master &&
      entryStart < itemEnd &&
      itemStart < entryEnd
    );
  });
};

export const getCalendarShiftWarning = (
  entry,
  {appSettings, employees},
) => {
  const employee = employees.find((item) => item.name === entry.master);

  if (!employee) {
    return "";
  }

  const entryStart = toCalendarMinutes(entry.time);
  const entryEnd = entryStart + Number(entry.duration);
  const shiftStart = toCalendarMinutes(
    employee.shiftStart || appSettings.workdayStart,
  );
  const shiftEnd = toCalendarMinutes(employee.shiftEnd || appSettings.workdayEnd);

  return entryStart < shiftStart || entryEnd > shiftEnd
    ? `Запись выходит за смену ${employee.name}: ${employee.shiftStart || appSettings.workdayStart}–${employee.shiftEnd || appSettings.workdayEnd}.`
    : "";
};
