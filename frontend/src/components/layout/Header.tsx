import { motion } from "framer-motion";
import { History, Upload } from "lucide-react";
import { NavLink } from "react-router-dom";
import { tweenEnter, tweenSnap } from "../../lib/motion";
import { Wordmark } from "../brand/Logo";

const links = [
  { to: "/", label: "Histórico", icon: History, end: true },
  { to: "/upload", label: "Nova análise", icon: Upload, end: false },
] as const;

export function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={tweenEnter}
      className="sticky top-3 z-40 px-4 sm:px-6"
    >
      <div className="glass-strong mx-auto flex h-12 max-w-6xl items-center justify-between rounded-full pl-5 pr-1.5">
        <NavLink to="/" className="focus-ring rounded-control" aria-label="DataGuard, início">
          <Wordmark />
        </NavLink>

        <nav aria-label="Principal" className="flex items-center gap-0.5">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `focus-ring relative flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors duration-150 ${
                  isActive ? "text-accent-fg" : "text-fg-muted hover:text-fg"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      transition={tweenSnap}
                      className="absolute inset-0 rounded-full bg-accent shadow-[0_0_24px_-6px_var(--color-accent)]"
                    />
                  )}
                  <Icon className="relative size-3.5" strokeWidth={2} />
                  <span className="relative hidden sm:inline">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </motion.header>
  );
}
