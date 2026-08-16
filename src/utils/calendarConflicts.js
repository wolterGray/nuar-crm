import {getEmployeeUnavailableReason} from "./employeeAvailability.js";
import {getEntryMasters} from "./parallelVisits.js";

const toCalendarMinutes = (time) => {
  const [hours, minutes] = String(time ?? "00:00").split(":").map(Number);

  return hours * 60 + minutes;
};

export const getCalendarConflicts = (entry, calendarEntries, ignoredId = null) => {
  const entryStart = toCalendarMinutes(entry.time);
  const entryEnd = entryStart + Number(entry.duration);
  const entryMasters = getEntryMasters(entry);

  return calendarEntries.filter((item) => {
    if (
      item.id === ignoredId ||
      ["completed", "cancelled", "no_show"].includes(item.status)
    ) {
      return false;
    }

    const itemStart = toCalendarMinutes(item.time);
    const itemEnd = itemStart + Number(item.duration);
    const itemMasters = getEntryMasters(item);

    return (
      item.date === entry.date &&
      entryMasters.some((master) => itemMasters.includes(master)) &&
      entryStart < itemEnd &&
      itemStart < entryEnd
    );
  });
};

export const getCalendarShiftWarning = (
  entry,
  {appSettings, employees},
) => {
  const entryMasters = getEntryMasters(entry);
  const warnings = entryMasters
    .map((master) => {
      const employee = employees.find((item) => item.name === master);

      if (!employee) {
        return "";
      }

      const unavailableReason = getEmployeeUnavailableReason(employee, entry.date);
      if (unavailableReason) {
        return unavailableReason;
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
    })
    .filter(Boolean);

  return warnings[0] ?? "";
};
