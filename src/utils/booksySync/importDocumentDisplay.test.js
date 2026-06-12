import {describe, expect, it} from "vitest";
import {
  DEFAULT_IMPORT_DOCUMENT_FILTERS,
  filterImportDocuments,
  getImportDocumentSourceOptions,
  hasActiveImportDocumentFilters,
  IMPORT_DOCUMENT_AMOUNT_FILTERS,
  IMPORT_DOCUMENT_PERIOD_FILTERS,
  matchesImportDocumentPeriod,
  matchesImportDocumentSearch,
} from "./importDocumentDisplay.js";

const sampleDocuments = [
  {
    id: "1",
    type: "document",
    source: "Booksy",
    subject: "Booksy - Twoja Faktura FV/STR/2024/05/66809",
    amount: 0,
    invoiceDate: "2024-05-01",
    receivedAt: "2024-05-30T10:00:00.000Z",
    attachments: [{filename: "FVSTR20240566809.pdf"}],
  },
  {
    id: "2",
    type: "document",
    source: "Allegro",
    subject: "Faktura za zakup",
    amount: 129.99,
    invoiceDate: "2025-06-01",
    receivedAt: "2025-06-01T10:00:00.000Z",
    fromLabel: "Allegro",
    fromAddress: "noreply@allegro.pl",
    attachments: [{filename: "faktura.pdf"}],
  },
  {
    id: "3",
    type: "document",
    source: "iPOS",
    subject: "Faktura za usługi iPOS",
    amount: 49.5,
    invoiceDate: "2025-05-15",
    receivedAt: "2025-05-15T10:00:00.000Z",
    attachments: [{filename: "Faktura_2025-05.pdf"}],
  },
];

describe("importDocumentDisplay filters", () => {
  it("searches by invoice number, subject and attachment name", () => {
    expect(
      matchesImportDocumentSearch(sampleDocuments[0], "FV/STR/2024/05/66809"),
    ).toBe(true);
    expect(matchesImportDocumentSearch(sampleDocuments[1], "allegro")).toBe(true);
    expect(matchesImportDocumentSearch(sampleDocuments[2], "Faktura_2025-05")).toBe(
      true,
    );
    expect(matchesImportDocumentSearch(sampleDocuments[0], "allegro")).toBe(false);
  });

  it("filters by source, amount and period", () => {
    const booksyOnly = filterImportDocuments(sampleDocuments, {
      ...DEFAULT_IMPORT_DOCUMENT_FILTERS,
      source: "Booksy",
    });
    expect(booksyOnly).toHaveLength(1);
    expect(booksyOnly[0].source).toBe("Booksy");

    const withAmount = filterImportDocuments(sampleDocuments, {
      ...DEFAULT_IMPORT_DOCUMENT_FILTERS,
      amount: IMPORT_DOCUMENT_AMOUNT_FILTERS.withAmount,
    });
    expect(withAmount).toHaveLength(2);

    const withoutAmount = filterImportDocuments(sampleDocuments, {
      ...DEFAULT_IMPORT_DOCUMENT_FILTERS,
      amount: IMPORT_DOCUMENT_AMOUNT_FILTERS.withoutAmount,
    });
    expect(withoutAmount).toHaveLength(1);

    const fixedToday = new Date("2025-06-11");

    expect(
      matchesImportDocumentPeriod(
        sampleDocuments[1],
        IMPORT_DOCUMENT_PERIOD_FILTERS.month,
        fixedToday,
      ),
    ).toBe(true);
    expect(
      matchesImportDocumentPeriod(
        sampleDocuments[0],
        IMPORT_DOCUMENT_PERIOD_FILTERS.year,
        fixedToday,
      ),
    ).toBe(false);
    expect(
      matchesImportDocumentPeriod(
        sampleDocuments[1],
        IMPORT_DOCUMENT_PERIOD_FILTERS.year,
        fixedToday,
      ),
    ).toBe(true);
  });

  it("builds source options with counts", () => {
    expect(getImportDocumentSourceOptions(sampleDocuments)).toEqual([
      {value: "Allegro", label: "Allegro", count: 1},
      {value: "Booksy", label: "Booksy", count: 1},
      {value: "iPOS", label: "iPOS", count: 1},
    ]);
  });

  it("detects active filters", () => {
    expect(hasActiveImportDocumentFilters(DEFAULT_IMPORT_DOCUMENT_FILTERS)).toBe(
      false,
    );
    expect(
      hasActiveImportDocumentFilters({
        ...DEFAULT_IMPORT_DOCUMENT_FILTERS,
        search: "booksy",
      }),
    ).toBe(true);
  });
});
