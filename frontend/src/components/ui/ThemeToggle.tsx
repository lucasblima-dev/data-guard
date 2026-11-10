import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useId } from "react";
import { tweenSnap } from "../../lib/motion";
import { setTheme, useTheme, type Theme } from "../../lib/theme";

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
];

/** Seletor de tema. `compact` mostra apenas o icone (cabecalho mobile). */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  const pillId = useId();

  if (compact) {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const Icon = theme === "dark" ? Sun : Moon;
    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        aria-label={next === "light" ? "Mudar para o modo claro" : "Mudar para o modo escuro"}
        className="focus-ring grid size-10 place-items-center rounded-xl text-fg-muted transition-colors hover:bg-fg/5 hover:text-fg"
      >
        <Icon className="size-4" strokeWidth={1.9} />
      </button>
    );
  }

  return (
    <div role="radiogroup" aria-label="Tema da interface" className="hairline flex rounded-full bg-fg/[0.04] p-1">
      {options.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={`focus-ring relative flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-medium transition-colors duration-150 ${
              active ? "text-accent-fg" : "text-fg-muted hover:text-fg"
            }`}
          >
            {active && (
              <motion.span
                layoutId={`theme-pill-${pillId}`}
                transition={tweenSnap}
                className="absolute inset-0 rounded-full bg-accent"
              />
            )}
            <Icon className="relative size-3.5" strokeWidth={2} />
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
