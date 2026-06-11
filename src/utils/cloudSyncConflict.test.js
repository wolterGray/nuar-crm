import {describe, expect, it} from "vitest";
import {hasCloudSnapshotConflict} from "./cloudSyncConflict.js";

describe("hasCloudSnapshotConflict", () => {
  it("returns false when timestamps are missing", () => {
    expect(hasCloudSnapshotConflict("", "2026-06-11T10:00:00.000Z")).toBe(false);
    expect(hasCloudSnapshotConflict("2026-06-11T10:00:00.000Z", "")).toBe(false);
  });

  it("returns false when remote is not newer", () => {
    expect(
      hasCloudSnapshotConflict(
        "2026-06-11T10:00:00.000Z",
        "2026-06-11T10:00:00.000Z",
      ),
    ).toBe(false);
    expect(
      hasCloudSnapshotConflict(
        "2026-06-11T11:00:00.000Z",
        "2026-06-11T10:00:00.000Z",
      ),
    ).toBe(false);
  });

  it("returns true when remote is newer than known snapshot", () => {
    expect(
      hasCloudSnapshotConflict(
        "2026-06-11T10:00:00.000Z",
        "2026-06-11T11:00:00.000Z",
      ),
    ).toBe(true);
  });
});
