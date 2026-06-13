import {describe, expect, it} from "vitest";
import {
  DEFAULT_MESSAGE_LANGUAGE,
  mergeAutomatedMessageTemplates,
  resolveAutomatedMessageTemplate,
  resolveClientMessageLanguage,
  resolveMessageTemplateBody,
} from "./messageTemplates.js";

describe("messageTemplates", () => {
  const templates = [
    {
      channel: "SMS",
      language: "Польский",
      purpose: "sms-reminder-24h",
      body: "PL {name}",
    },
    {
      channel: "SMS",
      language: "Русский",
      purpose: "sms-reminder-24h",
      body: "RU {name}",
    },
  ];

  it("resolves explicit client language", () => {
    expect(resolveClientMessageLanguage({messageLanguage: "Английский"})).toBe(
      "Английский",
    );
  });

  it("falls back to polish by default", () => {
    expect(resolveClientMessageLanguage({})).toBe(DEFAULT_MESSAGE_LANGUAGE);
  });

  it("picks template by purpose and language", () => {
    expect(
      resolveMessageTemplateBody({
        language: "Русский",
        messageTemplates: templates,
        purpose: "sms-reminder-24h",
      }),
    ).toBe("RU {name}");
  });

  it("uses legacy settings when templates are missing", () => {
    expect(
      resolveAutomatedMessageTemplate({
        appSettings: {smsReminder24hTemplate: "Legacy {name}"},
        client: {messageLanguage: "Русский"},
        defaultTemplate: "Default {name}",
        messageTemplates: [],
        purpose: "sms-reminder-24h",
      }),
    ).toBe("Legacy {name}");
  });

  it("adds missing automated templates on merge", () => {
    const merged = mergeAutomatedMessageTemplates(templates);

    expect(
      merged.some(
        (item) =>
          item.purpose === "sms-reminder-2h" && item.language === "Польский",
      ),
    ).toBe(true);
  });
});
