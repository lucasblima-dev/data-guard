import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "dg-theme";
const THEME_COLOR: Record<Theme, string> = { dark: "#0a0a0b", light: "#f4f4f0" };

/** O tema inicial e aplicado por um script em index.html, antes da primeira pintura. */
function readCurrent(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

let current: Theme = readCurrent();
const listeners = new Set<() => void>();

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
  document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", theme);
}

export function setTheme(theme: Theme): void {
  if (theme === current) return;
  current = theme;
  apply(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* armazenamento indisponivel: a escolha vale apenas ate recarregar */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, () => current, () => "dark");
}
