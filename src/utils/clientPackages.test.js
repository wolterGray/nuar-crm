import {describe, expect, it} from "vitest";
import {
  isActiveClientPackage,
  isArchivedClientPackage,
  resolveClientPackageStatus,
} from "./clientPackages.js";

describe("clientPackages archive helpers", () => {
  it("treats zero balance and legacy finished status as archived", () => {
    expect(
      isArchivedClientPackage({
        remainingVisits: 0,
        status: "Активен",
      }),
    ).toBe(true);
    expect(
      isArchivedClientPackage({
        remainingVisits: 2,
        status: "Закончился",
      }),
    ).toBe(true);
    expect(
      isArchivedClientPackage({
        remainingVisits: 1,
        status: "Архив",
      }),
    ).toBe(true);
  });

  it("keeps paused packages with balance in active list", () => {
    expect(
      isActiveClientPackage({
        remainingVisits: 3,
        status: "Пауза",
      }),
    ).toBe(true);
  });

  it("auto-archives empty packages and restores active status on refill", () => {
    expect(resolveClientPackageStatus(0, "Активен")).toBe("Архив");
    expect(resolveClientPackageStatus(2, "Закончился")).toBe("Активен");
    expect(resolveClientPackageStatus(2, "Архив")).toBe("Активен");
  });
});
