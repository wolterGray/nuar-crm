import {describe, expect, it} from "vitest";
import {
  BOOKSY_SYNC_STATUSES,
  canEnqueueBooksySync,
  canRetryBooksySync,
  getBooksySyncStatusLabel,
  patchCalendarEntryInList,
} from "./booksySyncStatus.js";

describe("booksySyncStatus", () => {
  const visit = {
    id: "1",
    kind: "visit",
    date: "2026-06-12",
    time: "10:00",
    master: "Ольга",
    duration: 60,
  };

  it("blocks enqueue for pending and synced visits", () => {
    expect(canEnqueueBooksySync(visit)).toBe(true);
    expect(
      canEnqueueBooksySync({...visit, booksySyncStatus: BOOKSY_SYNC_STATUSES.PENDING}),
    ).toBe(false);
    expect(
      canEnqueueBooksySync({...visit, booksySyncStatus: BOOKSY_SYNC_STATUSES.SYNCED}),
    ).toBe(false);
  });

  it("allows retry only for failed visits", () => {
    expect(canRetryBooksySync({...visit, booksySyncStatus: BOOKSY_SYNC_STATUSES.FAILED})).toBe(
      true,
    );
    expect(canRetryBooksySync(visit)).toBe(false);
  });

  it("patches calendar entry list by id", () => {
    const next = patchCalendarEntryInList([visit], "1", {
      booksySyncStatus: BOOKSY_SYNC_STATUSES.PENDING,
    });

    expect(next[0].booksySyncStatus).toBe(BOOKSY_SYNC_STATUSES.PENDING);
    expect(getBooksySyncStatusLabel(next[0])).toBe("В очереди Booksy");
  });
});
