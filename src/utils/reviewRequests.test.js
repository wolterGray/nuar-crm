import {describe, expect, it} from "vitest";
import {
  buildDueReviewRequests,
  buildTelegramReviewLink,
  defaultReviewRequestTemplate,
  getCalendarVisitEndDateTime,
  isReviewRequestDue,
  personalizeReviewTemplate,
  wasReviewRequestSent,
} from "./reviewRequests.js";

describe("reviewRequests", () => {
  const entry = {
    id: "v1",
    kind: "visit",
    client: "Anna",
    date: "12.06.2026",
    time: "10:00",
    duration: 60,
    status: "completed",
    service: "Relaks",
    master: "Kasia",
    phone: "600123456",
  };

  const appSettings = {
    reviewRequestsEnabled: true,
    reviewRequestDelayHours: 2,
    reviewGoogleUrl: "https://g.page/nuar/review",
    reviewRequestTemplate: defaultReviewRequestTemplate,
    studioName: "NUAR",
  };

  it("detects due review window after visit end", () => {
    const end = getCalendarVisitEndDateTime(entry);
    const now = new Date(end.getTime() + 2 * 60 * 60 * 1000);

    expect(isReviewRequestDue(entry, appSettings, now)).toBe(true);
  });

  it("builds pending review request with review url", () => {
    const end = getCalendarVisitEndDateTime(entry);
    const now = new Date(end.getTime() + 2 * 60 * 60 * 1000);
    const due = buildDueReviewRequests({
      appSettings,
      calendarEntries: [entry],
      clientProfiles: [{id: 1, name: "Anna", phone: "600123456"}],
      now,
      reviewRequestLog: [],
    });

    expect(due).toHaveLength(1);
    expect(due[0].status).toBe("pending");
    expect(due[0].message).toContain("https://g.page/nuar/review");
  });

  it("skips already sent review requests", () => {
    expect(
      wasReviewRequestSent(
        [
          {
            calendarEntryId: "v1",
            key: "review:v1:12.06.2026:10:00",
            status: "sent",
            visitDate: "12.06.2026",
            visitTime: "10:00",
          },
        ],
        entry,
      ),
    ).toBe(true);
  });

  it("builds telegram deep link with message", () => {
    expect(buildTelegramReviewLink("@anna", "Dziekujemy!")).toBe(
      "https://t.me/anna?text=Dziekujemy!",
    );
  });

  it("personalizes template placeholders", () => {
    expect(
      personalizeReviewTemplate(
        "Cześć {name}, link: {googleUrl}",
        {clientName: "Anna", googleUrl: "https://google.test"},
      ),
    ).toBe("Cześć Anna, link: https://google.test");
  });
});
