export type Theme = "light" | "dark";

export function applyThemeToDocument(theme: Theme) {
  document.documentElement.classList.toggle("theme-dark", theme === "dark");
}

