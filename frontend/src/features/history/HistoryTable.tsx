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

function FileTile() {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-fg/[0.05] text-fg-muted">
      <FileSpreadsheet className="size-4" strokeWidth={1.5} />
    </span>
  );
}

/**
 * Celular (< md): lista de linhas tocaveis, sem colunas escondidas.
 * md+: tabela; em larguras medias (com a barra lateral) a hora, o tamanho e o rotulo da acao
 * saem para a tabela caber sem cortar conteudo.
 */
export function HistoryTable({ items }: { items: AnalysisJob[] }) {
  return (
    <>
      <ul className="divide-y divide-line md:hidden">
        {items.map((job, i) => {
          const meta = jobStatusMeta[job.status];
          return (
            <motion.li key={job.id} custom={i} variants={row} initial="hidden" animate="show">
              <Link
                to={`/analyses/${job.id}`}
                aria-label={`${actionLabel(job)}: ${job.original_filename}`}
                className="focus-ring flex items-center gap-3 px-4 py-4 transition-colors duration-150 hover:bg-fg/[0.03]"
              >
                <FileTile />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="data truncate text-sm" title={job.original_filename}>
                    {job.original_filename}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Badge tone={meta.tone} live={meta.active}>
                      {meta.label}
                    </Badge>
                    <span className="text-2xs text-fg-subtle">
                      {formatDate(job.created_at)} · {formatBytes(job.file_size_bytes)}
                    </span>
                  </div>
                </div>
                <ArrowUpRight className="size-4 shrink-0 text-fg-subtle" strokeWidth={1.75} />
              </Link>
            </motion.li>
          );
        })}
      </ul>

      <table className="hidden w-full border-collapse text-left md:table">
        <thead>
          <tr className="text-2xs uppercase tracking-wider text-fg-subtle">
            <th className="px-5 py-4 font-medium">Arquivo</th>
            <th className="px-4 py-4 font-medium">Enviado em</th>
            <th className="hidden px-4 py-4 font-medium xl:table-cell">Tamanho</th>
            <th className="px-4 py-4 font-medium">Status</th>
            <th className="px-5 py-4 text-right font-medium">
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
                <td className="px-5 py-5">
                  <div className="flex items-center gap-3">
                    <FileTile />
                    <span className="data max-w-[10rem] truncate text-sm xl:max-w-[16rem]" title={job.original_filename}>
                      {job.original_filename}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-5 text-sm text-fg-muted">
                  {formatDate(job.created_at)}
                  <span className="ml-2 hidden text-fg-subtle xl:inline">{formatTime(job.created_at)}</span>
                </td>
                <td className="hidden px-4 py-5 font-mono text-xs text-fg-muted xl:table-cell">
                  {formatBytes(job.file_size_bytes)}
                </td>
                <td className="px-4 py-5">
                  <Badge tone={meta.tone} live={meta.active}>
                    {meta.label}
                  </Badge>
                </td>
                <td className="px-5 py-5 text-right">
                  <Link
                    to={`/analyses/${job.id}`}
                    aria-label={`${actionLabel(job)}: ${job.original_filename}`}
                    className="focus-ring inline-flex items-center gap-1 rounded-control text-sm text-fg-muted transition-colors group-hover:text-accent-ink"
                  >
                    <span className="hidden xl:inline">{actionLabel(job)}</span>
                    <ArrowUpRight
                      className="size-4 transition-all xl:size-3.5 xl:-translate-x-0.5 xl:translate-y-0.5 xl:opacity-0 xl:group-hover:translate-x-0 xl:group-hover:translate-y-0 xl:group-hover:opacity-100"
                      strokeWidth={1.75}
                    />
                  </Link>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
