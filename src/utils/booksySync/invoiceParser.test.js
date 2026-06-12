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
});
