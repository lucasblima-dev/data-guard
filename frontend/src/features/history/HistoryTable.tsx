import { motion } from "framer-motion";
import { ArrowUpRight, FileSpreadsheet } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { easeOutExpo } from "../../lib/motion";
import { formatBytes, formatDate, formatTime } from "../../lib/format";
import { jobStatusMeta } from "../../lib/status";
import type { AnalysisJob } from "../../types/analysis";

const row = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easeOutExpo, delay: Math.min(i, 12) * 0.04 },
  }),
};

function actionLabel(job: AnalysisJob): string {
  if (job.status === "concluida") return "Ver diagnóstico";
  if (job.status === "falhou") return "Ver detalhes";
  return "Acompanhar";
}

export function HistoryTable({ items }: { items: AnalysisJob[] }) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="text-2xs uppercase tracking-wider text-fg-subtle">
          <th className="px-6 py-4 font-medium">Arquivo</th>
          <th className="hidden px-4 py-4 font-medium sm:table-cell">Enviado em</th>
          <th className="hidden px-4 py-4 font-medium md:table-cell">Tamanho</th>
          <th className="px-4 py-4 font-medium">Status</th>
          <th className="px-6 py-4 text-right font-medium">
            <span className="sr-only">Ação</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((job, i) => {
          const meta = jobStatusMeta[job.status];
          return (
            <motion.tr
              key={job.id}
              custom={i}
              variants={row}
              initial="hidden"
              animate="show"
              className="group border-t border-line transition-colors hover:bg-fg/[0.03]"
            >
              <td className="px-6 py-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-fg/[0.05] text-fg-muted">
                    <FileSpreadsheet className="size-4" strokeWidth={1.5} />
                  </span>
                  <span className="data max-w-[16rem] truncate text-sm" title={job.original_filename}>
                    {job.original_filename}
                  </span>
                </div>
              </td>
              <td className="hidden px-4 py-5 text-sm text-fg-muted sm:table-cell">
                {formatDate(job.created_at)}
                <span className="ml-2 text-fg-subtle">{formatTime(job.created_at)}</span>
              </td>
              <td className="hidden px-4 py-5 font-mono text-xs text-fg-muted md:table-cell">
                {formatBytes(job.file_size_bytes)}
              </td>
              <td className="px-4 py-5">
                <Badge tone={meta.tone} live={meta.active}>
                  {meta.label}
                </Badge>
              </td>
              <td className="px-6 py-5 text-right">
                <Link
                  to={`/analyses/${job.id}`}
                  className="focus-ring inline-flex items-center gap-1 rounded-control text-sm text-fg-muted transition-colors group-hover:text-accent"
                >
                  {actionLabel(job)}
                  <ArrowUpRight
                    className="size-3.5 -translate-x-0.5 translate-y-0.5 opacity-0 transition-all group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100"
                    strokeWidth={1.75}
                  />
                </Link>
              </td>
            </motion.tr>
          );
        })}
      </tbody>
    </table>
  );
}
