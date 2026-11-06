import { motion } from "framer-motion";
import { Cpu, Info, ShieldCheck } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { fadeUp, stagger } from "../../lib/motion";
import type { QualityReport } from "../../types/analysis";

/** Resumo executivo (cartao). Os insights ficam em <InsightCards>. */
export function ExecutiveSummary({ report }: { report: QualityReport }) {
  const assisted = report.generation_mode === "llm_assisted";
  return (
    <Card className="flex flex-col gap-4 p-6 lg:col-span-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Resumo executivo</h3>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-2xs text-fg-muted">
          {assisted ? (
            <Cpu className="size-3 text-accent" strokeWidth={1.75} />
          ) : (
            <ShieldCheck className="size-3" strokeWidth={1.75} />
          )}
          {assisted ? "Geração assistida por IA" : "Síntese por regras determinísticas"}
        </span>
      </div>
      <p className="text-base leading-relaxed text-fg/90">{report.executive_summary}</p>
    </Card>
  );
}

export function InsightCards({ report }: { report: QualityReport }) {
  if (report.key_insights.length === 0 && report.limitations.length === 0) return null;
  return (
    <section className="space-y-4 lg:col-span-12">
      {report.key_insights.length > 0 && (
        <motion.div variants={stagger(0.05)} className="grid gap-4 md:grid-cols-3">
          {report.key_insights.map((insight) => (
            <Card key={insight.finding_code + insight.interpretation} variants={fadeUp} className="flex flex-col gap-3 p-5">
              <p className="data text-2xs text-fg-subtle">{insight.finding_code}</p>
              <p className="text-sm leading-relaxed text-fg-muted">{insight.interpretation}</p>
              <p className="mt-auto rounded-xl border border-accent/20 bg-accent/[0.07] p-3 text-xs leading-relaxed">
                <span className="mb-1 block text-2xs font-medium uppercase tracking-wider text-accent">Ação sugerida</span>
                {insight.suggested_action}
              </p>
            </Card>
          ))}
        </motion.div>
      )}
      {report.limitations.length > 0 && (
        <div className="space-y-2 px-1">
          <h3 className="flex items-center gap-2 text-xs font-medium text-fg-subtle">
            <Info className="size-3.5" strokeWidth={1.75} />
            Limitações
          </h3>
          <ul className="space-y-1 text-xs text-fg-muted">
            {report.limitations.map((l) => (
              <li key={l} className="pl-5">
                {l}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
