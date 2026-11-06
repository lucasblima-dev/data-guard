import { AnimatePresence, motion } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";
import { easeOutExpo } from "../../lib/motion";
import { Header } from "./Header";

export function AppLayout() {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="focus-ring sr-only z-50 rounded-control bg-surface-solid px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Ir para o conteúdo
      </a>
      <Header />
      <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: easeOutExpo }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className="px-6 py-6 text-center text-2xs text-fg-subtle">
        DataGuard · Auditoria e perfilamento de dados tabulares
      </footer>
    </div>
  );
}
