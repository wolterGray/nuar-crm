import {describe, expect, it} from "vitest";
import {
  applyColorTheme,
  resolveColorTheme,
  syncSettingsWithColorTheme,
} from "./colorTheme.js";

describe("colorTheme", () => {
  it("resolves explicit colorTheme ids", () => {
    expect(resolveColorTheme({colorTheme: "dark"}).id).toBe("dark");
    expect(resolveColorTheme({colorTheme: "dark"}).accentColor).toBe("#b91c1c");
    expect(resolveColorTheme({colorTheme: "light"}).mode).toBe("light");
  });

  it("migrates legacy light theme", () => {
    expect(resolveColorTheme({theme: "light"}).id).toBe("light");
  });

  it("migrates legacy purple accent to current dark theme", () => {
    expect(resolveColorTheme({theme: "dark", accentColor: "#7c6cf2"}).id).toBe(
      "dark",
    );
  });

  it("migrates legacy gold accent to current dark theme", () => {
    expect(resolveColorTheme({theme: "dark", accentColor: "#d2ad7d"}).id).toBe(
      "dark",
    );
  });

  it("syncSettingsWithColorTheme normalizes stored settings", () => {
    const synced = syncSettingsWithColorTheme({
      theme: "dark",
      accentColor: "#7c6cf2",
    });

    expect(synced.colorTheme).toBe("dark");
    expect(synced.theme).toBe("dark");
    expect(synced.accentColor).toBe("#b91c1c");
  });

  it("applyColorTheme resolves theme object", () => {
    const theme = applyColorTheme({colorTheme: "dark"});

    expect(theme.id).toBe("dark");
    expect(theme.mode).toBe("dark");
    expect(theme.accentColor).toBe("#b91c1c");
  });
});
