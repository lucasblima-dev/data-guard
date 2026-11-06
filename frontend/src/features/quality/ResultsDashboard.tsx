import { motion } from "framer-motion";
import { stagger } from "../../lib/motion";
import type { FullAnalysisDetails } from "../../types/analysis";
import { ExecutiveSummary, InsightCards } from "../report/ExecutiveReport";
import { DatasetMap } from "./DatasetMap";
import { FindingsPanel } from "./FindingsPanel";
import { HealthHero } from "./HealthHero";
import { NullsChart } from "./NullsChart";
import { TypeMix } from "./TypeMix";

/** Resultado da analise em blocos (bento). Exige o perfil do dataset. */
export function ResultsDashboard({ details }: { details: FullAnalysisDetails }) {
  const { profile, report } = details;
  if (!profile) return null;
  const findings = details.findings ?? [];

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="grid gap-4 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <HealthHero
          profile={profile}
          findings={findings}
          score={details.health_score ?? null}
          onPrint={() => window.print()}
        />
      </div>
      <FindingsPanel findings={findings} />
      <div className="lg:col-span-4">
        <DatasetMap profile={profile} />
      </div>
      <div className="lg:col-span-4">
        <NullsChart profile={profile} />
      </div>
      <div className="lg:col-span-4">
        <TypeMix profile={profile} />
      </div>
      {report && <ExecutiveSummary report={report} />}
      {report && <InsightCards report={report} />}
    </motion.div>
  );
}
