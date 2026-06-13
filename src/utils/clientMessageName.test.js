import {describe, expect, it} from "vitest";
import {
  extractMessageName,
  getClientMessageName,
  resolveClientMessageName,
} from "./clientMessageName.js";

describe("clientMessageName", () => {
  it("extracts first name before referral suffix", () => {
    expect(extractMessageName("Анастасия от Влады")).toBe("Анастасия");
    expect(extractMessageName("Anna od Kasi")).toBe("Anna");
  });

  it("uses first word for multi-word labels", () => {
    expect(extractMessageName("Елена Айти")).toBe("Елена");
    expect(extractMessageName("Наталья К.")).toBe("Наталья");
  });

  it("keeps single-word names", () => {
    expect(extractMessageName("Марина")).toBe("Марина");
  });

  it("prefers explicit messageName on client", () => {
    expect(
      getClientMessageName({
        name: "Анастасия от Влады",
        messageName: "Nastia",
      }),
    ).toBe("Nastia");
  });

  it("resolves message name from linked client profile", () => {
    const clients = [{id: 1, name: "Елена Айти", phone: "600000000"}];

    expect(
      resolveClientMessageName(clients, {
        clientId: 1,
        client: "Елена Айти",
      }),
    ).toBe("Елена");
  });
});
