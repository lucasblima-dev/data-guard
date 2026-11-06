import { motion } from "framer-motion";
import { Cpu, Info, Lightbulb, ShieldCheck } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { fadeUp, stagger } from "../../lib/motion";
import type { QualityReport } from "../../types/analysis";

export function ExecutiveReport({ report }: { report: QualityReport }) {
  const assisted = report.generation_mode === "llm_assisted";

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">Relatório executivo</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-2xs text-fg-muted">
          {assisted ? (
            <Cpu className="size-3 text-accent" strokeWidth={1.75} />
          ) : (
            <ShieldCheck className="size-3" strokeWidth={1.75} />
          )}
          {assisted ? "Geração assistida por IA" : "Síntese por regras determinísticas"}
        </span>
      </div>

      <Card className="p-6">
        <p className="text-sm leading-relaxed text-fg-muted">{report.executive_summary}</p>
      </Card>

      {report.key_insights.length > 0 && (
        <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2">
          {report.key_insights.map((insight) => (
            <Card key={insight.finding_code + insight.interpretation} variants={fadeUp} className="space-y-3 p-5">
              <p className="flex items-center gap-2 font-mono text-xs text-fg-subtle">
                <Lightbulb className="size-3.5 text-warn" strokeWidth={1.75} />
                {insight.finding_code}
              </p>
              <p className="text-sm text-fg-muted">{insight.interpretation}</p>
              <p className="border-t border-line pt-3 text-sm">
                <span className="text-fg-subtle">Ação sugerida · </span>
                {insight.suggested_action}
              </p>
            </Card>
          ))}
        </motion.div>
      )}

      {report.limitations.length > 0 && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-xs font-medium text-fg-subtle">
            <Info className="size-3.5" strokeWidth={1.75} />
            Limitações
          </h3>
          <ul className="space-y-1.5 text-xs text-fg-muted">
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
