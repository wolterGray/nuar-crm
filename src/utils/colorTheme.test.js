import {describe, expect, it} from "vitest";
import {
  applyColorTheme,
  resolveColorTheme,
  syncSettingsWithColorTheme,
} from "./colorTheme.js";

describe("colorTheme", () => {
  it("resolves explicit colorTheme ids", () => {
    expect(resolveColorTheme({colorTheme: "dark"}).id).toBe("dark");
    expect(resolveColorTheme({colorTheme: "dark"}).accentColor).toBe("#e11d2e");
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
    expect(synced.accentColor).toBe("#e11d2e");
  });

  it("applyColorTheme resolves theme object", () => {
    const theme = applyColorTheme({colorTheme: "dark"});

    expect(theme.id).toBe("dark");
    expect(theme.mode).toBe("dark");
    expect(theme.accentColor).toBe("#e11d2e");
  });

  it("resolves Booksy Biz light theme tokens with WCAG AA contrast", () => {
    const light = resolveColorTheme({colorTheme: "light"});

    expect(light.id).toBe("light");
    expect(light.mode).toBe("light");
    expect(light.accentColor).toBe("#F20D3F");
    expect(light.tokens["--app-bg"]).toBe("#F7F7F8");
    expect(light.tokens["--surface"]).toBe("#FFFFFF");
    expect(light.tokens["--text-main"]).toBe("#18181B");
    expect(light.tokens["--accent-color"]).toBe("#F20D3F");
    expect(light.tokens["--brand-teal"]).toBe("#F20D3F");
  });

  it("dark theme keeps NUAR graphite + crimson", () => {
    const dark = resolveColorTheme({colorTheme: "dark"});
    expect(dark.accentColor).toBe("#e11d2e");
    expect(dark.mode).toBe("dark");
  });
});
