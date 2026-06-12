import {describe, expect, it} from "vitest";
import {
  parseBooksyGmailMessage,
  scoreExtractionConfidence,
} from "./booksyGmailParser.js";
import {matchExtractedEventToCalendar, reviewKindLabel} from "./matching.js";

const sampleBookingEmail = {
  from_address: "Booksy <noreply@booksy.com>",
  subject: "Anna Kowalska: nowa rezerwacja",
  body_text: `
Anna Kowalska
12 czerwca 2026
10:00 - 11:00
Usługa: Manicure hybrydowy
Pracownik: Helga
+48 500 100 200
anna@example.com
150,00 zł
  `,
};

describe("booksyGmailParser", () => {
  it("extracts booking fields from a Booksy email", () => {
    const parsed = parseBooksyGmailMessage(sampleBookingEmail, {
      employees: [{name: "Ольга"}],
      services: [{name: "Manicure hybrydowy"}],
    });

    expect(parsed).toMatchObject({
      client_name: "Anna Kowalska",
      client_phone: "+48 500 100 200",
      client_email: "anna@example.com",
      service_name: "Manicure hybrydowy",
      staff_name: "Ольга",
      appointment_date: "2026-06-12",
      start_time: "10:00",
      end_time: "11:00",
      duration_minutes: 60,
      price: 150,
      status: "new",
    });
    expect(parsed?.confidence_score).toBeGreaterThanOrEqual(90);
  });

  it("detects cancellation emails", () => {
    const parsed = parseBooksyGmailMessage(
      {
        from_address: "Booksy",
        subject: "Anulowana rezerwacja",
        body_text: "Anna Kowalska\n12 czerwca 2026\n10:00 - 11:00\nanulowana wizyta",
      },
      {employees: [], services: []},
    );

    expect(parsed?.status).toBe("cancelled");
  });
});

describe("booksy matching", () => {
  it("finds a likely duplicate visit", () => {
    const extracted = parseBooksyGmailMessage(sampleBookingEmail, {
      employees: [{name: "Ольга"}],
      services: [{name: "Manicure hybrydowy"}],
    });

    const result = matchExtractedEventToCalendar(
      extracted,
      [
        {
          id: "visit-1",
          kind: "visit",
          date: "2026-06-12",
          time: "10:00",
          duration: 60,
          client: "Anna Kowalska",
          master: "Ольга",
          service: "Manicure hybrydowy",
        },
      ],
      [{id: "client-1", name: "Anna Kowalska", phone: "+48 500 100 200"}],
    );

    expect(result.bestMatch?.match_score).toBeGreaterThanOrEqual(90);
    expect(result.reviewKind).toBe("possible_duplicate");
    expect(reviewKindLabel(result.reviewKind)).toBe("Возможно, дубликат");
  });

  it("marks incomplete extraction as needs review", () => {
    const extracted = {
      client_name: "",
      client_phone: "",
      client_email: "",
      service_name: "",
      staff_name: "",
      appointment_date: null,
      start_time: null,
      end_time: null,
      duration_minutes: 60,
      price: null,
      currency: "PLN",
      status: "new",
      client_note: "",
      missing_fields: ["client_name", "appointment_date", "start_time"],
      confidence_score: scoreExtractionConfidence({
        client_name: "",
        appointment_date: null,
        start_time: null,
      }),
    };

    const result = matchExtractedEventToCalendar(extracted, [], []);
    expect(result.reviewKind).toBe("needs_review");
  });
});
