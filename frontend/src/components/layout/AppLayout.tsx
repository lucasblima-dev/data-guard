import { AnimatePresence, motion } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";
import { tweenEnter, tweenExit } from "../../lib/motion";
import { Backdrop } from "../brand/Backdrop";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-dvh flex-col">
      <Backdrop />
      <a
        href="#conteudo"
        className="focus-ring sr-only z-50 rounded-control bg-surface-solid px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Ir para o conteúdo
      </a>
      <Sidebar />
      <div className="flex min-h-dvh flex-1 flex-col lg:pl-60">
        <div className="lg:hidden">
          <Header />
        </div>
        <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-8 lg:py-12">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0, transition: tweenEnter }}
              exit={{ opacity: 0, transition: tweenExit }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
        <footer className="data px-6 py-6 text-center text-2xs text-fg-subtle">
          dataguard · auditoria e perfilamento de dados tabulares
        </footer>
      </div>
    </div>
  );
}
