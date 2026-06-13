import {describe, expect, it} from "vitest";
import {defaultAppSettings} from "../constants/appDefaults.js";
import {parseSettingsForm, parseSiteBookingNotifyForm} from "./settingsForm.js";

const buildForm = (entries) => {
  const form = new FormData();

  for (const [key, value] of entries) {
    form.set(key, value);
  }

  return form;
};

describe("settingsForm", () => {
  it("keeps site booking notify settings when saving main settings form", () => {
    const appSettings = {
      ...defaultAppSettings,
      ownerNotifyPhone: "600123456",
      siteBookingNotifyTelegramEnabled: true,
      siteBookingNotifyWhatsappEnabled: true,
      telegramChatId: "123456789",
    };
    const form = buildForm([
      ["studioName", "NUAR"],
      ["ownerName", "Owner"],
      ["colorTheme", "slate"],
      ["telegramDigestEnabled", "on"],
      ["telegramDigestTime", "08:00"],
    ]);

    expect(parseSettingsForm(form, appSettings, defaultAppSettings)).toMatchObject({
      siteBookingNotifyTelegramEnabled: true,
      siteBookingNotifyWhatsappEnabled: true,
      telegramChatId: "123456789",
      ownerNotifyPhone: "600123456",
    });
  });

  it("updates site booking notify settings from site page form", () => {
    const appSettings = {
      ...defaultAppSettings,
      siteBookingNotifyTelegramEnabled: true,
      siteBookingNotifyWhatsappEnabled: true,
      telegramChatId: "123456789",
    };
    const form = buildForm([
      ["telegramChatId", "987654321"],
      ["siteBookingNotifyTelegramEnabled", "on"],
      ["ownerNotifyPhone", "500111222"],
    ]);

    expect(parseSiteBookingNotifyForm(form, appSettings)).toEqual({
      ...appSettings,
      ownerNotifyPhone: "500111222",
      siteBookingNotifyTelegramEnabled: true,
      siteBookingNotifyWhatsappEnabled: false,
      telegramChatId: "987654321",
    });
  });
});
