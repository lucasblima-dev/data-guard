import { motion } from "framer-motion";
import { stagger } from "../../lib/motion";
import type { FullAnalysisDetails } from "../../types/analysis";
import { ExecutiveSummary, ReportFooterCards } from "../report/ExecutiveReport";
import { ColumnsProfile } from "./ColumnsProfile";
import { FindingsPanel } from "./FindingsPanel";
import { HealthHero } from "./HealthHero";

interface Props {
  details: FullAnalysisDetails;
  /** Mantem os blocos ocultos (durante a animacao de conclusao). */
  hold?: boolean;
  /** O hero ja mostrou o total de registros: nao conta de novo. */
  instantHero?: boolean;
  onPrint: () => void;
}

/**
 * Resultado da analise em blocos, do geral ao especifico:
 * veredito (hero + resumo) -> achados com acoes -> perfil das colunas -> acoes e limitacoes.
 */
export function ResultsDashboard({ details, hold = false, instantHero = false, onPrint }: Props) {
  const { profile, report } = details;
  if (!profile) return null;
  const findings = details.findings ?? [];

  return (
    <motion.div
      variants={stagger(0.05)}
      initial="hidden"
      animate={hold ? "hidden" : "show"}
      className="grid gap-4 xl:grid-cols-12"
    >
      <div className={`${report ? "xl:col-span-8" : "xl:col-span-12"} [&>*]:h-full`}>
        <HealthHero
          profile={profile}
          findings={findings}
          score={details.health_score ?? null}
          onPrint={onPrint}
          instant={instantHero}
        />
      </div>
      {report && <ExecutiveSummary report={report} />}

      <FindingsPanel findings={findings} report={report} />
      <ColumnsProfile profile={profile} findings={findings} />

      {report && <ReportFooterCards report={report} />}
    </motion.div>
  );
}
