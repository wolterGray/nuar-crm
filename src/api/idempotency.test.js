import {describe, expect, it} from "vitest";
import {getMutationKey} from "./idempotency.js";

describe("getMutationKey", () => {
  it("reuses a key for an immediately repeated identical mutation", () => {
    const payload = {client: "Test", price: 990};
    const first = getMutationKey("test:package", payload);
    const second = getMutationKey("test:package", {...payload});

    expect(second).toBe(first);
  });

  it("separates different operations and payloads", () => {
    const first = getMutationKey("test:payment", {amount: 100});

    expect(getMutationKey("test:payment", {amount: 200})).not.toBe(first);
    expect(getMutationKey("test:certificate", {amount: 100})).not.toBe(first);
  });
});
