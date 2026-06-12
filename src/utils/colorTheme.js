import {
  COLOR_THEMES,
  COLOR_THEME_IDS,
  DEFAULT_COLOR_THEME_ID,
} from "../constants/colorThemes.js";

const PURPLE_ACCENTS = new Set([
  "#5e6ad2",
  "#7c6cf2",
  "#8b7cf6",
  "#6f6b8f",
  "#6975e6",
]);

const GOLD_ACCENTS = new Set(["#d2ad7d", "#b8956b", "#c4a574", "#eed5b2"]);

export const isColorThemeId = (value) =>
  COLOR_THEME_IDS.includes(String(value ?? ""));

export const resolveColorTheme = (settings = {}) => {
  if (isColorThemeId(settings.colorTheme)) {
    return COLOR_THEMES[settings.colorTheme];
  }

  if (settings.theme === "light") {
    return COLOR_THEMES.light;
  }

  const accent = String(settings.accentColor ?? "").toLowerCase();

  if (PURPLE_ACCENTS.has(accent)) {
    return COLOR_THEMES["dark-purple"];
  }

  if (GOLD_ACCENTS.has(accent)) {
    return COLOR_THEMES["dark-gold"];
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
