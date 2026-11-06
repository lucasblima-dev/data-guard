import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { easeOutExpo } from "../../lib/motion";
import { severityMeta } from "../../lib/status";
import type { QualityFinding } from "../../types/analysis";

const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };

export function FindingsTable({ findings }: { findings: QualityFinding[] }) {
  const sorted = [...findings].sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold tracking-tight">Achados de qualidade</h2>
      <Card className="overflow-hidden">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <ShieldCheck className="size-5 text-ok" strokeWidth={1.5} />
            <p className="text-sm text-fg-muted">Nenhum problema de qualidade foi detectado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left">
              <thead>
                <tr className="text-2xs uppercase tracking-wider text-fg-subtle">
                  <th className="px-6 py-4 font-medium">Achado</th>
                  <th className="px-4 py-4 font-medium">Severidade</th>
                  <th className="px-4 py-4 font-medium">Coluna</th>
                  <th className="px-4 py-4 font-medium">Descrição</th>
                  <th className="px-6 py-4 text-right font-medium">Evidência</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((f, i) => {
                  const meta = severityMeta[f.severity] ?? { label: f.severity, tone: "neutral" as const };
                  return (
                    <motion.tr
                      key={f.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: easeOutExpo, delay: Math.min(i, 12) * 0.04 }}
                      className="border-t border-line align-top transition-colors hover:bg-fg/[0.03]"
                    >
                      <td className="px-6 py-4 font-mono text-xs">{f.code}</td>
                      <td className="px-4 py-4">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-fg-muted">{f.target_column ?? "—"}</td>
                      <td className="max-w-sm px-4 py-4 text-sm text-fg-muted">{f.description}</td>
                      <td className="px-6 py-4 text-right font-mono text-xs text-fg-muted">
                        {f.evidence ?? (f.metric_value !== null ? String(f.metric_value) : "—")}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}
