import { afterEach, describe, expect, it, vi } from "vitest";
import {ALERT_FILTER_STORAGE_KEY} from "../constants/storageKeys.js";
import {loadStoredAlertFilter, saveStoredValue} from "./crmStorage.js";

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

  it("keeps specialized notification filters between sessions", () => {
    let storedValue = "finance";
    globalThis.window = {
      localStorage: {
        getItem: vi.fn(() => storedValue),
      },
    };

    expect(loadStoredAlertFilter()).toBe("finance");

    storedValue = "closing";
    expect(loadStoredAlertFilter()).toBe("closing");
    expect(window.localStorage.getItem).toHaveBeenCalledWith(ALERT_FILTER_STORAGE_KEY);
  });
});
