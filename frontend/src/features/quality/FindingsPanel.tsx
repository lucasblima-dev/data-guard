import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { insightsByCode, severityRank } from "../../lib/insights";
import { fadeUp, stagger } from "../../lib/motion";
import { severityMeta } from "../../lib/status";
import type { QualityFinding, QualityReport } from "../../types/analysis";

const SUMMARY: { key: string; one: string; many: string }[] = [
  { key: "critical", one: "crítico", many: "críticos" },
  { key: "warning", one: "atenção", many: "atenção" },
  { key: "info", one: "informativo", many: "informativos" },
];

interface Props {
  findings: QualityFinding[];
  report: QualityReport | null | undefined;
}

/** Achados com a interpretacao e a acao sugerida do relatorio junto de cada um. */
export function FindingsPanel({ findings, report }: Props) {
  const sorted = [...findings].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const insights = insightsByCode(report);
  const counts = SUMMARY.map((s) => ({ ...s, n: findings.filter((f) => f.severity === s.key).length })).filter(
    (s) => s.n > 0,
  );

  return (
    <Card className="p-6 xl:col-span-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">Achados de qualidade</h3>
        <p className="data text-2xs text-fg-subtle">
          {counts.length ? counts.map((c) => `${c.n} ${c.n === 1 ? c.one : c.many}`).join(" · ") : "nenhum"}
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <ShieldCheck className="size-5 text-ok" strokeWidth={1.5} />
          <p className="text-sm text-fg-muted">Nenhum problema detectado.</p>
        </div>
      ) : (
        <motion.ul
          variants={stagger(0.04)}
          initial="hidden"
          animate="show"
          className="-mx-2 mt-4 flex max-h-[34rem] flex-col gap-1 overflow-y-auto px-2"
        >
          {sorted.map((f) => {
            const meta = severityMeta[f.severity] ?? { label: f.severity, tone: "neutral" as const };
            const related = insights.get(f.code) ?? [];
            return (
              <motion.li
                key={f.id}
                variants={fadeUp}
                className="rounded-xl border border-transparent p-3 transition-colors duration-150 hover:border-line hover:bg-fg/[0.03]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="data truncate text-xs text-fg">{f.code}</span>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </div>
                {f.target_column && <p className="data mt-1 text-2xs text-accent-ink/80">{f.target_column}</p>}
                <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{f.description}</p>
                {f.evidence && <p className="data mt-1.5 text-2xs text-fg-subtle">{f.evidence}</p>}

                {related.map((insight) => (
                  <div key={insight.interpretation} className="mt-3 space-y-2 border-t border-line pt-3">
                    <p className="text-xs leading-relaxed text-fg-muted">{insight.interpretation}</p>
                    <p className="rounded-lg border border-accent/20 bg-accent/[0.07] p-2.5 text-xs leading-relaxed">
                      <span className="mb-0.5 block text-2xs font-medium uppercase tracking-wider text-accent-ink">
                        Ação sugerida
                      </span>
                      {insight.suggested_action}
                    </p>
                  </div>
                ))}
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </Card>
  );
}
