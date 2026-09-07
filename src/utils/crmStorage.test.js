import { afterEach, describe, expect, it, vi } from "vitest";
import { saveStoredValue } from "./crmStorage.js";

describe("crmStorage", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
    vi.restoreAllMocks();
  });

  it("does not throw when localStorage rejects a write", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    globalThis.window = {
      localStorage: {
        setItem: vi.fn(() => {
          throw new Error("Quota exceeded");
        }),
      },
    };

    expect(() => saveStoredValue("crm:test", { value: 1 })).not.toThrow();
    expect(saveStoredValue("crm:test", { value: 1 })).toBe(false);
    expect(warning).toHaveBeenCalled();
  });
});
