import {describe, expect, it} from "vitest";
import {parseImportDocument} from "./invoiceParser.js";

describe("invoiceParser", () => {
  it("detects Allegro invoice with pdf attachment", () => {
    const document = parseImportDocument({
      id: "msg-1",
      from: "Allegro <noreply@allegro.pl>",
      subject: "Faktura za zakup",
      text: "Dziękujemy za zakup. Faktura VAT w załączniku.",
      attachments: [{filename: "faktura.pdf"}],
      messageId: "<abc@allegro.pl>",
      receivedAt: "2026-06-01T10:00:00.000Z",
    });

    expect(document).toMatchObject({
      type: "document",
      source: "Allegro",
      id: "msg-1",
    });
  });

  it("detects Booksy invoice email", () => {
    const document = parseImportDocument({
      id: "msg-2",
      from: "Booksy <invoice@booksy.com>",
      subject: "Faktura Booksy",
      text: "Twoja faktura za usługi Booksy",
      attachments: [{filename: "invoice.pdf"}],
      messageId: "<booksy@booksy.com>",
      receivedAt: "2026-06-02T10:00:00.000Z",
    });

    expect(document?.source).toBe("Booksy");
  });

  it("detects Polish Booksy invoice without invoice@ address", () => {
    const document = parseImportDocument({
      id: "msg-3",
      from: "Booksy International <noreply@booksy.com>",
      subject: "Booksy - Twoja Faktura FV/STR/2024/05/66809",
      text: "Dzień dobry, Przesyłamy fakturę VAT za usługi Booksy.",
      attachments: [{filename: "FVSTR20240566809.pdf"}],
      messageId: "<booksy-invoice@booksy.com>",
      receivedAt: "2024-05-30T10:00:00.000Z",
    });

    expect(document).toMatchObject({
      type: "document",
      source: "Booksy",
      id: "msg-3",
    });
  });

  it("detects iPOS invoice by subject", () => {
    const document = parseImportDocument({
      id: "msg-4",
      from: "no-reply <billing@ipos.pl>",
      subject: "Faktura za usługi iPOS",
      text: "Twoja faktura znajduje się w załączniku.",
      attachments: [{filename: "Faktura_2024-05.pdf"}],
      messageId: "<ipos@ipos.pl>",
      receivedAt: "2024-05-28T10:00:00.000Z",
    });

    expect(document?.source).toBe("iPOS");
  });
});
