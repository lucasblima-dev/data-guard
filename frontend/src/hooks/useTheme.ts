import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

function readTheme(): Theme {
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

/** Alterna a classe `light`/`dark` no <html>; a escolha manual persiste em localStorage. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("dg-theme", next);
      } catch {
        /* storage indisponivel: ignora */
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
