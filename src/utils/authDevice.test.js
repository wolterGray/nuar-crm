import {describe, expect, it, vi} from "vitest";
import {AUTH_DEVICE_ID_STORAGE_KEY, getOrCreateAuthDeviceId} from "./authDevice.js";

describe("auth device id", () => {
  it("keeps one stable id for repeated logins on the same browser", () => {
    const values = new Map();
    const storage = {
      getItem: vi.fn((key) => values.get(key) || null),
      setItem: vi.fn((key, value) => values.set(key, value)),
    };

    const first = getOrCreateAuthDeviceId(storage);
    const second = getOrCreateAuthDeviceId(storage);

    expect(first).toBe(second);
    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(values.get(AUTH_DEVICE_ID_STORAGE_KEY)).toBe(first);
  });
});
