import {describe, expect, it} from "vitest";
import {
  buildBulkSmsRecipients,
  defaultBulkSmsTemplate,
  personalizeBulkSmsMessage,
  summarizeBulkSmsRecipients,
} from "./bulkSms.js";

describe("bulkSms", () => {
  const appSettings = {studioName: "NUAR"};
  const clientProfiles = [
    {
      id: "1",
      name: "Anna Kowalska",
      phone: "600123456",
      status: "Постоянный",
      birthday: "1990-06-15",
    },
    {
      id: "2",
      name: "Nowy Klient",
      phone: "500111222",
      status: "Новый",
      birthday: "",
    },
    {
      id: "3",
      name: "Bez Telefonu",
      phone: "",
      status: "Новый",
      birthday: "",
    },
  ];
  const visits = [{client: "Anna Kowalska", date: "01.01.2026", recordType: "visit"}];
  const calendarEntries = [
    {
      id: "v1",
      kind: "visit",
      client: "Anna Kowalska",
      clientId: "1",
      date: "01.01.2026",
      status: "completed",
    },
  ];

  it("builds inactive segment with phone normalization", () => {
    const recipients = buildBulkSmsRecipients({
      appSettings,
      calendarEntries,
      clientProfiles,
      segmentId: "inactive_14",
      template: defaultBulkSmsTemplate,
      visits,
    });

    expect(recipients).toHaveLength(1);
    expect(recipients[0].phone).toBe("48600123456");
    expect(recipients[0].status).toBe("ready");
    expect(recipients[0].message).toContain("Anna");
  });

  it("builds new clients segment and skips clients without phone", () => {
    const recipients = buildBulkSmsRecipients({
      appSettings,
      clientProfiles,
      segmentId: "new_clients",
      template: defaultBulkSmsTemplate,
    });

    expect(recipients).toHaveLength(2);
    expect(
      recipients.find((item) => item.clientName === "Bez Telefonu")?.status,
    ).toBe("no_phone");
    expect(summarizeBulkSmsRecipients(recipients)).toEqual({
      readyCount: 1,
      skippedCount: 1,
      totalCount: 2,
    });
  });

  it("personalizes days placeholder", () => {
    expect(
      personalizeBulkSmsMessage("Minelo {days} dni, {name}", {
        appSettings,
        client: {name: "Anna Kowalska", daysAbsent: 30},
      }),
    ).toContain("30");
  });
});
