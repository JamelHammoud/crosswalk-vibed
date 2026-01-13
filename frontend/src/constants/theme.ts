export type ThemeColor = "#FDE047" | "#8FDBF6" | "#FB92DE" | "#99D789";

export const THEME_COLORS: { id: ThemeColor; name: string }[] = [
  { id: "#FDE047", name: "Sunshine" },
  { id: "#8FDBF6", name: "Sky" },
  { id: "#FB92DE", name: "Blossom" },
  { id: "#99D789", name: "Meadow" },
];

export const DEFAULT_THEME_COLOR: ThemeColor = "#FDE047";

export function getStoredThemeColor(): ThemeColor {
  const stored = localStorage.getItem("theme_color");
  if (stored && THEME_COLORS.some((c) => c.id === stored)) {
    return stored as ThemeColor;
  }
  return DEFAULT_THEME_COLOR;
}

export function setStoredThemeColor(color: ThemeColor) {
  localStorage.setItem("theme_color", color);
  applyThemeColor(color);
}

export function applyThemeColor(color: ThemeColor) {
  document.documentElement.style.setProperty("--color-primary", color);
}
