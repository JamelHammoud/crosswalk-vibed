export type ThemeColor = "#FDE047" | "#8FDBF6" | "#FB92DE" | "#99D789";
export type ThemeMode = "light" | "dark";

export const THEME_COLORS: { id: ThemeColor; name: string }[] = [
  { id: "#FDE047", name: "Sunshine" },
  { id: "#8FDBF6", name: "Sky" },
  { id: "#FB92DE", name: "Blossom" },
  { id: "#99D789", name: "Meadow" },
];

export const DEFAULT_THEME_COLOR: ThemeColor = "#FDE047";
export const DEFAULT_THEME_MODE: ThemeMode = "light";

export function getStoredThemeColor(): ThemeColor {
  const stored = localStorage.getItem("theme_color");
  if (stored && THEME_COLORS.some((c) => c.id === stored)) {
    return stored as ThemeColor;
  }
  return DEFAULT_THEME_COLOR;
}

export function getStoredThemeMode(): ThemeMode {
  const stored = localStorage.getItem("theme_mode");
  if (stored === "light" || stored === "dark") {
    return stored as ThemeMode;
  }
  return DEFAULT_THEME_MODE;
}

export function setStoredThemeColor(color: ThemeColor) {
  localStorage.setItem("theme_color", color);
  applyThemeColor(color);
}

export function setStoredThemeMode(mode: ThemeMode) {
  localStorage.setItem("theme_mode", mode);
  applyThemeMode(mode);
}

export function applyThemeColor(color: ThemeColor) {
  document.documentElement.style.setProperty("--color-primary", color);
}

export function applyThemeMode(mode: ThemeMode) {
  if (mode === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

// Initialize theme mode from storage
export function initializeTheme() {
  const mode = getStoredThemeMode();
  const color = getStoredThemeColor();
  applyThemeMode(mode);
  applyThemeColor(color);
}