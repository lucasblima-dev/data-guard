import { motion } from "framer-motion";
import { OctagonAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { springSoft } from "../../lib/motion";
import type { AnalysisJob } from "../../types/analysis";

interface ErrorMeta {
  stage: string;
  fallbackMessage: string;
}

const ERROR_CODE_META: Record<string, ErrorMeta> = {
  MESSAGING_BROKER_UNAVAILABLE: {
    stage: "Mensageria",
    fallbackMessage: "Não foi possível enfileirar a análise no momento. Tente enviar novamente em instantes.",
  },
  INVALID_EVENT_PAYLOAD: {
    stage: "Mensageria",
    fallbackMessage: "O evento de processamento foi rejeitado por formato inválido.",
  },
  CSV_FILE_NOT_FOUND: {
    stage: "Qualidade de dados",
    fallbackMessage: "O arquivo CSV não foi localizado no armazenamento compartilhado.",
  },
  INVALID_CSV_CONTENT: {
    stage: "Qualidade de dados",
    fallbackMessage: "Não foi possível interpretar o conteúdo do CSV. Verifique a estrutura e codificação.",
  },
  QUALITY_PROCESSING_FAILED: {
    stage: "Qualidade de dados",
    fallbackMessage: "O motor determinístico de qualidade não pôde concluir o processamento após novas tentativas.",
  },
  DATA_QUALITY_SERVICE_UNAVAILABLE: {
    stage: "Qualidade de dados",
    fallbackMessage: "O motor determinístico de qualidade está temporariamente indisponível.",
  },
  QUALITY_DETAILS_FETCH_FAILED: {
    stage: "Qualidade de dados",
    fallbackMessage: "Não foi possível recuperar os detalhes de qualidade calculados.",
  },
  QUALITY_PROFILE_NOT_FOUND: {
    stage: "Síntese de relatório",
    fallbackMessage: "Os dados de perfilamento não foram encontrados para gerar o relatório técnico.",
  },
  INTELLIGENCE_PROCESSING_FAILED: {
    stage: "Síntese de relatório",
    fallbackMessage: "O serviço de inteligência não pôde concluir a geração do relatório técnico.",
  },
  INTELLIGENCE_SERVICE_UNAVAILABLE: {
    stage: "Síntese de relatório",
    fallbackMessage: "O serviço de inteligência está temporariamente indisponível.",
  },
};

export function FailureCard({ job }: { job: AnalysisJob }) {
  const errorMeta = job.error_code ? ERROR_CODE_META[job.error_code] : undefined;
  const message =
    job.error_message ?? errorMeta?.fallbackMessage ?? "Ocorreu um erro durante o processamento do arquivo.";

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
            <p className="mt-1 text-sm text-fg-muted">{message}</p>
          </div>
          {job.error_code && (
            <div className="flex flex-wrap items-center gap-2">
              {errorMeta && (
                <span className="inline-flex items-center rounded-control border border-danger/20 bg-danger/5 px-2.5 py-1 text-xs text-fg-muted">
                  {errorMeta.stage}
                </span>
              )}
              <p className="inline-flex items-center gap-2 rounded-control bg-danger/10 px-2.5 py-1 font-mono text-xs text-danger">
                <span className="text-fg-subtle">código</span>
                {job.error_code}
              </p>
            </div>
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
