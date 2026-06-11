import {isCalendarVisitPlanned} from "./calendarVisitStatus.js";

export const shouldReopenCompletedCalendarEntry = (
  entry,
  previousEntry = entry,
) =>
  previousEntry?.status === "completed" &&
  entry.kind === "visit" &&
  isCalendarVisitPlanned(
    {...entry, status: "scheduled", completedAt: "", visitId: ""},
    new Date(),
  );

export const normalizeCalendarEntryTiming = (entry, previousEntry = entry) =>
  shouldReopenCompletedCalendarEntry(entry, previousEntry)
    ? {...entry, status: "scheduled", completedAt: "", visitId: ""}
    : entry;
