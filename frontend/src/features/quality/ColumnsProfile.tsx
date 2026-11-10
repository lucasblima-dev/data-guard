import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { easeOutExpo, tweenEnter } from "../../lib/motion";
import { severityRank } from "../../lib/insights";
import { nullBucket, TYPE_LABELS } from "../../lib/quality";
import type { DatasetProfile, QualityFinding } from "../../types/analysis";

const nf = new Intl.NumberFormat("pt-BR");

const PLURAL: Record<string, string> = {
  numeric: "numéricas",
  categorical: "categóricas",
  temporal: "temporais",
  textual: "textuais",
};

const barColor = {
  clean: "bg-transparent",
  low: "bg-accent",
  mid: "bg-warn",
  high: "bg-danger",
} as const;

const dotColor: Record<string, string> = {
  critical: "bg-danger",
  warning: "bg-warn",
  info: "bg-info",
};

interface Props {
  profile: DatasetProfile;
  findings: QualityFinding[];
}

/** Perfil por coluna: tipo, taxa de nulos e valores unicos, com marca de achados. */
export function ColumnsProfile({ profile, findings }: Props) {
  const entries = Object.entries(profile.columns_summary);

  const rows = entries
    .map(([name, col]) => {
      const related = findings.filter((f) => f.target_column === name);
      const worst = related.sort((a, b) => severityRank(a.severity) - severityRank(b.severity))[0]?.severity ?? null;
      return { name, col, worst, count: related.length };
    })
    .sort((a, b) => b.col.null_percentage - a.col.null_percentage || a.name.localeCompare(b.name));

  const typeCounts = entries.reduce<Record<string, number>>((acc, [, c]) => {
    acc[c.data_type] = (acc[c.data_type] ?? 0) + 1;
    return acc;
  }, {});
  const summary = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${n} ${PLURAL[t] ?? t}`)
    .join(" · ");

  return (
    <Card className="p-6 xl:col-span-5">
      <h3 className="text-sm font-medium">Perfil das colunas</h3>
      <p className="mt-0.5 text-xs text-fg-subtle">
        {entries.length} colunas{summary ? ` · ${summary}` : ""}
      </p>

      <div className="mt-5 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_auto] gap-x-4 px-1 pb-2 text-2xs uppercase tracking-wider text-fg-subtle">
        <span>Coluna</span>
        <span>Nulos</span>
        <span className="text-right">Únicos</span>
      </div>

      <ul className="max-h-[34rem] divide-y divide-line overflow-y-auto">
        {rows.map(({ name, col, worst, count }, i) => {
          const bucket = nullBucket(col.null_percentage);
          const pct = Math.min(100, col.null_percentage);
          return (
            <motion.li
              key={name}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...tweenEnter, delay: 0.2 + Math.min(i, 12) * 0.03 }}
              className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_auto] items-center gap-x-4 px-1 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5">
                  <span className="data truncate text-xs" title={name}>
                    {name}
                  </span>
                  {worst && (
                    <span
                      title={`${count} ${count === 1 ? "achado" : "achados"}`}
                      className={`size-1.5 shrink-0 rounded-full ${dotColor[worst] ?? "bg-fg-subtle"}`}
                    />
                  )}
                </p>
                <p className="mt-0.5 text-2xs text-fg-subtle">{TYPE_LABELS[col.data_type] ?? col.data_type}</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/[0.07]">
                  <motion.div
                    className={`h-full rounded-full ${barColor[bucket]}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: easeOutExpo, delay: 0.25 + Math.min(i, 12) * 0.03 }}
                  />
                </div>
                <span className="data w-12 text-right text-xs text-fg-muted">
                  {col.null_percentage.toFixed(1).replace(".", ",")}%
                </span>
              </div>

              <span className="data text-right text-xs text-fg-muted">{nf.format(col.unique_count)}</span>
            </motion.li>
          );
        })}
      </ul>
    </Card>
  );
}
