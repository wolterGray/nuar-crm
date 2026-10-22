import {describe, expect, it} from "vitest";
import {
  USER_ROLE_OPTIONS,
  ROLE_LABELS,
  ROLE_BADGE_VARIANTS,
} from "../../constants/userRoles.js";

describe("User Roles and Badges", () => {
  it("defines standard role options with non-empty labels and values", () => {
    expect(USER_ROLE_OPTIONS.length).toBeGreaterThanOrEqual(4);
    const values = USER_ROLE_OPTIONS.map((opt) => opt.value);
    expect(values).toContain("owner");
    expect(values).toContain("admin");
    expect(values).toContain("manager");
    expect(values).toContain("staff");
    expect(values).toContain("readonly");
  });

  it("provides human-readable labels in ROLE_LABELS for all option values", () => {
    for (const option of USER_ROLE_OPTIONS) {
      expect(ROLE_LABELS[option.value]).toBeTruthy();
      expect(typeof ROLE_LABELS[option.value]).toBe("string");
    }
    expect(ROLE_LABELS.owner).toBe("Владелец");
    expect(ROLE_LABELS.admin).toBe("Администратор");
    expect(ROLE_LABELS.staff).toBe("Сотрудник");
  });

  it("provides valid badge variants for each role", () => {
    expect(ROLE_BADGE_VARIANTS.owner).toBe("premium");
    expect(ROLE_BADGE_VARIANTS.admin).toBe("danger");
    expect(ROLE_BADGE_VARIANTS.manager).toBe("info");
    expect(ROLE_BADGE_VARIANTS.staff).toBe("success");
    expect(ROLE_BADGE_VARIANTS.readonly).toBe("neutral");
  });
});
