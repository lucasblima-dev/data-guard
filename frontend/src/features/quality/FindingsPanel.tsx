import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { fadeUp, stagger } from "../../lib/motion";
import { severityMeta } from "../../lib/status";
import type { QualityFinding } from "../../types/analysis";

const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };

export function FindingsPanel({ findings }: { findings: QualityFinding[] }) {
  const sorted = [...findings].sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));

  return (
    <Card className="relative min-h-80 lg:col-span-4 lg:row-span-2">
      <div className="flex flex-col p-6 lg:absolute lg:inset-0">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium">Achados de qualidade</h3>
          <span className="data text-xs text-fg-subtle">{findings.length}</span>
        </div>

        {sorted.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
            <ShieldCheck className="size-5 text-ok" strokeWidth={1.5} />
            <p className="text-sm text-fg-muted">Nenhum problema detectado.</p>
          </div>
        ) : (
          <motion.ul
            variants={stagger(0.04)}
            initial="hidden"
            animate="show"
            className="-mx-2 mt-4 flex max-h-[28rem] flex-col gap-1 overflow-y-auto px-2 lg:max-h-none lg:flex-1"
          >
            {sorted.map((f) => {
              const meta = severityMeta[f.severity] ?? { label: f.severity, tone: "neutral" as const };
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
                  {f.target_column && (
                    <p className="data mt-1 text-2xs text-accent-ink/80">{f.target_column}</p>
                  )}
                  <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{f.description}</p>
                  {f.evidence && <p className="data mt-1.5 text-2xs text-fg-subtle">{f.evidence}</p>}
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </div>
    </Card>
  );
}
