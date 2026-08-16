import {describe, expect, it} from "vitest";
import {
  DEFAULT_CLIENT_PREFERENCE,
  getClientPreferenceOptions,
} from "./NewClientForm.jsx";

describe("getClientPreferenceOptions", () => {
  it("uses current active employees as client master preferences", () => {
    expect(
      getClientPreferenceOptions([
        {id: 1, name: "Max"},
        {id: 2, name: "Olha"},
        {id: 3, name: "Алена"},
      ]),
    ).toEqual([DEFAULT_CLIENT_PREFERENCE, "Max", "Olha", "Алена"]);
  });

  it("keeps a saved legacy preference while editing a client", () => {
    expect(
      getClientPreferenceOptions([{id: 1, name: "Max"}], "Новая мастер"),
    ).toEqual([DEFAULT_CLIENT_PREFERENCE, "Max", "Новая мастер"]);
  });
});
