import {describe, expect, it} from "vitest";
import {
  findClientDuplicateCandidates,
  normalizeClientPhone,
} from "./clientDuplicates.js";

describe("client duplicate detection", () => {
  it("normalizes Polish phone numbers", () => {
    expect(normalizeClientPhone("+48 600 123 456")).toBe("600123456");
    expect(normalizeClientPhone("600-123-456")).toBe("600123456");
  });

  it("blocks exact name and phone duplicates", () => {
    const candidates = findClientDuplicateCandidates(
      [
        {id: 1, name: "Anna Kowalska", phone: "+48 600 123 456"},
        {id: 2, name: "Maria Nowak", phone: ""},
      ],
      {name: "anna kowalska", phone: "600123456"},
    );

    expect(candidates[0].client.id).toBe(1);
    expect(candidates[0].isBlocking).toBe(true);
    expect(candidates[0].reasons).toEqual(
      expect.arrayContaining(["телефон", "точное имя"]),
    );
  });

  it("warns about similar names without blocking", () => {
    const candidates = findClientDuplicateCandidates(
      [{id: 1, name: "Anna Maria", phone: ""}],
      {name: "Anna"},
    );

    expect(candidates[0].client.id).toBe(1);
    expect(candidates[0].isBlocking).toBe(false);
    expect(candidates[0].reasons).toContain("похожее имя");
  });
});
