const asObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const optionalPositiveInt = (value, fallback = null) => {
  if (value === '' || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const toScheduledAt = (date, time) => {
  if (!date) return null;
  const value = new Date(`${date}T${time || '00:00'}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
};

/**
 * CalendarEntry is the booking source of truth. A linked Visit is the immutable
 * financial fact, but its appointment snapshot must follow calendar reschedules.
 */
const buildLinkedVisitCalendarUpdate = (visit, calendarEntry) => {
  const visitPayload = asObject(visit?.payload);
  const calendarPayload = asObject(calendarEntry?.payload);
  const date = calendarEntry?.date ?? calendarPayload.date ?? visitPayload.date ?? '';
  const time = calendarEntry?.time ?? calendarPayload.time ?? visitPayload.time ?? '';

  return {
    calendarEntryId: calendarEntry.id,
    clientId: optionalPositiveInt(calendarPayload.clientId, visit?.clientId ?? null),
    employeeId: optionalPositiveInt(
      calendarPayload.employeeId ?? calendarPayload.masterId,
      visit?.employeeId ?? null,
    ),
    notes:
      calendarPayload.note === undefined
        ? visit?.notes ?? null
        : String(calendarPayload.note || '').trim() || null,
    payload: {
      ...visitPayload,
      ...calendarPayload,
      calendarEntryId: calendarEntry.id,
      date,
      inputDate: date,
      status: calendarEntry.status ?? calendarPayload.status ?? visitPayload.status,
      time,
    },
    scheduledAt: toScheduledAt(date, time),
    serviceId: optionalPositiveInt(calendarPayload.serviceId, visit?.serviceId ?? null),
  };
};

module.exports = {
  buildLinkedVisitCalendarUpdate,
  toScheduledAt,
};
