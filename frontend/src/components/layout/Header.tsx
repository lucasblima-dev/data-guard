import { AnimatePresence, motion } from "framer-motion";
import { History, Moon, ShieldCheck, Sun, Upload } from "lucide-react";
import { NavLink } from "react-router-dom";
import { springSnappy } from "../../lib/motion";
import { useTheme } from "../../hooks/useTheme";

const links = [
  { to: "/", label: "Histórico", icon: History, end: true },
  { to: "/upload", label: "Nova análise", icon: Upload, end: false },
] as const;

export function Header() {
  const { theme, toggle } = useTheme();

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-3 z-40 px-4 sm:px-6"
    >
      <div className="glass-strong mx-auto flex h-12 max-w-6xl items-center justify-between rounded-card pl-4 pr-2">
        <NavLink to="/" className="focus-ring flex items-center gap-2 rounded-control" aria-label="DataGuard, início">
          <ShieldCheck className="size-[18px] text-accent" strokeWidth={1.75} />
          <span className="text-sm font-semibold tracking-tight">DataGuard</span>
        </NavLink>

        <nav aria-label="Principal" className="flex items-center gap-0.5">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `focus-ring relative flex h-8 items-center gap-1.5 rounded-control px-3 text-sm font-medium transition-colors ${
                  isActive ? "text-fg" : "text-fg-muted hover:text-fg"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      transition={springSnappy}
                      className="absolute inset-0 rounded-control bg-fg/8 ring-1 ring-inset ring-line"
                    />
                  )}
                  <Icon className="relative size-3.5" strokeWidth={1.75} />
                  <span className="relative hidden sm:inline">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <motion.button
          type="button"
          onClick={toggle}
          whileTap={{ scale: 0.92 }}
          transition={springSnappy}
          aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
          className="focus-ring grid size-8 place-items-center rounded-control text-fg-muted transition-colors hover:bg-fg/5 hover:text-fg"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={theme}
              initial={{ opacity: 0, rotate: -40, scale: 0.7 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 40, scale: 0.7 }}
              transition={{ duration: 0.18 }}
              className="grid place-items-center"
            >
              {theme === "dark" ? <Sun className="size-4" strokeWidth={1.75} /> : <Moon className="size-4" strokeWidth={1.75} />}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.header>
  );
}
