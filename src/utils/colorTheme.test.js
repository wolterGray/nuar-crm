import {describe, expect, it} from "vitest";
import {
  applyColorTheme,
  resolveColorTheme,
  syncSettingsWithColorTheme,
} from "./colorTheme.js";

describe("colorTheme", () => {
  it("resolves explicit colorTheme ids", () => {
    expect(resolveColorTheme({colorTheme: "dark-purple"}).id).toBe("dark-purple");
    expect(resolveColorTheme({colorTheme: "dark-gold"}).accentColor).toBe("#d2ad7d");
    expect(resolveColorTheme({colorTheme: "light"}).mode).toBe("light");
  });

  it("migrates legacy light theme", () => {
    expect(resolveColorTheme({theme: "light"}).id).toBe("light");
  });

  it("migrates legacy purple accent to dark-purple", () => {
    expect(resolveColorTheme({theme: "dark", accentColor: "#7c6cf2"}).id).toBe(
      "dark-purple",
    );
  });

  it("migrates legacy gold accent to dark-gold", () => {
    expect(resolveColorTheme({theme: "dark", accentColor: "#d2ad7d"}).id).toBe(
      "dark-gold",
    );
  });

  it("syncSettingsWithColorTheme normalizes stored settings", () => {
    const synced = syncSettingsWithColorTheme({
      theme: "dark",
      accentColor: "#7c6cf2",
    });

    expect(synced.colorTheme).toBe("dark-purple");
    expect(synced.theme).toBe("dark");
    expect(synced.accentColor).toBe("#7c5cff");
  });

  it("applyColorTheme resolves theme object", () => {
    const theme = applyColorTheme({colorTheme: "dark-gold"});

    expect(theme.id).toBe("dark-gold");
    expect(theme.mode).toBe("dark");
    expect(theme.accentColor).toBe("#d2ad7d");
  });
});
