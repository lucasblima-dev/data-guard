import { motion } from "framer-motion";
import { History, Upload } from "lucide-react";
import { NavLink } from "react-router-dom";
import { MOCKS_ENABLED } from "../../api/mocks";
import { tweenSnap } from "../../lib/motion";
import { Wordmark } from "../brand/Logo";

const links = [
  { to: "/", label: "Histórico", icon: History, end: true },
  { to: "/upload", label: "Nova análise", icon: Upload, end: false },
] as const;

/** Navegacao lateral (desktop). No mobile, o Header compacto assume. */
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-canvas/70 px-4 py-6 backdrop-blur-xl lg:flex">
      <NavLink to="/" className="focus-ring mb-8 rounded-control px-2" aria-label="DataGuard, início">
        <Wordmark />
      </NavLink>

      <nav aria-label="Principal" className="flex flex-col gap-1">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `focus-ring relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-150 ${
                isActive ? "text-accent-fg" : "text-fg-muted hover:bg-fg/[0.04] hover:text-fg"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="sidebar-pill"
                    transition={tweenSnap}
                    className="absolute inset-0 rounded-xl bg-accent shadow-[0_0_28px_-8px_var(--color-accent)]"
                  />
                )}
                <Icon className="relative size-4" strokeWidth={1.9} />
                <span className="relative">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {MOCKS_ENABLED && (
        <div className="glass mt-auto rounded-2xl p-4">
          <p className="flex items-center gap-2 text-xs font-medium">
            <span className="size-1.5 rounded-full bg-warn" />
            Modo simulado
          </p>
          <p className="mt-1.5 text-2xs leading-relaxed text-fg-subtle">
            Upload e relatório usam dados fictícios. Desligue com VITE_USE_MOCKS=false.
          </p>
        </div>
      )}
    </aside>
  );
}
