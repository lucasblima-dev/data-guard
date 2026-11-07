import { motion } from "framer-motion";
import { OctagonAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { springSoft } from "../../lib/motion";
import type { AnalysisJob } from "../../types/analysis";

export function FailureCard({ job }: { job: AnalysisJob }) {
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={springSoft}
      className="relative overflow-hidden rounded-card border border-danger/25 bg-danger/[0.06] p-6 backdrop-blur-xl"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_oklab,var(--color-danger)_16%,transparent),transparent)]"
      />
      <div className="relative flex items-start gap-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-danger/12 text-danger ring-1 ring-inset ring-danger/20">
          <OctagonAlert className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 space-y-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">A análise não pôde ser concluída</h2>
            <p className="mt-1 text-sm text-fg-muted">
              {job.error_message ?? "Ocorreu um erro durante o processamento do arquivo."}
            </p>
          </div>
          {job.error_code && (
            <p className="inline-flex items-center gap-2 rounded-control bg-danger/10 px-2.5 py-1 font-mono text-xs text-danger">
              <span className="text-fg-subtle">código</span>
              {job.error_code}
            </p>
          )}
          <div>
            <Link to="/upload" className="text-sm text-accent-ink hover:underline">
              Enviar outro arquivo
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
