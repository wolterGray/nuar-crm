import {describe, expect, it} from "vitest";
import {
  enrichImportDocument,
  parseImportDocument,
} from "./invoiceParser.js";
import {
  formatImportDocumentDate,
  getImportDocumentMetaRows,
  getImportDocumentTitle,
} from "./importDocumentDisplay.js";

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
      fromAddress: "noreply@allegro.pl",
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
    expect(document?.fromAddress).toBe("invoice@booksy.com");
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
      invoiceNumber: "FV/STR/2024/05/66809",
      invoiceDate: "2024-05-01",
      fromLabel: "Booksy International",
      fromAddress: "noreply@booksy.com",
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

    expect(document).toMatchObject({
      source: "iPOS",
      invoiceDate: "2024-05-01",
      fromAddress: "billing@ipos.pl",
    });
  });

  it("enriches legacy documents from stored subject and receivedAt", () => {
    const enriched = enrichImportDocument({
      id: "legacy-1",
      type: "document",
      source: "Booksy",
      subject: "Booksy - Twoja Faktura FV/STR/2024/05/66809",
      amount: 0,
      receivedAt: "2024-05-30T10:00:00.000Z",
      attachments: [{filename: "FVSTR20240566809.pdf"}],
      gmailUrl: "https://mail.google.com",
    });

    expect(enriched.invoiceNumber).toBe("FV/STR/2024/05/66809");
    expect(enriched.invoiceDate).toBe("2024-05-01");
    expect(getImportDocumentTitle(enriched)).toBe("FV/STR/2024/05/66809");
  });
});

describe("importDocumentDisplay", () => {
  it("builds readable meta rows for invoice cards", () => {
    const rows = getImportDocumentMetaRows({
      type: "document",
      source: "Groupon",
      subject: "Twoja faktura VAT jest gotowa do pobrania",
      text: "Twoja faktura VAT za okres 1 maja 2024 - 31 maja 2024 jest gotowa.",
      amount: 129.99,
      receivedAt: "2024-06-02T08:15:00.000Z",
      fromLabel: "Groupon",
      fromAddress: "noreply@groupon.pl",
      invoiceDate: "2024-05-31",
      period: "1 maja 2024 - 31 maja 2024",
      attachments: [{filename: "invoice.pdf"}],
    });

    expect(rows.find((row) => row.label === "Дата фактуры")?.value).toBe(
      formatImportDocumentDate("2024-05-31"),
    );
    expect(rows.find((row) => row.label === "Период")?.value).toContain("2024");
  });
});
