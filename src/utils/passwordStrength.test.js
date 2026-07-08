import {describe, expect, it} from "vitest";
import {validatePasswordStrength} from "./passwordStrength.js";

describe("validatePasswordStrength", () => {
  it("accepts a strong password", () => {
    expect(validatePasswordStrength("StrongPassw0rd!").isValid).toBe(true);
  });

  it("rejects weak obvious passwords", () => {
    const result = validatePasswordStrength("password123");

    expect(result.isValid).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
  });

  it("rejects passwords containing email username", () => {
    const result = validatePasswordStrength("Volodymyr2026!", {
      email: "volodymyr@example.com",
    });

    expect(result.isValid).toBe(false);
  });
});
