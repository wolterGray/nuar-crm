import {
  COLOR_THEMES,
  COLOR_THEME_IDS,
  DEFAULT_COLOR_THEME_ID,
} from "../constants/colorThemes.js";

const LEGACY_DARK_THEME_IDS = new Set(["dark-purple", "dark-gold"]);

export const isColorThemeId = (value) =>
  COLOR_THEME_IDS.includes(String(value ?? ""));

export const resolveColorTheme = (settings = {}) => {
  if (isColorThemeId(settings.colorTheme)) {
    return COLOR_THEMES[settings.colorTheme];
  }

  if (LEGACY_DARK_THEME_IDS.has(String(settings.colorTheme ?? ""))) {
    return COLOR_THEMES.dark;
  }

  if (settings.theme === "light") {
    return COLOR_THEMES.light;
  }

  return COLOR_THEMES[DEFAULT_COLOR_THEME_ID];
};

export const syncSettingsWithColorTheme = (settings = {}) => {
  const theme = resolveColorTheme(settings);

  return {
    ...settings,
    colorTheme: theme.id,
    theme: theme.mode,
    accentColor: theme.accentColor,
  };
};

export const applyColorTheme = (settings = {}) => {
  const theme = resolveColorTheme(settings);

  if (typeof document === "undefined") {
    return theme;
  }

  const root = document.documentElement;

  root.dataset.colorTheme = theme.id;

  Object.entries(theme.tokens).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });

  root.style.setProperty("--accent-color", theme.accentColor);
  document.body.style.backgroundColor = theme.tokens["--app-bg"] ?? "";

  return theme;
};
